<?php

namespace App\Services;

use App\Models\Agencia;
use App\Models\PromotoriaProgramacion;
use App\Models\PromotoriaVisita;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Promotoría: programación mensual de visitas de un promotor (como "Programación zonas" de Interelec).
 *  - Electromillonaria: regional -> agencia principal; cada visita es en la agencia o en uno de sus puntos satélite.
 *  - Interelec: cada visita es en una zona (toolset_inter.rutas).
 * Cada día puede tener una visita en la mañana y otra en la tarde.
 */
class PromotoriaService
{
    private const POR_PAGINA = 20;

    private const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

    public const DEPENDENCIAS = [
        PromotoriaProgramacion::ELECTROMILLONARIA => 'ELECTROMILLONARIA',
        PromotoriaProgramacion::INTERELEC         => 'INTERELEC',
    ];

    public const JORNADAS = [PromotoriaVisita::MANANA => 'Mañana', PromotoriaVisita::TARDE => 'Tarde'];

    public function __construct(private ResponsableAgenciaService $empleadosService)
    {
    }

    // ---------------------------------------------------------------- Lista

    public function listar(Request $request): array
    {
        $filtros = [
            // Sin el parámetro se muestra el mes actual; con mes=todos no se filtra por mes
            'mes'         => $request->has('mes') ? (string) $request->query('mes') : now()->format('Y-m'),
            'dependencia' => (string) $request->query('dependencia', ''),
            'promotor'    => (string) $request->query('promotor', ''),
        ];

        $visitas = PromotoriaVisita::query()
            ->from('promotoria_visitas as v')
            ->join('promotoria_programaciones as p', 'p.id', '=', 'v.programacion_id')
            ->select(['v.*', 'p.dependencia', 'p.promotor_cedula', 'p.promotor_nombre', 'p.promotor_cargo', 'p.anio', 'p.mes'])
            ->when(preg_match('/^\d{4}-\d{2}$/', $filtros['mes']) === 1, function ($q) use ($filtros) {
                [$anio, $mes] = array_map('intval', explode('-', $filtros['mes']));
                $q->where('p.anio', $anio)->where('p.mes', $mes);
            })
            ->when($filtros['dependencia'] !== '', fn ($q) => $q->where('p.dependencia', $filtros['dependencia']))
            ->when($filtros['promotor'] !== '', fn ($q) => $q->where('p.promotor_cedula', $filtros['promotor']))
            ->orderBy('v.fecha')
            ->orderByRaw("v.jornada = 'TARDE'")
            ->orderBy('p.promotor_nombre')
            ->paginate(self::POR_PAGINA)
            ->withQueryString();

        $agencias = Agencia::query()->whereIn('codagen', collect($visitas->items())->pluck('agencia_id')->filter()->unique())->pluck('agennom', 'codagen');

        $visitas->through(fn (PromotoriaVisita $v) => [
            'id'             => $v->id,
            'programacionId' => $v->programacion_id,
            'fecha'          => $v->fecha->format('Y-m-d'),
            'jornada'        => self::JORNADAS[$v->jornada] ?? $v->jornada,
            'dependencia'    => self::DEPENDENCIAS[$v->dependencia] ?? $v->dependencia,
            'promotor'       => $v->promotor_nombre,
            'cargo'          => $v->promotor_cargo,
            'lugar'          => $v->agencia_id ? ($agencias[$v->agencia_id] ?? $v->agencia_id) : (string) $v->ruta_nombre,
            'observacion'    => (string) $v->observacion,
            'estado'         => $v->estado,
        ]);

        return [
            'visitas'  => $visitas,
            'filtros'  => $filtros,
            'opciones' => $this->opcionesFiltros(),
        ];
    }

    private function opcionesFiltros(): array
    {
        $meses = PromotoriaProgramacion::query()->select(['anio', 'mes'])->distinct()->get()->toBase()
            ->map(fn ($p) => sprintf('%04d-%02d', $p->anio, $p->mes))
            ->push(now()->format('Y-m'))
            ->unique()->sortDesc()->values()
            ->map(fn ($valor) => ['valor' => $valor, 'etiqueta' => $this->etiquetaMes($valor)]);

        return [
            'meses'        => $meses,
            'dependencias' => collect(self::DEPENDENCIAS)->map(fn ($e, $v) => ['valor' => $v, 'etiqueta' => $e])->values(),
            'promotores'   => PromotoriaProgramacion::query()->select(['promotor_cedula', 'promotor_nombre'])->distinct()->orderBy('promotor_nombre')->get()
                ->map(fn ($p) => ['cedula' => $p->promotor_cedula, 'nombre' => $p->promotor_nombre]),
        ];
    }

