<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\Usuario;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Prospectos y perfilaciones (toolset_perf) que crearon, el día de la actividad, los asesores asignados a ella.
 *
 * Los asesores se guardan por coduser (toolset_perf) o por cédula + código de vendedor (Manager), así que se buscan:
 *  - prospectos.user_new                         = coduser del asesor
 *  - perfilacion.user_new / vendedor_id          = coduser del asesor
 *  - perfilacion.pervende                        = código de vendedor del asesor
 * Para los de Manager, el coduser se busca en toolset_perf.usuarios por cédula.
 */
class ProspectosActividadService
{
    /**
     * @return array{prospectos: array, perfilaciones: array, error: ?string}
     */
    public function delDia(Actividad $actividad): array
    {
        $asesores = DB::connection('mysql')->table('actividad_asesores')->where('actividad_id', $actividad->id)->get(['coduser', 'nombre', 'vendedor_cod']);
        if ($asesores->isEmpty()) {
            return ['prospectos' => [], 'perfilaciones' => [], 'error' => null];
        }

        try {
            [$codusers, $vendedores, $nombres] = $this->identificar($asesores);
            $dia = [Carbon::parse($actividad->fecha)->startOfDay(), Carbon::parse($actividad->fecha)->endOfDay()];

            return [
                'prospectos'    => $this->prospectos($codusers, $dia, $nombres),
                'perfilaciones' => $this->perfilaciones($codusers, $vendedores, $dia, $nombres),
                'error'         => null,
            ];
        } catch (\Throwable $e) {
            Log::error("No se pudieron consultar prospectos y perfilaciones de la actividad #{$actividad->id}: ".$e->getMessage());

            return ['prospectos' => [], 'perfilaciones' => [], 'error' => 'No se pudieron consultar los prospectos y perfilaciones. Intente de nuevo.'];
        }
    }

    /**
     * Usuarios (coduser) y códigos de vendedor de los asesores, y el nombre de cada asesor por coduser.
     *
     * @return array{0: string[], 1: string[], 2: array<string, string>}
     */
    private function identificar(Collection $asesores): array
    {
        $codigos = $asesores->pluck('coduser')->map('strval');
        $usuarios = Usuario::query()
            ->where(fn ($q) => $q->whereIn('coduser', $codigos)->orWhereIn('cedula', $codigos))
            ->get(['coduser', 'cedula', 'cod_vendedor', 'nombre']);

        $codusers = $usuarios->pluck('coduser')->map('strval')->unique()->values()->all();
        $vendedores = $asesores->pluck('vendedor_cod')->merge($usuarios->pluck('cod_vendedor'))
            ->map(fn ($v) => trim((string) $v))->filter()->unique()->values()->all();

        // Nombre del asesor tal como se guardó en la actividad
        $porCodigo = $asesores->pluck('nombre', 'coduser');
        $nombres = $usuarios->mapWithKeys(fn ($u) => [(string) $u->coduser => $porCodigo[$u->coduser] ?? $porCodigo[$u->cedula] ?? $u->nombre])->all();

        return [$codusers, $vendedores, $nombres];
    }

    private function prospectos(array $codusers, array $dia, array $nombres): array
    {
        if ($codusers === []) {
            return [];
        }

        $estados = DB::connection('toolset_perf')->table('seguimiento_estados')->pluck('nombre', 'id');

        return DB::connection('toolset_perf')->table('prospectos')
            ->whereIn('user_new', $codusers)
            ->whereBetween('created_at', $dia)
            ->orderBy('created_at')
            ->get(['id', 'identificacion', 'nombre', 'celular', 'agencia_id', 'seguimiento_estado_id', 'user_new', 'created_at'])
            ->map(fn ($p) => [
                'id'            => (int) $p->id,
                'hora'          => substr((string) $p->created_at, 11, 5),
                'nombre'        => $p->nombre,
                'identificacion' => $p->identificacion,
                'celular'       => $p->celular,
                'estado'        => $estados[$p->seguimiento_estado_id] ?? '',
                'asesor'        => $nombres[$p->user_new] ?? $p->user_new,
            ])->all();
    }

    private function perfilaciones(array $codusers, array $vendedores, array $dia, array $nombres): array
    {
        if ($codusers === [] && $vendedores === []) {
            return [];
        }

        $filas = DB::connection('toolset_perf')->table('perfilacion as p')
            ->leftJoin('vinculado as v', 'v.vinced', '=', 'p.vinced')
            ->leftJoin('estadoper as e', 'e.estadocod', '=', 'p.estadocod')
            ->where('p.perfecnew', $dia[0]->toDateString()) // fecha de la perfilación (tiene índice; created_at no)
            ->where(fn ($q) => $q
                ->when($codusers !== [], fn ($q) => $q->whereIn('p.user_new', $codusers)->orWhereIn('p.vendedor_id', $codusers))
                ->when($vendedores !== [], fn ($q) => $q->orWhereIn('p.pervende', $vendedores)))
            ->orderBy('p.created_at')
            ->get(['p.codper', 'p.vinced', 'p.pervlrcred', 'p.pervende', 'p.pervendenom', 'p.user_new', 'p.created_at',
                'v.vinnom', 'v.vinape', 'v.vinape2', 'e.estadonom']);

        return $filas->unique('codper')->map(fn ($p) => [
            'codper'  => (int) $p->codper,
            'hora'    => substr((string) $p->created_at, 11, 5),
            'cedula'  => $p->vinced,
            'cliente' => trim(implode(' ', array_filter([$p->vinnom, $p->vinape, $p->vinape2]))),
            'valor'   => (float) $p->pervlrcred,
            'estado'  => $p->estadonom && $p->estadonom !== '.' ? $p->estadonom : '',
            // "NOMBRE :: LISTA 2" -> "NOMBRE"
            'asesor'  => $nombres[$p->user_new] ?? trim(explode('::', (string) $p->pervendenom)[0]),
        ])->values()->all();
    }
}
