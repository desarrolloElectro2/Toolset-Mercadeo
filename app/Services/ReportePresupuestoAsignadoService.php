<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadTipo;
use App\Models\Agencia;
use App\Models\Ciudad;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Reporte desde la lista de actividades: solo las que están en PRESUPUESTO ASIGNADO (ni antes ni después),
 * con los mismos filtros de la lista (buscar, regional, agencia, mes; el filtro de estado se ignora).
 * Una fila por elemento del checklist con su presupuesto asignado, y el total al final. Se descarga en CSV para Excel.
 */
class ReportePresupuestoAsignadoService
{
    // Columnas del reporte: clave de la fila => título
    private const COLUMNAS = [
        'id'          => 'ID actividad',
        'fecha'       => 'Fecha',
        'regional'    => 'Regional',
        'agencia'     => 'Agencia',
        'municipio'   => 'Municipio',
        'tipo'        => 'Tipo de actividad',
        'responsable' => 'Responsable mercadeo',
        'estado'      => 'Estado',
        'elemento'    => 'Elemento checklist',
        'presupuesto' => 'Presupuesto asignado',
    ];

    public function __construct(
        private ActividadService $actividadService,
        private EstadoActividadService $estadoService,
    ) {
    }

    /** CSV separado por ";" y con BOM para que Excel en español lo abra con tildes y columnas */
    public function exportar(Request $request): StreamedResponse
    {
        $filtros = ['estado' => EstadoActividadService::PRESUPUESTO_ASIGNADO] + $this->actividadService->filtrosLista($request);
        $nombre = 'presupuesto_asignado_'.($filtros['mes'] === 'todos' ? 'todos' : str_replace('-', '', $filtros['mes'])).'.csv';

        return response()->streamDownload(function () use ($filtros) {
            $salida = fopen('php://output', 'w');
            fwrite($salida, "\xEF\xBB\xBF");
            fputcsv($salida, array_values(self::COLUMNAS), ';');

            $actividades = 0;
            $total = 0.0;
            $this->actividadService->consultaLista($filtros)->chunk(500, function ($lote) use ($salida, &$actividades, &$total) {
                foreach ($this->filas($lote) as $fila) {
                    fputcsv($salida, array_map(fn ($clave) => $this->textoCsv($fila[$clave]), array_keys(self::COLUMNAS)), ';');
                    $total += $fila['presupuesto'];
                }
                $actividades += $lote->count();
            });

            $fila = array_fill_keys(array_keys(self::COLUMNAS), '');
            $fila['id'] = 'TOTAL';
            $fila['fecha'] = "{$actividades} actividad(es)";
            $fila['presupuesto'] = $this->textoCsv($total);
            fputcsv($salida, [], ';');
            fputcsv($salida, array_values($fila), ';');

            fclose($salida);
        }, $nombre, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * Una fila por elemento del checklist con presupuesto asignado; los nombres de otras BD se buscan una sola vez por lote.
     *
     * @param  Collection<int, Actividad>  $actividades
     */
    private function filas(Collection $actividades): array
    {
        $agencias = Agencia::query()->whereIn('codagen', $actividades->pluck('agencia_id')->unique())->pluck('agennom', 'codagen');
        $municipios = Ciudad::query()->whereIn('id', $actividades->pluck('ciudad_id')->unique())->pluck('ciudad', 'id');
        $tipos = ActividadTipo::query()->pluck('nombre', 'id');
        $usuarios = Usuario::query()->whereIn('coduser', $actividades->pluck('responsable_id')->unique())->pluck('nombre', 'coduser');
        $checklist = DB::connection('mysql')->table('actividad_checklist')
            ->whereIn('actividad_id', $actividades->pluck('id'))
            ->where('presupuesto_asignado', '>', 0)
            ->orderBy('id')->get()->groupBy('actividad_id');

        return $actividades->flatMap(fn (Actividad $a) => $checklist->get($a->id, collect())->map(fn ($c) => [
            'id'          => $a->id,
            'fecha'       => $a->fecha->format('Y-m-d'),
            'regional'    => $a->regional,
            'agencia'     => $agencias[$a->agencia_id] ?? $a->agencia_id,
            'municipio'   => $municipios[$a->ciudad_id] ?? '',
            'tipo'        => $tipos[$a->actividad_tipo_id] ?? '',
            'responsable' => $usuarios[$a->responsable_id] ?? (string) $a->responsable_id,
            'estado'      => $this->estadoService->nombre($a->estado),
            'elemento'    => $c->nombre,
            'presupuesto' => (float) $c->presupuesto_asignado,
        ]))->values()->all();
    }

    // Los números van con coma decimal para que Excel en español los tome como número
    private function textoCsv(mixed $valor): string
    {
        return is_float($valor) ? number_format($valor, 2, ',', '') : (string) $valor;
    }
}