    // ---------------------------------------------------------------- Formulario

    /** Datos del formulario de crear / editar / consultar una programación */
    public function datosFormulario(?PromotoriaProgramacion $programacion = null): array
    {
        $promotores = $this->empleadosService->promotores();

        // El promotor de la programación sigue apareciendo aunque ya no esté activo en Manager
        if ($programacion && $promotores !== null && ! collect($promotores)->contains('cedula', $programacion->promotor_cedula)) {
            $promotores[] = ['cedula' => $programacion->promotor_cedula, 'nombre' => $programacion->promotor_nombre, 'cargo' => (string) $programacion->promotor_cargo];
        }

        return [
            'dependencias'    => collect(self::DEPENDENCIAS)->map(fn ($e, $v) => ['valor' => $v, 'etiqueta' => $e])->values(),
            'jornadas'        => collect(self::JORNADAS)->map(fn ($e, $v) => ['valor' => $v, 'etiqueta' => $e])->values(),
            'regionales'      => $this->regionales(),
            'promotores'      => $promotores ?? [],
            'promotoresError' => $promotores === null ? 'No se pudieron consultar los promotores en Manager. Intente de nuevo en unos minutos.' : null,
            'zonas'           => $this->zonas(),
            'programacion'    => $programacion ? $this->paraFormulario($programacion) : null,
        ];
    }

    private function paraFormulario(PromotoriaProgramacion $p): array
    {
        return [
            'id'              => $p->id,
            'mes'             => sprintf('%04d-%02d', $p->anio, $p->mes),
            'dependencia'     => $p->dependencia,
            'promotor_cedula' => $p->promotor_cedula,
            'regional'        => (string) $p->regional,
            'agencia_id'      => (string) $p->agencia_id,
            // Los lugares de la agencia principal (para el select de cada día)
            'lugares'         => $p->agencia_id ? $this->lugares((string) $p->agencia_id) : [],
            'agencias'        => $p->regional ? $this->agenciasPrincipales((string) $p->regional) : [],
            'visitas'         => $p->visitas()->orderBy('fecha')->get()->map(fn (PromotoriaVisita $v) => [
                'id'          => $v->id,
                'fecha'       => $v->fecha->format('Y-m-d'),
                'jornada'     => $v->jornada,
                'agencia_id'  => (string) $v->agencia_id,
                'ruta_id'     => $v->ruta_id ? (string) $v->ruta_id : '',
                'observacion' => (string) $v->observacion,
                'estado'      => $v->estado,
            ])->values(),
        ];
    }

    /** Agencias principales activas de la regional (las que no son punto satélite de otra) */
    public function agenciasPrincipales(string $regional): array
    {
        return Agencia::query()
            ->where('activo', 1)
            ->where('agenreg', $regional)
            ->where(fn ($q) => $q->whereNull('agenpertenece')->orWhere('agenpertenece', '')->orWhereColumn('agenpertenece', 'codagen'))
            ->orderBy('agennom')
            ->get(['codagen', 'agennom'])
            ->map(fn (Agencia $a) => ['codigo' => $a->codagen, 'nombre' => $a->agennom])
            ->all();
    }

    /** La agencia principal y sus puntos satélite activos (agencias.agenpertenece) */
    public function lugares(string $codagen): array
    {
        $principal = Agencia::query()->find($codagen);
        if (! $principal) {
            return [];
        }

        $satelites = Agencia::query()
            ->where('activo', 1)
            ->where('agenpertenece', $codagen)
            ->where('codagen', '<>', $codagen)
            ->orderBy('agennom')
            ->get(['codagen', 'agennom'])
            ->map(fn (Agencia $a) => ['codigo' => $a->codagen, 'nombre' => $a->agennom, 'satelite' => true]);

        return collect([['codigo' => $principal->codagen, 'nombre' => $principal->agennom, 'satelite' => false]])->merge($satelites)->all();
    }

    // Zonas de Interelec (toolset_inter.rutas)
    private function zonas(): array
    {
        return DB::connection('toolset_inter')->table('rutas')->orderBy('nombre')->get(['id', 'nombre'])
            ->map(fn ($r) => ['id' => (string) $r->id, 'nombre' => $r->nombre])->all();
    }

    private function regionales(): array
    {
        return Agencia::query()->where('activo', 1)->whereNotNull('agenreg')->where('agenreg', '<>', '')
            ->distinct()->orderBy('agenreg')->pluck('agenreg')->all();
    }

    // ---------------------------------------------------------------- Guardar

    public function crear(Request $request): PromotoriaProgramacion
    {
        return $this->guardar($request, new PromotoriaProgramacion());
    }

