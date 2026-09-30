<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadHistorial;
use App\Models\ActividadProgramacion;
use App\Models\ActividadTipo;
use App\Models\Agencia;
use App\Models\ChecklistItem;
use App\Models\Ciudad;
use App\Models\Departamento;
use App\Models\Rol;
use App\Models\Usuario;
use App\Models\Vendedor;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

// Programación mensual de actividades de mercadeo por agencia
class ProgramacionActividadService
{
    public function __construct(
        private InventarioService $inventarioService,
        private DetalleActividadService $detalleService,
    ) {
    }

    /**
     * Datos fijos del formulario (no dependen de la agencia).
     * $programacion: si se llega desde una actividad, el formulario abre con su departamento, agencia y mes.
     */
    public function datosFormulario(?ActividadProgramacion $programacion = null): array
    {
        return [
            'departamentos'          => $this->departamentosConAgencias(),
            'tipos'                  => ActividadTipo::query()->where('activo', 1)->orderBy('nombre')->get(['id', 'nombre']),
            'checklist'              => ChecklistItem::query()->where('activo', 1)->orderBy('id')->get(['id', 'nombre']),
            'asesores'               => $this->asesores(),
            'coordinadoresNacionales' => $this->coordinadores('COORDINADOR_NACIONAL'),
            'responsables'           => $this->responsables(),
            'inicial'                => $programacion ? [
                'departamento_id' => (string) $programacion->departamento_id,
                'agencia_id'      => $programacion->agencia_id,
                'mes'             => sprintf('%04d-%02d', $programacion->anio, $programacion->mes),
            ] : null,
        ];
    }

    /**
     * Programación que ya tiene la agencia en ese mes ("YYYY-MM"), o null.
     * Si existe, el formulario pasa a modo "agregar actividades" con sus responsables fijos.
     */
    public function programacionExistente(string $codagen, string $mes): ?array
    {
        if (preg_match('/^\d{4}-\d{2}$/', $mes) !== 1) {
            return null;
        }
        [$anio, $numeroMes] = array_map('intval', explode('-', $mes));

        $programacion = ActividadProgramacion::query()
            ->where('agencia_id', $codagen)->where('anio', $anio)->where('mes', $numeroMes)->first();

        if ($programacion === null) {
            return null;
        }

        $nombres = Usuario::query()
            ->whereIn('coduser', [$programacion->coor_nacional_id, $programacion->coor_regional_id, $programacion->responsable_id])
            ->pluck('nombre', 'coduser');

        return [
            'id'           => $programacion->id,
            'coorNacional' => ['coduser' => $programacion->coor_nacional_id, 'nombre' => $nombres[$programacion->coor_nacional_id] ?? $programacion->coor_nacional_id],
            'coorRegional' => ['coduser' => $programacion->coor_regional_id, 'nombre' => $nombres[$programacion->coor_regional_id] ?? $programacion->coor_regional_id],
            'responsable'  => ['coduser' => $programacion->responsable_id, 'nombre' => $nombres[$programacion->responsable_id] ?? $programacion->responsable_id],
            // Fechas que ya tienen actividad: no se pueden volver a usar
            'fechas'       => $this->fechasOcupadas($programacion),
        ];
    }

    // Agencias activas de un departamento, con su regional (el formulario filtra Departamento -> Regional -> Agencia)
    public function agenciasDeDepartamento(int $departamentoId): array
    {
        return Agencia::query()
            ->where('activo', 1)
            ->where('departamento_id', $departamentoId)
            ->orderBy('agennom')
            ->get(['codagen', 'agennom', 'agenreg'])
            ->map(fn (Agencia $a) => ['codigo' => $a->codagen, 'nombre' => $a->agennom, 'regional' => (string) $a->agenreg])
            ->all();
    }

    // Datos que dependen de la agencia: regional, coordinador regional, municipios e inventario
    public function datosAgencia(string $codagen): array
    {
        $agencia = Agencia::query()->where('activo', 1)->findOrFail($codagen);
        $inventario = $this->inventarioService->productosDeAgencia($agencia);

        return [
            'regional'              => (string) $agencia->agenreg,
            'coordinadoresRegionales' => $this->coordinadores('COORDINADOR_COMERCIAL', $agencia->codagen),
            'municipios'            => $this->municipios((int) $agencia->departamento_id),
            'inventario'            => $inventario ?? [],
            'inventarioError'       => $inventario === null
                ? 'No se pudo consultar el inventario en Manager. Intente de nuevo en unos minutos.'
                : null,
        ];
    }

