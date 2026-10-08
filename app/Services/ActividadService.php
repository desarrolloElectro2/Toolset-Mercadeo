<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadHistorial;
use App\Models\ActividadProgramacion;
use App\Models\ActividadTipo;
use App\Models\Agencia;
use App\Models\ChecklistItem;
use App\Models\Ciudad;
use App\Models\Usuario;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

// Lista y edición de actividades (cada actividad es un día de una programación mensual)
class ActividadService
{
    private const POR_PAGINA = 15;

    private const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

    // Estados en los que todavía se puede cambiar lo planeado
    private const ESTADOS_EDITABLES = [Actividad::PROGRAMADA, Actividad::EN_PROCESO];

    public function __construct(
        private InventarioService $inventarioService,
        private DetalleActividadService $detalleService,
    ) {
    }

    // Tabla de actividades con filtros y paginación
    public function listar(Request $request): array
    {
        $filtros = [
            'buscar'   => trim((string) $request->query('buscar', '')),
            'regional' => (string) $request->query('regional', ''),
            'agencia'  => (string) $request->query('agencia', ''),
            // Sin el parámetro se muestra el mes actual; con mes=todos no se filtra por mes
            'mes'      => $request->has('mes') ? (string) $request->query('mes') : now()->format('Y-m'),
            'estado'   => (string) $request->query('estado', ''),
        ];

        $actividades = $this->consultaFiltrada($filtros)
            ->when(preg_match('/^\d{4}-\d{2}$/', $filtros['mes']) === 1, function ($q) use ($filtros) {
                $inicio = Carbon::createFromFormat('Y-m-d', $filtros['mes'].'-01');
                $q->whereBetween('a.fecha', [$inicio->toDateString(), $inicio->copy()->endOfMonth()->toDateString()]);
            })
            ->when($filtros['buscar'] !== '', fn ($q) => $this->filtrarBusqueda($q, $filtros['buscar']))
            ->orderBy('a.fecha')
            ->orderBy('a.id')
            ->paginate(self::POR_PAGINA)
            ->withQueryString();

        $actividades->through($this->mapeadorFila(collect($actividades->items())));

        return [
            'actividades' => $actividades,
            'filtros'     => $filtros,
            'opciones'    => $this->opcionesFiltros(),
        ];
    }

    // Página del calendario: solo las opciones de filtros; los eventos se piden por rango (eventosCalendario)
    public function datosCalendario(): array
    {
        return ['opciones' => $this->opcionesFiltros()];
    }

    /**
     * Actividades entre dos fechas (el rango visible del calendario), con los mismos filtros de la lista.
     * El rango se limita a 62 días: el mes más largo del calendario muestra 6 semanas (42 días).
     */
    public function eventosCalendario(Request $request): array
    {
        $validator = Validator::make($request->query(), [
            'inicio' => ['required', 'date_format:Y-m-d'],
            'fin'    => ['required', 'date_format:Y-m-d', 'after:inicio'],
        ]);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $inicio = Carbon::createFromFormat('Y-m-d', $request->query('inicio'))->startOfDay();
        $fin = Carbon::createFromFormat('Y-m-d', $request->query('fin'))->startOfDay();
        if ($inicio->diffInDays($fin) > 62) {
            $fin = $inicio->copy()->addDays(62);
        }

        $filtros = [
            'regional' => (string) $request->query('regional', ''),
            'agencia'  => (string) $request->query('agencia', ''),
            'estado'   => (string) $request->query('estado', ''),
        ];

        // FullCalendar envía el fin exclusivo (primer día que ya no se ve)
        $filas = $this->consultaFiltrada($filtros)
            ->where('a.fecha', '>=', $inicio->toDateString())
            ->where('a.fecha', '<', $fin->toDateString())
            ->orderBy('a.fecha')
            ->orderBy('a.id')
            ->get();

        return $filas->map($this->mapeadorFila($filas))->values()->all();
    }