    public function actualizar(Request $request, PromotoriaProgramacion $programacion): PromotoriaProgramacion
    {
        return $this->guardar($request, $programacion);
    }

    private function guardar(Request $request, PromotoriaProgramacion $programacion): PromotoriaProgramacion
    {
        $nueva = ! $programacion->exists;
        $datos = $this->validar($request, $programacion);
        [$anio, $mes] = array_map('intval', explode('-', $datos['mes']));
        $electro = $datos['dependencia'] === PromotoriaProgramacion::ELECTROMILLONARIA;
        $coduser = (string) $request->user()->coduser;

        $promotor = collect($this->empleadosService->promotores() ?? [])->firstWhere('cedula', $datos['promotor_cedula'])
            ?? ['nombre' => $programacion->promotor_nombre, 'cargo' => $programacion->promotor_cargo];
        $zonas = collect($this->zonas())->pluck('nombre', 'id');

        return DB::connection('mysql')->transaction(function () use ($programacion, $nueva, $datos, $anio, $mes, $electro, $coduser, $promotor, $zonas) {
            $programacion->anio            = $anio;
            $programacion->mes             = $mes;
            $programacion->dependencia     = $datos['dependencia'];
            $programacion->promotor_cedula = $datos['promotor_cedula'];
            $programacion->promotor_nombre = mb_substr((string) $promotor['nombre'], 0, 200);
            $programacion->promotor_cargo  = $promotor['cargo'] ? mb_substr((string) $promotor['cargo'], 0, 100) : null;
            $programacion->regional        = $electro ? $datos['regional'] : null;
            $programacion->agencia_id      = $electro ? $datos['agencia_id'] : null;
            $programacion->user_update     = $coduser;
            if ($nueva) {
                $programacion->user_new = $coduser;
            }
            $programacion->save();

            // Se conservan las visitas que siguen (mismo día y jornada) y se quitan las que ya no vienen
            $existentes = $programacion->visitas()->get()->keyBy(fn ($v) => $v->fecha->format('Y-m-d').'|'.$v->jornada);
            $vienen = [];

            foreach ($datos['visitas'] ?? [] as $v) {
                $clave = $v['fecha'].'|'.$v['jornada'];
                $vienen[] = $clave;

                $visita = $existentes[$clave] ?? new PromotoriaVisita();
                $visita->programacion_id = $programacion->id;
                $visita->fecha           = $v['fecha'];
                $visita->jornada         = $v['jornada'];
                $visita->agencia_id      = $electro ? $v['agencia_id'] : null;
                $visita->ruta_id         = $electro ? null : (int) $v['ruta_id'];
                $visita->ruta_nombre     = $electro ? null : mb_substr((string) ($zonas[(string) $v['ruta_id']] ?? ''), 0, 100);
                $visita->observacion     = isset($v['observacion']) && trim($v['observacion']) !== '' ? trim($v['observacion']) : null;
                $visita->user_update     = $coduser;
                if (! $visita->exists) {
                    $visita->estado   = PromotoriaVisita::PROGRAMADA;
                    $visita->user_new = $coduser;
                }
                $visita->save();
            }

            // toBase(): en una colección de Eloquent except() filtra por id del modelo, no por la clave "fecha|jornada"
            $existentes->toBase()->except($vienen)->each->delete();

            return $programacion;
        });
    }

    private function validar(Request $request, PromotoriaProgramacion $programacion): array
    {
        $electro = $request->input('dependencia') === PromotoriaProgramacion::ELECTROMILLONARIA;

        $validator = Validator::make($request->all(), [
            'mes'                   => ['required', 'date_format:Y-m'],
            'dependencia'           => ['required', Rule::in(array_keys(self::DEPENDENCIAS))],
            'promotor_cedula'       => ['required', 'string', 'max:20'],
            'regional'              => [$electro ? 'required' : 'nullable', 'string', 'max:10'],
            'agencia_id'            => [$electro ? 'required' : 'nullable', 'string', 'max:6'],
            'visitas'               => ['required', 'array', 'min:1'],
            'visitas.*.fecha'       => ['required', 'date_format:Y-m-d'],
            'visitas.*.jornada'     => ['required', Rule::in(array_keys(self::JORNADAS))],
            'visitas.*.agencia_id'  => [$electro ? 'required' : 'nullable', 'string', 'max:6'],
            'visitas.*.ruta_id'     => [$electro ? 'nullable' : 'required', 'integer'],
            'visitas.*.observacion' => ['nullable', 'string', 'max:1000'],
        ], [
            'mes.required'                  => 'Seleccione el mes de la visita.',
            'dependencia.required'          => 'Seleccione la dependencia.',
            'promotor_cedula.required'      => 'Seleccione el promotor.',
            'regional.required'             => 'Seleccione la regional.',
            'agencia_id.required'           => 'Seleccione la agencia.',
            'visitas.required'              => 'Programe al menos una visita (escoja el lugar en algún día).',
            'visitas.min'                   => 'Programe al menos una visita (escoja el lugar en algún día).',
            'visitas.*.agencia_id.required' => 'Seleccione la agencia o el punto satélite.',
            'visitas.*.ruta_id.required'    => 'Seleccione la zona.',
            'visitas.*.observacion.max'     => 'La observación no puede tener más de 1000 caracteres.',
        ]);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }
        $datos = $validator->validated();

