<?php

namespace App\Services;

use App\Models\Agencia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

// Inventario por bodega desde Manager ERP (PostgreSQL, electro.vw_inventario_bod). Solo lectura.
class InventarioService
{
    /**
     * Productos con saldo en la bodega de la agencia (agencia.codigo_bodega = vw_inventario_bod.bodega).
     * Devuelve null si Manager no responde, para que la pantalla lo informe en vez de mostrar "sin productos".
     *
     * @return array<int, array{producto: string, nombre: string, referencia: ?string, saldo: int}>|null
     */
    public function productosDeAgencia(Agencia $agencia): ?array
    {
        $bodega = trim((string) $agencia->codigo_bodega);

        if ($bodega === '') {
            return [];
        }

        try {
            $filas = DB::connection('mng')
                ->table('electro.vw_inventario_bod')
                ->selectRaw('trim(producto) as producto, trim(pronombre) as nombre, sum(saldo) as saldo')
                ->whereRaw('trim(bodega) = ?', [$bodega])
                ->where('saldo', '>', 0)
                ->groupByRaw('trim(producto), trim(pronombre)') // la vista trae una fila por lote
                ->orderBy('nombre')
                ->get();
        } catch (\Throwable $e) {
            Log::error("No se pudo consultar el inventario de Manager (bodega {$bodega}): ".$e->getMessage());

            return null;
        }

        return $filas->map(fn ($fila) => [
            'producto'   => $fila->producto,
            'nombre'     => $this->limpiar($fila->nombre),
            'referencia' => $this->referencia($fila->nombre),
            'saldo'      => (int) $fila->saldo,
        ])->all();
    }

    // En Manager la referencia va al final del nombre: "CONGELADOR JLC 288LT :: JLC-384"
    private function referencia(string $nombre): ?string
    {
        $partes = explode('::', $nombre, 2);

        return isset($partes[1]) ? $this->limpiar($partes[1]) : null;
    }

    // Quita espacios duros (U+00A0) y espacios repetidos que vienen de Manager
    private function limpiar(string $texto): string
    {
        return trim(preg_replace('/\s+/u', ' ', str_replace("\u{00A0}", ' ', $texto)));
    }
}