    // Actividades + datos de su programación, con los filtros comunes de lista y calendario
    private function consultaFiltrada(array $filtros)
    {
        return Actividad::query()
            ->from('actividades as a')
            ->join('actividad_programaciones as p', 'p.id', '=', 'a.programacion_id')
            ->select(['a.*', 'p.agencia_id', 'p.regional', 'p.responsable_id'])
            ->when(($filtros['regional'] ?? '') !== '', fn ($q) => $q->where('p.regional', $filtros['regional']))
            ->when(($filtros['agencia'] ?? '') !== '', fn ($q) => $q->where('p.agencia_id', $filtros['agencia']))
            ->when(($filtros['estado'] ?? '') !== '', fn ($q) => $q->where('a.estado', $filtros['estado']));
    }

    // Convierte una actividad en fila para la vista; los nombres de otras BD se buscan una sola vez para todas
    private function mapeadorFila($filas): \Closure
    {
        $agencias = Agencia::query()->whereIn('codagen', $filas->pluck('agencia_id')->unique())->pluck('agennom', 'codagen');
        $municipios = Ciudad::query()->whereIn('id', $filas->pluck('ciudad_id')->unique())->pluck('ciudad', 'id');
        $responsables = Usuario::query()->whereIn('coduser', $filas->pluck('responsable_id')->unique())->pluck('nombre', 'coduser');
        $tipos = ActividadTipo::query()->pluck('nombre', 'id');

        return fn (Actividad $a) => [
            'id'          => $a->id,
            'fecha'       => $a->fecha->format('Y-m-d'),
            'regional'    => $a->regional,
            'agencia'     => $agencias[$a->agencia_id] ?? $a->agencia_id,
            'municipio'   => $municipios[$a->ciudad_id] ?? '—',
            'tipo'        => $tipos[$a->actividad_tipo_id] ?? '—',
            'responsable' => $responsables[$a->responsable_id] ?? $a->responsable_id,
            'horaInicio'  => $a->hora_inicio ? substr($a->hora_inicio, 0, 5) : null,
            'horaFin'     => $a->hora_fin ? substr($a->hora_fin, 0, 5) : null,
            'estado'      => $a->estado,
            'editable'    => in_array($a->estado, self::ESTADOS_EDITABLES, true),
        ];
    }

