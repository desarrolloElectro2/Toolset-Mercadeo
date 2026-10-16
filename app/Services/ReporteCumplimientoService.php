<?php

namespace App\Services;

use App\Models\ActividadEstado;
use App\Models\Agencia;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Cumplimiento de las actividades programadas por Regional -> Agencia -> Mes (tipo "Cumplimiento" del reporte de actividades).
 * Toma las actividades cuya fecha está en el rango y las agrupa por el mes de su programación.
 *  - Cumplida: está en un estado con requiere_fin (FIN ACTIVIDAD).
 *  - Anulada:  está en el estado ANULADA; no cuenta para el porcentaje.
 *  - Pendiente: cualquier otro estado (programada, presupuesto autorizado, en proceso...).
 * % cumplimiento = cumplidas / (programadas - anuladas).
 */
class ReporteCumplimientoService
{
    /** Resumen en CSV (separado por ";" y con BOM para Excel en español), con subtotal por regional y total; rango y filtros ya validados */
    public function exportar(Carbon $desde, Carbon $hasta, array $filtros): StreamedResponse
    {
        $filas = $this->filas($desde, $hasta, $filtros);
        $nombre = "cumplimiento_actividades_{$desde->format('Ymd')}_{$hasta->format('Ymd')}.csv";

        return response()->streamDownload(function () use ($filas) {
            $salida = fopen('php://output', 'w');
            fwrite($salida, "\xEF\xBB\xBF");
            fputcsv($salida, ['Regional', 'Agencia', 'Mes', 'Programadas', 'Cumplidas', 'Pendientes', 'Anuladas', '% cumplimiento', 'Presupuesto asignado', 'Presupuesto autorizado'], ';');

            $linea = fn (string $regional, string $agencia, string $mes, array $f) => fputcsv($salida, [
                $regional, $agencia, $mes,
                $f['programadas'], $f['cumplidas'], $f['pendientes'], $f['anuladas'],
                $f['porcentaje'] === null ? '' : number_format($f['porcentaje'], 1, ',', ''),
                number_format($f['presupuestoAsignado'], 2, ',', ''),
                number_format($f['presupuestoAutorizado'], 2, ',', ''),
            ], ';');

            foreach ($this->porRegional($filas) as $regional) {
                foreach ($regional['filas'] as $f) {
                    $linea($regional['regional'], $f['agenciaNombre'], $f['mes'], $f);
                }
                $linea($regional['regional'], 'SUBTOTAL', '', $regional['total']);
            }
            fputcsv($salida, [], ';');
            $linea('TOTAL', '', '', $this->sumar($filas));

            fclose($salida);
        }, $nombre, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Una fila por agencia y mes programado, ordenadas por regional, agencia y mes */
    private function filas(Carbon $desde, Carbon $hasta, array $filtros): Collection
    {
        $cumplidas = ActividadEstado::query()->where('requiere_fin', true)->pluck('codigo')->all();

        // Presupuesto del checklist sumado por actividad, para no multiplicar el conteo de actividades
        $presupuesto = DB::connection('mysql')->table('actividad_checklist')
            ->groupBy('actividad_id')
            ->selectRaw('actividad_id, sum(presupuesto_asignado) as asignado, sum(presupuesto_autorizado) as autorizado');

        $filas = DB::connection('mysql')->table('actividad_programaciones as p')
            ->join('actividades as a', 'a.programacion_id', '=', 'p.id')
            ->leftJoinSub($presupuesto, 'c', 'c.actividad_id', '=', 'a.id')
            ->whereBetween('a.fecha', [$desde->toDateString(), $hasta->toDateString()])
            ->when($filtros['regional'] !== '', fn ($q) => $q->where('p.regional', $filtros['regional']))
            ->when($filtros['agencia'] !== '', fn ($q) => $q->where('p.agencia_id', $filtros['agencia']))
            ->groupBy('p.regional', 'p.agencia_id', 'p.anio', 'p.mes')
            ->orderBy('p.regional')->orderBy('p.agencia_id')->orderBy('p.anio')->orderBy('p.mes')
            ->select(['p.regional', 'p.agencia_id', 'p.anio', 'p.mes'])
            ->selectRaw('count(*) as programadas')
            ->selectRaw('sum(case when a.estado = ? then 1 else 0 end) as anuladas', [EstadoActividadService::ANULADA])
            ->when(
                $cumplidas !== [],
                fn ($q) => $q->selectRaw('sum(case when a.estado in ('.implode(',', array_fill(0, count($cumplidas), '?')).') then 1 else 0 end) as cumplidas', $cumplidas),
                fn ($q) => $q->selectRaw('0 as cumplidas'),
            )
            ->selectRaw('coalesce(sum(c.asignado), 0) as asignado, coalesce(sum(c.autorizado), 0) as autorizado')
            ->get();

        $nombres = Agencia::query()->whereIn('codagen', $filas->pluck('agencia_id')->unique())->pluck('agennom', 'codagen');

        return $filas->map(fn ($f) => $this->conPorcentaje([
            'regional'              => (string) $f->regional,
            'agencia'               => (string) $f->agencia_id,
            'agenciaNombre'         => $nombres[$f->agencia_id] ?? (string) $f->agencia_id,
            'mes'                   => sprintf('%04d-%02d', $f->anio, $f->mes),
            'programadas'           => (int) $f->programadas,
            'cumplidas'             => (int) $f->cumplidas,
            'anuladas'              => (int) $f->anuladas,
            'presupuestoAsignado'   => (float) $f->asignado,
            'presupuestoAutorizado' => (float) $f->autorizado,
        ]))
            // Dentro de cada regional, por nombre de agencia y mes
            ->sortBy([['regional', 'asc'], ['agenciaNombre', 'asc'], ['mes', 'asc']])
            ->values();
    }

    /** Agrupa las filas por regional con su subtotal */
    private function porRegional(Collection $filas): array
    {
        return $filas->groupBy('regional')->map(fn (Collection $grupo, string $regional) => [
            'regional' => $regional,
            'filas'    => $grupo->values()->all(),
            'total'    => $this->sumar($grupo),
        ])->values()->all();
    }

    private function sumar(Collection $filas): array
    {
        return $this->conPorcentaje([
            'programadas'           => $filas->sum('programadas'),
            'cumplidas'             => $filas->sum('cumplidas'),
            'anuladas'              => $filas->sum('anuladas'),
            'presupuestoAsignado'   => (float) $filas->sum('presupuestoAsignado'),
            'presupuestoAutorizado' => (float) $filas->sum('presupuestoAutorizado'),
        ]);
    }

    // Pendientes y % (null si todo lo programado se anuló)
    private function conPorcentaje(array $fila): array
    {
        $validas = $fila['programadas'] - $fila['anuladas'];
        $fila['pendientes'] = $validas - $fila['cumplidas'];
        $fila['porcentaje'] = $validas > 0 ? round($fila['cumplidas'] * 100 / $validas, 1) : null;

        return $fila;
    }
}
