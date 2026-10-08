<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadHistorial;
use App\Models\ActividadProgramacion;
use App\Models\ActividadTipo;
use App\Models\Agencia;
use App\Models\ChecklistItem;
use App\Models\Rol;
use App\Models\Usuario;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

// Programación mensual de actividades de mercadeo por agencia (Regional -> Agencia -> Mes)
class ProgramacionActividadService
{
    public function __construct(
        private InventarioService $inventarioService,
        private DetalleActividadService $detalleService,
    ) {
    }

    /**
     * Datos fijos del formulario (no dependen de la agencia).
     * $programacion: si se llega desde una actividad, el formulario abre con su regional, agencia y mes.
     */
    public function datosFormulario(?ActividadProgramacion $programacion = null): array
    {
        return [
            'regionales'   => $this->regionales(),
            'tipos'        => ActividadTipo::query()->where('activo', 1)->orderBy('nombre')->get(['id', 'nombre']),
            'checklist'    => ChecklistItem::query()->where('activo', 1)->orderBy('id')->get(['id', 'nombre']),
            'responsables' => $this->responsables(),
            'inicial'      => $programacion ? [
                'regional'   => $programacion->regional,
                'agencia_id' => $programacion->agencia_id,
                'mes'        => sprintf('%04d-%02d', $programacion->anio, $programacion->mes),
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
            ->whereIn('coduser', [$programacion->coor_regional_id, $programacion->responsable_id])
            ->pluck('nombre', 'coduser');

        return [
            'id'           => $programacion->id,
            'coorRegional' => ['coduser' => $programacion->coor_regional_id, 'nombre' => $nombres[$programacion->coor_regional_id] ?? $programacion->coor_regional_id],
            'responsable'  => ['coduser' => $programacion->responsable_id, 'nombre' => $nombres[$programacion->responsable_id] ?? $programacion->responsable_id],
            // Fechas que ya tienen actividad: no se pueden volver a usar
            'fechas'       => $this->fechasOcupadas($programacion),
        ];
    }

    // Agencias activas de una regional
    public function agenciasDeRegional(string $regional): array
    {
        return Agencia::query()
            ->where('activo', 1)
            ->where('agenreg', $regional)
            ->orderBy('agennom')
            ->get(['codagen', 'agennom'])
            ->map(fn (Agencia $a) => ['codigo' => $a->codagen, 'nombre' => $a->agennom])
            ->all();
    }

    // Datos que dependen de la agencia: coordinador regional, municipios, asesores e inventario
    public function datosAgencia(string $codagen): array
    {
        $agencia = Agencia::query()->where('activo', 1)->findOrFail($codagen);
        $inventario = $this->inventarioService->productosDeAgencia($agencia);
        $municipios = $this->detalleService->municipiosDeAgencia($agencia);

        return [
            'coordinadoresRegionales' => $this->coordinadores('COORDINADOR_COMERCIAL', $agencia->codagen),
            'municipios'              => $municipios['municipios'],
            'municipiosOrigen'        => $municipios['origen'], // 'correrias' | 'departamento'
            'asesores'                => $this->detalleService->asesoresDeAgencia($agencia->codagen),
            'inventario'              => $inventario ?? [],
            'inventarioError'         => $inventario === null
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

        if ($agencia === null || (string) $agencia->agenreg !== $datos['regional']) {
            throw ValidationException::withMessages(['agencia_id' => 'La agencia no pertenece a la regional seleccionada.']);
        }

        $existente = ActividadProgramacion::query()
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
                $programacion->departamento_id  = (int) $agencia->departamento_id; // se toma de la agencia
                $programacion->agencia_id       = $agencia->codagen;
                $programacion->regional         = (string) $agencia->agenreg;
                $programacion->anio             = $anio;
                $programacion->mes              = $mes;
                $programacion->coor_nacional_id = null; // ya no se pide en el formulario
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
            'regional'            => ['required', 'string', 'max:10'],
            'agencia_id'          => ['required', 'string', 'max:6'],
            'mes'                 => ['required', 'date_format:Y-m'],
            'coor_regional_id'    => ['required', 'string', 'max:7'],
            'responsable_id'      => ['required', 'string', 'max:7'],
            'actividades'         => ['required', 'array', 'min:1'],
            'actividades.*.fecha' => ['required', 'date_format:Y-m-d', 'distinct'],
            ...$this->detalleService->reglasDia('actividades.*'),
        ], [
            'regional.required'            => 'Seleccione la regional.',
            'agencia_id.required'          => 'Seleccione la agencia.',
            'mes.required'                 => 'Seleccione el mes.',
            'mes.date_format'              => 'El mes no es válido.',
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

    // Regionales que tienen al menos una agencia activa
    private function regionales(): array
    {
        return Agencia::query()->where('activo', 1)->whereNotNull('agenreg')->where('agenreg', '<>', '')
            ->distinct()->orderBy('agenreg')->pluck('agenreg')->all();
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
}