    // Datos para el formulario de edición (o consulta si ya no es editable)
    public function obtenerParaEditar(Actividad $actividad): array
    {
        $programacion = $actividad->programacion;
        $agencia = Agencia::query()->findOrFail($programacion->agencia_id);
        $editable = in_array($actividad->estado, self::ESTADOS_EDITABLES, true);

        $asesoresGuardados = $this->asesoresGuardados($actividad);

        // Asesores de la agencia + los ya guardados (por si alguno cambió de agencia o se inactivó)
        $asesores = collect($this->detalleService->asesoresDeAgencia($agencia->codagen));
        foreach ($asesoresGuardados as $coduser => $nombre) {
            if (! $asesores->contains('coduser', (string) $coduser)) {
                $asesores->push(['coduser' => (string) $coduser, 'nombre' => $nombre]);
            }
        }

        // Municipios de la agencia + el que ya tiene la actividad (si dejó de estar en la lista)
        $municipios = collect($this->detalleService->municipiosDeAgencia($agencia)['municipios']);
        if (! $municipios->contains('id', (int) $actividad->ciudad_id)) {
            $actual = Ciudad::query()->find($actividad->ciudad_id);
            if ($actual) {
                $municipios->push(['id' => (int) $actual->id, 'nombre' => $actual->ciudad]);
            }
        }

        // El inventario solo se consulta en Manager si se va a editar
        $inventario = $editable ? $this->inventarioService->productosDeAgencia($agencia) : [];

        $personas = Usuario::query()
            ->whereIn('coduser', [$programacion->coor_regional_id, $programacion->responsable_id])
            ->pluck('nombre', 'coduser');

        return [
            'actividad' => [
                'id'                => $actividad->id,
                'fecha'             => $actividad->fecha->format('Y-m-d'),
                'estado'            => $actividad->estado,
                'actividad_tipo_id' => (string) $actividad->actividad_tipo_id,
                'ciudad_id'         => (string) $actividad->ciudad_id,
                'productos'         => $actividad->productos()->orderBy('id')->get()->map(fn ($p) => [
                    'producto'   => $p->producto,
                    'nombre'     => $p->nombre,
                    'referencia' => $p->referencia,
                    'cantidad'   => (string) $p->cantidad,
                ]),
                'asesores'          => array_map('strval', array_keys($asesoresGuardados)),
                'checklist'         => DB::connection('mysql')->table('actividad_checklist')
                    ->where('actividad_id', $actividad->id)->pluck('checklist_item_id')->map(fn ($id) => (int) $id),
            ],
            'programacion' => [
                'id'           => $programacion->id,
                // Solo se agregan actividades al mes actual o a meses siguientes
                'admiteNuevas' => Carbon::create($programacion->anio, $programacion->mes, 1)->gte(now()->startOfMonth()),
                'agencia'      => $agencia->agennom,
                'regional'     => $programacion->regional,
                'mes'          => self::MESES[$programacion->mes - 1].' '.$programacion->anio,
                'coorRegional' => $personas[$programacion->coor_regional_id] ?? $programacion->coor_regional_id,
                'responsable'  => $personas[$programacion->responsable_id] ?? $programacion->responsable_id,
            ],
            'ejecucion' => [
                'horaInicio'     => $actividad->hora_inicio ? substr($actividad->hora_inicio, 0, 5) : null,
                'horaFin'        => $actividad->hora_fin ? substr($actividad->hora_fin, 0, 5) : null,
                'observaciones'  => $actividad->observaciones,
                'tieneFoto'      => (bool) $actividad->foto_inicio,
                // Archivo de finalización: foto o PDF (el PDF se muestra como enlace, no como miniatura)
                'archivoFin'     => $actividad->archivo_fin
                    ? (str_ends_with(strtolower($actividad->archivo_fin), '.pdf') ? 'pdf' : 'imagen')
                    : null,
                // Antes de la fecha programada no se puede iniciar
                'antesDeFecha'   => $actividad->fecha->gt(today()),
                'motivoAnulacion' => $actividad->estado === Actividad::ANULADA
                    ? $actividad->historial()->where('estado', Actividad::ANULADA)->latest('id')->value('observacion')
                    : null,
            ],
            'editable'        => $editable,
            'tipos'           => ActividadTipo::query()->orderBy('nombre')->get(['id', 'nombre']),
            'checklist'       => ChecklistItem::query()->where('activo', 1)->orderBy('id')->get(['id', 'nombre']),
            'asesores'        => $asesores->sortBy('nombre')->values(),
            'municipios'      => $municipios->sortBy('nombre')->values(),
            'inventario'      => $inventario ?? [],
            'inventarioError' => $inventario === null ? 'No se pudo consultar el inventario en Manager. Intente de nuevo en unos minutos.' : null,
            'historial'       => $this->historial($actividad),
        ];
    }

    // Guarda lo planeado del día: tipo, municipio, productos, asesores y checklist
    public function actualizar(Request $request, Actividad $actividad): void
    {
        if (! in_array($actividad->estado, self::ESTADOS_EDITABLES, true)) {
            throw new \DomainException("La actividad #{$actividad->id} está {$this->nombreEstado($actividad->estado)} y ya no se puede editar.");
        }

        $validator = Validator::make($request->all(), $this->detalleService->reglasDia(''), $this->detalleService->mensajesDia(''));
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }
        $datos = $validator->validated();

        $agencia = Agencia::query()->findOrFail($actividad->programacion->agencia_id);

        // Lo ya guardado sigue siendo válido aunque ya no tenga saldo, el asesor cambie de agencia
        // o el municipio ya no esté en la lista de la agencia
        $catalogos = $this->detalleService->catalogos($agencia, [
            'productos' => $actividad->productos()->get(['producto', 'nombre', 'referencia'])->toArray(),
            'asesores'  => $this->asesoresGuardados($actividad),
            'ciudad_id' => $actividad->ciudad_id,
        ]);

        $errores = $this->detalleService->erroresDia($datos, '', $catalogos);
        if ($errores !== []) {
            throw ValidationException::withMessages($errores);
        }