    /**
     * Crea la programación del mes con sus actividades; si la agencia ya tiene programación en ese mes,
     * las actividades se agregan a la existente (conserva sus responsables).
     *
     * @return array{programacion: ActividadProgramacion, creadas: int, existente: bool}
     */
    public function crear(Request $request): array
    {
        $datos = $this->validarBasico($request);

        $agencia = Agencia::query()->where('activo', 1)->find($datos['agencia_id']);
        [$anio, $mes] = array_map('intval', explode('-', $datos['mes']));

        if ($agencia === null || (int) $agencia->departamento_id !== (int) $datos['departamento_id']) {
            throw ValidationException::withMessages(['agencia_id' => 'La agencia no es válida para el departamento seleccionado.']);
        }
        if ((string) $agencia->agenreg !== $datos['regional']) {
            throw ValidationException::withMessages(['agencia_id' => 'La agencia no pertenece a la regional seleccionada.']);
        }

        $existente =ActividadProgramacion::query()
            ->where('agencia_id', $agencia->codagen)->where('anio', $anio)->where('mes', $mes)->first();

        $catalogos = $this->detalleService->catalogos($agencia);
        $this->validarNegocio($datos, $agencia, $anio, $mes, $catalogos, $existente);

        $coduser = (string) $request->user()->coduser;

        $programacion = DB::connection('mysql')->transaction(function () use ($datos, $agencia, $anio, $mes, $catalogos, $coduser, $existente) {
            if ($existente !== null) {
                $programacion = $existente;
                $programacion->user_update = $coduser;
                $programacion->save();
            } else {
                $programacion = new ActividadProgramacion();
                $programacion->departamento_id  = (int) $datos['departamento_id'];
                $programacion->agencia_id       = $agencia->codagen;
                $programacion->regional         = (string) $agencia->agenreg;
                $programacion->anio             = $anio;
                $programacion->mes              = $mes;
                $programacion->coor_nacional_id = $datos['coor_nacional_id'];
                $programacion->coor_regional_id = $datos['coor_regional_id'];
                $programacion->responsable_id   = $datos['responsable_id'];
                $programacion->user_new         = $coduser;
                $programacion->user_update      = $coduser;
                $programacion->save();
            }

            foreach ($datos['actividades'] as $dia) {
                $actividad = new Actividad();
                $actividad->programacion_id   = $programacion->id;
                $actividad->fecha             = $dia['fecha'];
                $actividad->actividad_tipo_id = (int) $dia['actividad_tipo_id'];
                $actividad->ciudad_id         = (int) $dia['ciudad_id'];
                $actividad->estado            = Actividad::PROGRAMADA;
                $actividad->user_new          = $coduser;
                $actividad->user_update       = $coduser;
                $actividad->save();

                $this->detalleService->guardarDetalles($actividad, $dia, $catalogos);

                $historial = new ActividadHistorial();
                $historial->actividad_id = $actividad->id;
                $historial->estado       = Actividad::PROGRAMADA;
                $historial->observacion  = $existente !== null ? 'Actividad agregada a la programación del mes' : 'Actividad programada';
                $historial->user_new     = $coduser;
                $historial->save();
            }

            return $programacion;
        });

        return [
            'programacion' => $programacion,
            'creadas'      => count($datos['actividades']),
            'existente'    => $existente !== null,
        ];
    }

