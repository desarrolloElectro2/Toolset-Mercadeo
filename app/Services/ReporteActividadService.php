<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadTipo;
use App\Models\Agencia;
use App\Models\Ciudad;
use App\Models\Usuario;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Reporte de actividades entre dos fechas (fecha de la actividad), filtrable por regional y agencia. Dos tipos:
 *  - general:      cada actividad con su presupuesto (checklist mercadeo).
 *  - cumplimiento: programadas vs. cumplidas por regional, agencia y mes (ReporteCumplimientoService).
 * Ambos se descargan en CSV para Excel (no se muestran en pantalla).
 */
class ReporteActividadService
{
    private const MAX_DIAS = 366;
    private const TIPOS = ['general', 'cumplimiento'];

    // Columnas del reporte: clave de la fila => título (en este orden en pantalla y en el CSV)
    public const COLUMNAS = [
        'id'                    => 'ID',
        'fecha'                 => 'Fecha',
        'regional'              => 'Regional',
        'agencia'               => 'Agencia',
        'municipio'             => 'Municipio',
        'tipo'                  => 'Tipo de actividad',
        'estado'                => 'Estado',
        'coorRegional'          => 'Coordinador regional',
        'responsableMercadeo'   => 'Responsable mercadeo',
        'tipoResponsable'       => 'Tipo de responsable',
        'responsableEvento'     => 'Responsable evento',
        'cedulaResponsable'     => 'Cédula responsable evento',
        'horaInicio'            => 'Hora inicio',
        'asesores'              => 'Asesores',
        'productos'             => 'Productos',
        'elementos'             => 'Checklist (presupuesto asignado)',
        'presupuestoAsignado'   => 'Presupuesto asignado',
        'presupuestoAutorizado' => 'Presupuesto autorizado',
        'observaciones'         => 'Observaciones',
        'creadaPor'             => 'Creada por',
        'fechaCreacion'         => 'Fecha creación',
    ];

    public function __construct(
        private EstadoActividadService $estadoService,
        private ResponsableAgenciaService $responsableService,
        private ReporteCumplimientoService $cumplimientoService,
    ) {
    }

    /** Datos de la pantalla: filtros (el reporte no se muestra, se descarga) y agencias para los selects */
    public function pantalla(Request $request): array
    {
        return ['filtros' => $this->filtros($request), 'agencias' => $this->agencias()];
    }