        $coduser = (string) $request->user()->coduser;

        DB::connection('mysql')->transaction(function () use ($actividad, $datos, $catalogos, $coduser) {
            $actividad->actividad_tipo_id = (int) $datos['actividad_tipo_id'];
            $actividad->ciudad_id         = (int) $datos['ciudad_id'];
            $actividad->user_update       = $coduser;
            $actividad->save();

            $this->detalleService->guardarDetalles($actividad, $datos, $catalogos);

            $historial = new ActividadHistorial();
            $historial->actividad_id = $actividad->id;
            $historial->estado       = $actividad->estado;
            $historial->observacion  = 'Actividad editada';
            $historial->user_new     = $coduser;
            $historial->save();
        });
    }

    // coduser => nombre de los asesores guardados en la actividad
    private function asesoresGuardados(Actividad $actividad): array
    {
        return DB::connection('mysql')->table('actividad_asesores')
            ->where('actividad_id', $actividad->id)->pluck('nombre', 'coduser')->all();
    }

    // "Buscar": por ID, nombre de agencia o nombre de municipio
    private function filtrarBusqueda($query, string $buscar): void
    {
        $agencias = Agencia::query()->where('agennom', 'like', "%{$buscar}%")->pluck('codagen');
        $municipios = Ciudad::query()->where('ciudad', 'like', "%{$buscar}%")->pluck('id');

        $query->where(function ($q) use ($buscar, $agencias, $municipios) {
            if (ctype_digit($buscar)) {
                $q->orWhere('a.id', (int) $buscar);
            }
            $q->orWhereIn('p.agencia_id', $agencias)->orWhereIn('a.ciudad_id', $municipios);
        });
    }

    // Opciones de los filtros según lo que ya se ha programado
    private function opcionesFiltros(): array
    {
        $codigos = ActividadProgramacion::query()->distinct()->pluck('agencia_id');

        $meses = ActividadProgramacion::query()
            ->select(['anio', 'mes'])->distinct()->get()
            ->toBase() // colección normal: vacía seguiría siendo de Eloquent y unique() fallaría con el texto del push
            ->map(fn ($p) => sprintf('%04d-%02d', $p->anio, $p->mes))
            ->push(now()->format('Y-m'))
            ->unique()->sortDesc()->values()
            ->map(fn ($valor) => [
                'valor'    => $valor,
                'etiqueta' => self::MESES[(int) substr($valor, 5, 2) - 1].' '.substr($valor, 0, 4),
            ]);

        return [
            'regionales' => ActividadProgramacion::query()->distinct()->orderBy('regional')->pluck('regional'),
            'agencias'   => Agencia::query()->whereIn('codagen', $codigos)->orderBy('agennom')->get(['codagen', 'agennom'])
                ->map(fn (Agencia $a) => ['codigo' => $a->codagen, 'nombre' => $a->agennom]),
            'meses'      => $meses,
            'estados'    => collect([Actividad::PROGRAMADA, Actividad::EN_PROCESO, Actividad::FINALIZADA, Actividad::ANULADA])
                ->map(fn ($e) => ['valor' => $e, 'etiqueta' => $this->nombreEstado($e)]),
        ];
    }

    private function historial(Actividad $actividad): array
    {
        $registros = $actividad->historial()->orderByDesc('id')->get();
        $usuarios = Usuario::query()->whereIn('coduser', $registros->pluck('user_new')->unique())->pluck('nombre', 'coduser');

        return $registros->map(fn (ActividadHistorial $h) => [
            'id'          => $h->id,
            'estado'      => $h->estado,
            'observacion' => $h->observacion,
            'usuario'     => $usuarios[$h->user_new] ?? $h->user_new,
            'fecha'       => $h->created_at?->format('Y-m-d H:i'),
        ])->all();
    }

    private function nombreEstado(string $estado): string
    {
        return match ($estado) {
            Actividad::PROGRAMADA => 'Programada',
            Actividad::EN_PROCESO => 'En proceso',
            Actividad::FINALIZADA => 'Finalizada',
            Actividad::ANULADA    => 'Anulada',
            default               => $estado,
        };
    }
}
