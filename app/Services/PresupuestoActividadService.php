<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadHistorial;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Presupuesto del checklist mercadeo: PROGRAMADA -> PRESUPUESTO ASIGNADO -> PRESUPUESTO AUTORIZADO.
 *  - Asignar:   la actividad está en el estado inicial y su checklist suma presupuesto asignado > 0.
 *  - Autorizar: la actividad está en PRESUPUESTO ASIGNADO; el asignado de cada elemento pasa al autorizado.
 * Desde la lista se hace en lote (todo o nada); desde Estado Mercadeo, de a una con las mismas reglas.
 * Una vez autorizado, el checklist ya no se puede cambiar.
 */
class PresupuestoActividadService
{
    private const MAX_LOTE = 100;

    public function __construct(private EstadoActividadService $estadoService)
    {
    }

    /** @return string Mensaje para el usuario */
    public function asignarLote(Request $request): string
    {
        return $this->procesarLote($request, EstadoActividadService::PRESUPUESTO_ASIGNADO);
    }

    /** @return string Mensaje para el usuario */
    public function autorizarLote(Request $request): string
    {
        return $this->procesarLote($request, EstadoActividadService::PRESUPUESTO_AUTORIZADO);
    }

    /** Total del presupuesto asignado por actividad: id => total */
    public function totalesAsignados(array $ids): array
    {
        return DB::connection('mysql')->table('actividad_checklist')
            ->whereIn('actividad_id', $ids)
            ->groupBy('actividad_id')
            ->selectRaw('actividad_id, coalesce(sum(presupuesto_asignado), 0) as total')
            ->pluck('total', 'actividad_id')
            ->map(fn ($total) => (float) $total)
            ->all();
    }

    /** Acción de presupuesto que admite la actividad desde la lista: 'asignar', 'autorizar' o null */
    public function accionDisponible(string $estado, float $totalAsignado): ?string
    {
        return match (true) {
            $totalAsignado <= 0 => null,
            $estado === $this->estadoService->codigoInicial() => 'asignar',
            $estado === EstadoActividadService::PRESUPUESTO_ASIGNADO => 'autorizar',
            default => null,
        };
    }

    /** Si el checklist ya tiene presupuesto autorizado (desde ahí no se puede cambiar) */
    public function estaAutorizado(Actividad $actividad): bool
    {
        return DB::connection('mysql')->table('actividad_checklist')
            ->where('actividad_id', $actividad->id)->whereNotNull('presupuesto_autorizado')->exists();
    }

    /**
     * Antes de pasar una actividad a un estado de presupuesto (Estado Mercadeo o lote):
     * debe tener presupuesto asignado y, para autorizar, estar en PRESUPUESTO ASIGNADO. null = cumple.
     */
    public function motivoRechazo(Actividad $actividad, string $codigoDestino, ?float $totalAsignado = null): ?string
    {
        $totalAsignado ??= $this->totalesAsignados([$actividad->id])[$actividad->id] ?? 0.0;

        if ($codigoDestino === EstadoActividadService::PRESUPUESTO_ASIGNADO) {
            if ($actividad->estado !== $this->estadoService->codigoInicial()) {
                return "está en {$this->estadoService->nombre($actividad->estado)}";
            }
            if ($totalAsignado <= 0) {
                return 'no tiene presupuesto asignado en el checklist';
            }
        }

        if ($codigoDestino === EstadoActividadService::PRESUPUESTO_AUTORIZADO) {
            if ($actividad->estado !== EstadoActividadService::PRESUPUESTO_ASIGNADO) {
                return "está en {$this->estadoService->nombre($actividad->estado)}, no en {$this->estadoService->nombre(EstadoActividadService::PRESUPUESTO_ASIGNADO)}";
            }
            if ($totalAsignado <= 0) {
                return 'no tiene presupuesto asignado en el checklist';
            }
        }

        return null;
    }

    /** El presupuesto asignado de cada elemento del checklist pasa a ser el autorizado (dentro de la transacción del cambio de estado) */
    public function copiarAutorizado(Actividad $actividad): void
    {
        DB::connection('mysql')->table('actividad_checklist')
            ->where('actividad_id', $actividad->id)
            ->update(['presupuesto_autorizado' => DB::raw('presupuesto_asignado')]);
    }

    public static function pesos(float $valor): string
    {
        return '$'.number_format($valor, 0, ',', '.');
    }

    private function procesarLote(Request $request, string $codigoDestino): string
    {
        $validator = Validator::make($request->all(), [
            'ids'   => ['required', 'array', 'min:1', 'max:'.self::MAX_LOTE],
            'ids.*' => ['integer', 'distinct'],
        ], [
            'ids.required' => 'Seleccione al menos una actividad.',
            'ids.min'      => 'Seleccione al menos una actividad.',
            'ids.max'      => 'Se pueden procesar máximo '.self::MAX_LOTE.' actividades a la vez.',
        ]);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $destino = $this->estadoService->porCodigo($codigoDestino);
        if ($destino === null) {
            throw new \DomainException("El estado {$codigoDestino} no existe en Configuración › Estados actividad.");
        }

        $ids = array_map('intval', $validator->validated()['ids']);
        $coduser = (string) $request->user()->coduser;
        $autorizar = $codigoDestino === EstadoActividadService::PRESUPUESTO_AUTORIZADO;

        // Las actividades quedan bloqueadas mientras se revisan y cambian (nadie más las procesa a la vez)
        return DB::connection('mysql')->transaction(function () use ($ids, $codigoDestino, $destino, $coduser, $autorizar) {
            /** @var Collection<int, Actividad> $actividades */
            $actividades = Actividad::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $totales = $this->totalesAsignados($ids);

            // Todo o nada: si alguna no cumple, no se procesa ninguna
            $rechazos = [];
            foreach ($ids as $id) {
                $actividad = $actividades->get($id);
                $motivo = $actividad === null
                    ? 'no existe'
                    : $this->motivoRechazo($actividad, $codigoDestino, $totales[$id] ?? 0.0);
                if ($motivo !== null) {
                    $rechazos[] = "#{$id} {$motivo}";
                }
            }
            if ($rechazos !== []) {
                throw new \DomainException('No se procesó ninguna actividad: '.implode('; ', $rechazos).'.');
            }

            foreach ($actividades as $actividad) {
                if ($autorizar) {
                    $this->copiarAutorizado($actividad);
                }

                $actividad->estado      = $codigoDestino;
                $actividad->user_update = $coduser;
                $actividad->save();

                $historial = new ActividadHistorial();
                $historial->actividad_id = $actividad->id;
                $historial->estado       = $codigoDestino;
                $historial->observacion  = "Cambio a {$destino->nombre}: ".self::pesos($totales[$actividad->id]).' (en lote)';
                $historial->user_new     = $coduser;
                $historial->save();
            }

            $total = array_sum(array_intersect_key($totales, $actividades->all()));

            return "{$actividades->count()} actividad(es) pasaron a {$destino->nombre} por ".self::pesos($total).'.';
        });
    }
}