    /** Todo el rango en CSV (separado por ";" y con BOM para que Excel en español lo abra con tildes y columnas) */
    public function exportar(Request $request): StreamedResponse
    {
        $filtros = $this->filtros($request);
        [$desde, $hasta] = $this->validarRango($filtros);
        if ($filtros['tipo'] === 'cumplimiento') {
            return $this->cumplimientoService->exportar($desde, $hasta, $filtros);
        }
        $nombre = "reporte_actividades_{$desde->format('Ymd')}_{$hasta->format('Ymd')}.csv";

        return response()->streamDownload(function () use ($desde, $hasta, $filtros) {
            $salida = fopen('php://output', 'w');
            fwrite($salida, "\xEF\xBB\xBF");
            fputcsv($salida, array_values(self::COLUMNAS), ';');

            $this->consulta($desde, $hasta, $filtros)->chunk(500, function ($actividades) use ($salida) {
                foreach ($this->filas($actividades) as $fila) {
                    fputcsv($salida, array_map(fn ($clave) => $this->textoCsv($fila[$clave]), array_keys(self::COLUMNAS)), ';');
                }
            });

            // Fila de totales alineada con las columnas del presupuesto
            $totales = $this->totales($desde, $hasta, $filtros);
            $fila = array_fill_keys(array_keys(self::COLUMNAS), '');
            $fila['id'] = 'TOTAL';
            $fila['fecha'] = "{$totales['actividades']} actividad(es)";
            $fila['presupuestoAsignado'] = $this->textoCsv($totales['presupuestoAsignado']);
            $fila['presupuestoAutorizado'] = $this->textoCsv($totales['presupuestoAutorizado']);
            fputcsv($salida, [], ';');
            fputcsv($salida, array_values($fila), ';');

            fclose($salida);
        }, $nombre, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    // Fechas obligatorias; regional y agencia opcionales. Un tipo desconocido se toma como general.
    private function filtros(Request $request): array
    {
        $tipo = (string) $request->query('tipo', 'general');

        return [
            'tipo'     => in_array($tipo, self::TIPOS, true) ? $tipo : 'general',
            'desde'    => (string) $request->query('desde', ''),
            'hasta'    => (string) $request->query('hasta', ''),
            'regional' => (string) $request->query('regional', ''),
            'agencia'  => (string) $request->query('agencia', ''),
        ];
    }

    /** Agencias activas con su regional, para los selects de filtro */
    private function agencias(): array
    {
        return Agencia::query()->where('activo', 1)->whereNotNull('agenreg')->where('agenreg', '<>', '')
            ->orderBy('agenreg')->orderBy('agennom')
            ->get(['codagen', 'agennom', 'agenreg'])
            ->map(fn (Agencia $a) => ['codigo' => (string) $a->codagen, 'nombre' => $a->agennom, 'regional' => (string) $a->agenreg])
            ->all();
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function validarRango(array $filtros): array
    {
        $validator = Validator::make($filtros, [
            'desde' => ['required', 'date_format:Y-m-d'],
            'hasta' => ['required', 'date_format:Y-m-d', 'after_or_equal:desde'],
        ], [
            'desde.required'       => 'Digite la fecha desde.',
            'desde.date_format'    => 'La fecha desde no es válida.',
            'hasta.required'       => 'Digite la fecha hasta.',
            'hasta.date_format'    => 'La fecha hasta no es válida.',
            'hasta.after_or_equal' => 'La fecha hasta debe ser igual o posterior a la fecha desde.',
        ]);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $desde = Carbon::createFromFormat('Y-m-d', $filtros['desde'])->startOfDay();
        $hasta = Carbon::createFromFormat('Y-m-d', $filtros['hasta'])->startOfDay();
        if ($desde->diffInDays($hasta) > self::MAX_DIAS) {
            throw ValidationException::withMessages(['hasta' => 'El rango no puede ser mayor a un año.']);
        }

        return [$desde, $hasta];
    }

    private function consulta(Carbon $desde, Carbon $hasta, array $filtros): Builder
    {
        return Actividad::query()
            ->from('actividades as a')
            ->join('actividad_programaciones as p', 'p.id', '=', 'a.programacion_id')
            ->select(['a.*', 'p.agencia_id', 'p.regional', 'p.coor_regional_id', 'p.responsable_id'])
            ->whereBetween('a.fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->when($filtros['regional'] !== '', fn ($q) => $q->where('p.regional', $filtros['regional']))
            ->when($filtros['agencia'] !== '', fn ($q) => $q->where('p.agencia_id', $filtros['agencia']))
            ->orderBy('a.fecha')
            ->orderBy('a.id');
    }

    /** Cantidad de actividades y suma del presupuesto del checklist en el rango */
    private function totales(Carbon $desde, Carbon $hasta, array $filtros): array
    {
        $base = DB::connection('mysql')->table('actividades as a')
            ->join('actividad_programaciones as p', 'p.id', '=', 'a.programacion_id')
            ->whereBetween('a.fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->when($filtros['regional'] !== '', fn ($q) => $q->where('p.regional', $filtros['regional']))
            ->when($filtros['agencia'] !== '', fn ($q) => $q->where('p.agencia_id', $filtros['agencia']));

        $presupuesto = (clone $base)
            ->join('actividad_checklist as c', 'c.actividad_id', '=', 'a.id')
            ->selectRaw('coalesce(sum(c.presupuesto_asignado), 0) as asignado, coalesce(sum(c.presupuesto_autorizado), 0) as autorizado')
            ->first();

        return [
            'actividades'           => (clone $base)->count(),
            'presupuestoAsignado'   => (float) $presupuesto->asignado,
            'presupuestoAutorizado' => (float) $presupuesto->autorizado,
        ];
    }

    /**
     * Filas del reporte; los nombres de otras BD (agencias, municipios, usuarios, Manager) se buscan una sola vez por lote.
     *
     * @param  Collection<int, Actividad>  $actividades
     */
    private function filas(Collection $actividades): array
    {
        if ($actividades->isEmpty()) {
            return [];
        }

        $ids = $actividades->pluck('id')->all();
        $agencias = Agencia::query()->whereIn('codagen', $actividades->pluck('agencia_id')->unique())->pluck('agennom', 'codagen');
        $municipios = Ciudad::query()->whereIn('id', $actividades->pluck('ciudad_id')->unique())->pluck('ciudad', 'id');
        $tipos = ActividadTipo::query()->pluck('nombre', 'id');
        $usuarios = Usuario::query()
            ->whereIn('coduser', $actividades->pluck('coor_regional_id')->merge($actividades->pluck('responsable_id'))->filter()->unique())
            ->pluck('nombre', 'coduser');
        $responsablesEvento = $this->responsableService->nombres($actividades->pluck('responsable_evento_id')->all());

        $asesores = DB::connection('mysql')->table('actividad_asesores')->whereIn('actividad_id', $ids)->orderBy('nombre')->get()->groupBy('actividad_id');
        $productos = DB::connection('mysql')->table('actividad_productos')->whereIn('actividad_id', $ids)->orderBy('id')->get()->groupBy('actividad_id');
        $checklist = DB::connection('mysql')->table('actividad_checklist')->whereIn('actividad_id', $ids)->orderBy('id')->get()->groupBy('actividad_id');

        return $actividades->map(function (Actividad $a) use ($agencias, $municipios, $tipos, $usuarios, $responsablesEvento, $asesores, $productos, $checklist) {
            $elementos = $checklist->get($a->id, collect());

            return [
                'id'                    => $a->id,
                'fecha'                 => $a->fecha->format('Y-m-d'),
                'regional'              => $a->regional,
                'agencia'               => $agencias[$a->agencia_id] ?? $a->agencia_id,
                'municipio'             => $municipios[$a->ciudad_id] ?? '',
                'tipo'                  => $tipos[$a->actividad_tipo_id] ?? '',
                'estado'                => $this->estadoService->nombre($a->estado),
                'coorRegional'          => $usuarios[$a->coor_regional_id] ?? (string) $a->coor_regional_id,
                'responsableMercadeo'   => $usuarios[$a->responsable_id] ?? (string) $a->responsable_id,
                'tipoResponsable'       => $this->responsableService->nombreTipo($a->tipo_responsable) ?? '',
                'responsableEvento'     => $a->responsable_evento_id ? ($responsablesEvento[$a->responsable_evento_id] ?? $a->responsable_evento_id) : '',
                'cedulaResponsable'     => (string) $a->responsable_evento_id,
                'horaInicio'            => $a->hora_inicio ? substr($a->hora_inicio, 0, 5) : '',
                'asesores'              => $asesores->get($a->id, collect())->pluck('nombre')->implode(', '),
                'productos'             => $productos->get($a->id, collect())->map(fn ($p) => "{$p->nombre} x{$p->cantidad}")->implode(', '),
                'elementos'             => $elementos->map(fn ($c) => $c->nombre.($c->presupuesto_asignado !== null ? ' $'.number_format((float) $c->presupuesto_asignado, 0, ',', '.') : ''))->implode(', '),
                'presupuestoAsignado'   => (float) $elementos->sum(fn ($c) => (float) $c->presupuesto_asignado),
                'presupuestoAutorizado' => (float) $elementos->sum(fn ($c) => (float) $c->presupuesto_autorizado),
                'observaciones'         => (string) $a->observaciones,
                'creadaPor'             => (string) $a->user_new,
                'fechaCreacion'         => $a->created_at?->format('Y-m-d H:i') ?? '',
            ];
        })->values()->all();
    }

    // Los números van con coma decimal para que Excel en español los tome como número
    private function textoCsv(mixed $valor): string
    {
        return is_float($valor) ? number_format($valor, 2, ',', '') : (string) $valor;
    }
}
