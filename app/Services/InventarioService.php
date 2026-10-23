<?php

namespace App\Services;

use App\Models\Agencia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Inventario por bodega desde Manager ERP (PostgreSQL, electro.probodega). Solo lectura.
 * probodega guarda la existencia ya calculada por producto, bodega, cuenta y lote. No se usa la vista
 * vw_inventario_bod: suma todo el histórico de movimientos (mngmcn, sin índice por bodega) y tarda casi un minuto.
 */
class InventarioService
{
    /**
     * Productos con saldo en la bodega de la agencia (agencia.codigo_bodega = probodega.pbdbodega), en las cuentas de inventario (14).
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
            // Sin trim() sobre la columna: en char la comparación ya ignora los espacios de relleno
            $filas = DB::connection('mng')
                ->table('electro.probodega as pb')
                ->join('electro.producto as p', 'p.procodigo', '=', 'pb.pbdproduct')
                ->selectRaw('trim(pb.pbdproduct) as producto, trim(p.pronombre) as nombre, sum(pb.pbdexiste) as saldo')
                ->where('pb.pbdbodega', $bodega)
                ->whereBetween('pb.pbdcuenta', ['14', '14ZZ'])
                ->where('pb.pbdproduct', '<>', '.')
                ->where('pb.pbdexiste', '>', 0)
                ->groupByRaw('trim(pb.pbdproduct), trim(p.pronombre)') // una fila por empresa, cuenta y lote
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