        $errores = [];
        [$anio, $mes] = array_map('intval', explode('-', $datos['mes']));

        if ($programacion->exists) {
            // Al editar no cambian mes, dependencia ni promotor
            if (sprintf('%04d-%02d', $programacion->anio, $programacion->mes) !== $datos['mes']
                || $programacion->dependencia !== $datos['dependencia'] || $programacion->promotor_cedula !== $datos['promotor_cedula']) {
                $errores['mes'] = 'No se pueden cambiar el mes, la dependencia ni el promotor de una programación.';
            }
        } else {
            if (Carbon::create($anio, $mes, 1)->lt(now()->startOfMonth())) {
                $errores['mes'] = 'No se puede programar un mes que ya pasó.';
            }

            $promotores = $this->empleadosService->promotores();
            if ($promotores === null) {
                $errores['promotor_cedula'] = 'No se pudo validar el promotor en Manager. Intente de nuevo.';
            } elseif (! collect($promotores)->contains('cedula', $datos['promotor_cedula'])) {
                $errores['promotor_cedula'] = 'El promotor no es válido.';
            }

            $existente = PromotoriaProgramacion::query()->where('promotor_cedula', $datos['promotor_cedula'])
                ->where('anio', $anio)->where('mes', $mes)->where('dependencia', $datos['dependencia'])->value('id');
            if ($existente) {
                $errores['promotor_cedula'] = "El promotor ya tiene la programación #{$existente} de este mes en esa dependencia; edítela.";
            }
        }

        // Lugares válidos: la agencia principal y sus puntos satélite (Electromillonaria) o las zonas (Interelec)
        if ($electro) {
            if (! collect($this->agenciasPrincipales($datos['regional']))->contains('codigo', $datos['agencia_id'])) {
                $errores['agencia_id'] = 'La agencia no pertenece a la regional seleccionada.';
            }
            $validos = collect($this->lugares($datos['agencia_id']))->pluck('codigo')->map('strval')->all();
        } else {
            $validos = collect($this->zonas())->pluck('id')->all();
        }

        $vistas = [];
        foreach ($datos['visitas'] as $i => $v) {
            $fecha = Carbon::createFromFormat('Y-m-d', $v['fecha']);
            $clave = $v['fecha'].'|'.$v['jornada'];

            if ($fecha->year !== $anio || $fecha->month !== $mes) {
                $errores["visitas.$i.fecha"] = 'La fecha no pertenece al mes seleccionado.';
            } elseif (in_array($clave, $vistas, true)) {
                $errores["visitas.$i.fecha"] = 'Ya hay una visita en esa fecha y jornada.';
            }
            $vistas[] = $clave;

            $lugar = (string) ($electro ? $v['agencia_id'] : $v['ruta_id']);
            if (! in_array($lugar, $validos, true)) {
                $errores[$electro ? "visitas.$i.agencia_id" : "visitas.$i.ruta_id"] = $electro
                    ? 'El lugar no es la agencia ni uno de sus puntos satélite.'
                    : 'La zona no es válida.';
            }
        }

        if ($errores !== []) {
            throw ValidationException::withMessages($errores);
        }

        return $datos;
    }

    // ---------------------------------------------------------------- Eliminar

    public function eliminarVisita(PromotoriaVisita $visita): void
    {
        DB::connection('mysql')->transaction(function () use ($visita) {
            $programacion = $visita->programacion;
            $visita->delete();

            // Una programación sin visitas no tiene sentido: se elimina también
            if ($programacion && ! $programacion->visitas()->exists()) {
                $programacion->delete();
            }
        });
    }

    public function eliminarProgramacion(PromotoriaProgramacion $programacion): void
    {
        DB::connection('mysql')->transaction(function () use ($programacion) {
            $programacion->visitas()->delete();
            $programacion->delete();
        });
    }

    public function etiquetaMes(string $valor): string
    {
        return self::MESES[(int) substr($valor, 5, 2) - 1].' '.substr($valor, 0, 4);
    }
}