    // Formato y campos obligatorios
    private function validarBasico(Request $request): array
    {
        $validator = Validator::make($request->all(), [
            'departamento_id'     => ['required', 'integer'],
            'regional'            => ['required', 'string', 'max:10'],
            'agencia_id'          => ['required', 'string', 'max:6'],
            'mes'                 => ['required', 'date_format:Y-m'],
            'coor_nacional_id'    => ['required', 'string', 'max:7'],
            'coor_regional_id'    => ['required', 'string', 'max:7'],
            'responsable_id'      => ['required', 'string', 'max:7'],
            'actividades'         => ['required', 'array', 'min:1'],
            'actividades.*.fecha' => ['required', 'date_format:Y-m-d', 'distinct'],
            ...$this->detalleService->reglasDia('actividades.*'),
        ], [
            'departamento_id.required'     => 'Seleccione el departamento.',
            'regional.required'            => 'Seleccione la regional.',
            'agencia_id.required'          => 'Seleccione la agencia.',
            'mes.required'                 => 'Seleccione el mes.',
            'mes.date_format'              => 'El mes no es válido.',
            'coor_nacional_id.required'    => 'Seleccione el coordinador nacional.',
            'coor_regional_id.required'    => 'Seleccione el coordinador regional.',
            'responsable_id.required'      => 'Seleccione el responsable.',
            'actividades.required'         => 'Diligencie al menos un día con actividad.',
            'actividades.min'              => 'Diligencie al menos un día con actividad.',
            'actividades.*.fecha.distinct' => 'La fecha está repetida.',
            ...$this->detalleService->mensajesDia('actividades.*'),
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    // Reglas que dependen de la BD: todo lo seleccionado debe existir y corresponder a la agencia
    private function validarNegocio(array $datos, Agencia $agencia, int $anio, int $mes, array $catalogos, ?ActividadProgramacion $existente): void
    {
        $errores = [];

        $inicioMes = Carbon::create($anio, $mes, 1)->startOfDay();
        if ($inicioMes->lt(now()->startOfMonth())) {
            $errores['mes'] = 'No se puede programar un mes que ya pasó.';
        }

        // Programación nueva: se validan sus responsables. Si ya existe, conserva los suyos.
        if ($existente === null) {
            if (! collect($this->coordinadores('COORDINADOR_NACIONAL'))->contains('coduser', $datos['coor_nacional_id'])) {
                $errores['coor_nacional_id'] = 'El coordinador nacional no es válido.';
            }
            if (! collect($this->coordinadores('COORDINADOR_COMERCIAL', $agencia->codagen))->contains('coduser', $datos['coor_regional_id'])) {
                $errores['coor_regional_id'] = 'El coordinador regional no corresponde a la agencia.';
            }
            if (! collect($this->responsables())->contains('coduser', $datos['responsable_id'])) {
                $errores['responsable_id'] = 'El responsable no es válido.';
            }
        }

        // Fechas que ya tienen actividad en la programación existente (fecha => id)
        $ocupadas = $existente ? collect($this->fechasOcupadas($existente))->pluck('id', 'fecha')->all() : [];

        foreach ($datos['actividades'] as $i => $dia) {
            $fecha = Carbon::createFromFormat('Y-m-d', $dia['fecha']);

            if ($fecha->year !== $anio || $fecha->month !== $mes) {
                $errores["actividades.$i.fecha"] = 'La fecha no pertenece al mes seleccionado.';
            } elseif (isset($ocupadas[$dia['fecha']])) {
                $errores["actividades.$i.fecha"] = "Ya existe la actividad #{$ocupadas[$dia['fecha']]} en esa fecha.";
            }

            $errores += $this->detalleService->erroresDia($dia, "actividades.$i", $catalogos);
        }

        if ($errores !== []) {
            throw ValidationException::withMessages($errores);
        }
    }

    // [['fecha' => 'YYYY-MM-DD', 'id' => 12], ...] de las actividades de la programación (cualquier estado)
    private function fechasOcupadas(ActividadProgramacion $programacion): array
    {
        return DB::connection('mysql')->table('actividades')
            ->where('programacion_id', $programacion->id)
            ->orderBy('fecha')
            ->get(['id', 'fecha'])
            ->map(fn ($a) => ['fecha' => (string) $a->fecha, 'id' => (int) $a->id])
            ->all();
    }

    // Departamentos que tienen al menos una agencia activa
    private function departamentosConAgencias(): array
    {
        $ids = Agencia::query()->where('activo', 1)->whereNotNull('departamento_id')
            ->where('departamento_id', '<>', 0)->distinct()->pluck('departamento_id');

        return Departamento::query()->whereIn('id', $ids)->orderBy('departamento')
            ->get(['id', 'departamento'])
            ->map(fn (Departamento $d) => ['id' => $d->id, 'nombre' => $d->departamento])
            ->all();
    }

    // Municipios del departamento de la agencia
    public function municipios(int $departamentoId): array
    {
        return Ciudad::query()->where('departamento', $departamentoId)->orderBy('ciudad')
            ->get(['id', 'ciudad'])
            ->map(fn (Ciudad $c) => ['id' => $c->id, 'nombre' => $c->ciudad])
            ->all();
    }

    // Coordinadores según el perfil de toolset_perf.roles (mismo criterio que Correrías en admin)
    public function coordinadores(string $tipoRol, ?string $codagen = null): array
    {
        return Usuario::query()
            ->join('roles as r', 'usuarios.nivel', '=', 'r.codrol')
            ->where('r.tipo_rol', $tipoRol)
            ->where('usuarios.useractivo', '1')
            ->when($codagen !== null, fn ($q) => $q->where('r.agencias_asignadas', 'like', '%"'.$codagen.'"%'))
            ->orderBy('usuarios.nombre')
            ->get(['usuarios.coduser', 'usuarios.nombre'])
            ->map(fn ($u) => ['coduser' => $u->coduser, 'nombre' => $u->nombre])
            ->all();
    }

    // Usuarios activos cuyo perfil de mercadeo tiene el permiso act_responsable
    public function responsables(): array
    {
        $perfiles = Rol::query()->where('permisos', 'like', '%,act_responsable,%')->pluck('id');

        return Usuario::query()
            ->whereIn('nivel_mercadeo', $perfiles)
            ->where('useractivo', '1')
            ->orderBy('nombre')
            ->get(['coduser', 'nombre'])
            ->map(fn (Usuario $u) => ['coduser' => $u->coduser, 'nombre' => $u->nombre])
            ->all();
    }

    // Asesores de interelec activos
    public function asesores(): array
    {
        return Vendedor::query()->where('activo', 1)->orderBy('nombre')
            ->get(['id', 'nombre'])
            ->map(fn (Vendedor $v) => ['id' => $v->id, 'nombre' => $v->nombre])
            ->all();
    }
}
