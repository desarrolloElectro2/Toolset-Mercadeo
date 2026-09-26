<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadProducto;
use App\Models\ActividadTipo;
use App\Models\Agencia;
use App\Models\ChecklistItem;
use App\Models\Ciudad;
use App\Models\Vendedor;
use Illuminate\Support\Facades\DB;

// Lo que comparten crear y editar una actividad (un día): catálogos, validación y guardado de detalles
class DetalleActividadService
{
    public function __construct(private InventarioService $inventarioService)
    {
    }

    /**
     * Catálogos válidos para las actividades de una agencia.
     * $productosGuardados: productos que la actividad ya tenía; siguen siendo válidos aunque ya no tengan saldo.
     */
    public function catalogos(Agencia $agencia, array $productosGuardados = []): array
    {
        $inventario = $this->inventarioService->productosDeAgencia($agencia);

        // Unión con "+" (no merge): los códigos son numéricos y merge() renumeraría las claves.
        // Prima el dato actual de Manager; los guardados solo completan los que ya no tienen saldo.
        $productos = collect($inventario ?? [])->keyBy('producto')->all()
            + collect($productosGuardados)->keyBy('producto')->all();

        return [
            'tipos'      => ActividadTipo::query()->where('activo', 1)->pluck('id')->all(),
            'municipios' => Ciudad::query()->where('departamento', $agencia->departamento_id)->pluck('id')->all(),
            'asesores'   => Vendedor::query()->where('activo', 1)->pluck('nombre', 'id')->all(),
            'checklist'  => ChecklistItem::query()->where('activo', 1)->pluck('id')->all(),
            'inventario' => $inventario,   // null = Manager no respondió
            'productos'  => $productos, // código => [producto, nombre, referencia, ...]
        ];
    }

    // Reglas de un día; $prefijo es la ruta del campo en el formulario (ej. "actividades.3" o "")
    public function erroresDia(array $dia, string $prefijo, array $catalogos): array
    {
        $campo = fn (string $nombre) => ltrim("$prefijo.$nombre", '.');
        $errores = [];

        if (! in_array((int) $dia['actividad_tipo_id'], $catalogos['tipos'], true)) {
            $errores[$campo('actividad_tipo_id')] = 'El tipo de actividad no es válido.';
        }
        if (! in_array((int) $dia['ciudad_id'], $catalogos['municipios'], true)) {
            $errores[$campo('ciudad_id')] = 'El municipio no pertenece al departamento de la agencia.';
        }

        $vistos = [];
        foreach ($dia['productos'] ?? [] as $j => $item) {
            if (! isset($catalogos['productos'][$item['producto']])) {
                $errores[$campo("productos.$j.producto")] = $catalogos['inventario'] === null
                    ? 'No se pudo validar el inventario en Manager. Intente de nuevo.'
                    : 'El producto no está en el inventario de la agencia.';
            } elseif (in_array($item['producto'], $vistos, true)) {
                $errores[$campo("productos.$j.producto")] = 'El producto está repetido en este día.';
            }
            $vistos[] = $item['producto'];
        }

        if (array_diff(array_map('intval', $dia['asesores'] ?? []), array_keys($catalogos['asesores']))) {
            $errores[$campo('asesores')] = 'Hay asesores que no son válidos.';
        }
        if (array_diff(array_map('intval', $dia['checklist'] ?? []), $catalogos['checklist'])) {
            $errores[$campo('checklist')] = 'Hay elementos del checklist que no son válidos.';
        }

        return $errores;
    }

    // Reglas de formato de un día (para Validator::make)
    public function reglasDia(string $prefijo): array
    {
        $p = $prefijo === '' ? '' : "$prefijo.";

        return [
            "{$p}actividad_tipo_id"      => ['required', 'integer'],
            "{$p}ciudad_id"              => ['required', 'integer'],
            "{$p}productos"              => ['array'],
            "{$p}productos.*.producto"   => ['required', 'string'], // repetidos se validan en erroresDia
            "{$p}productos.*.cantidad"   => ['required', 'integer', 'min:1'],
            "{$p}asesores"               => ['array'],
            "{$p}asesores.*"             => ['integer'],
            "{$p}checklist"              => ['array'],
            "{$p}checklist.*"            => ['integer'],
        ];
    }

    public function mensajesDia(string $prefijo): array
    {
        $p = $prefijo === '' ? '' : "$prefijo.";

        return [
            "{$p}actividad_tipo_id.required"    => 'Seleccione el tipo de actividad.',
            "{$p}ciudad_id.required"            => 'Seleccione el municipio.',
            "{$p}productos.*.cantidad.required" => 'Digite la cantidad.',
            "{$p}productos.*.cantidad.integer"  => 'La cantidad debe ser un número entero.',
            "{$p}productos.*.cantidad.min"      => 'La cantidad debe ser mayor a cero.',
        ];
    }

    // Reemplaza productos, asesores y checklist de la actividad (sin llaves foráneas: se borra desde aquí)
    public function guardarDetalles(Actividad $actividad, array $dia, array $catalogos): void
    {
        $this->eliminarDetalles($actividad);

        foreach ($dia['productos'] ?? [] as $item) {
            $producto = $catalogos['productos'][$item['producto']];

            $detalle = new ActividadProducto();
            $detalle->actividad_id = $actividad->id;
            $detalle->producto     = $producto['producto'];
            $detalle->nombre       = mb_substr($producto['nombre'], 0, 200);
            $detalle->referencia   = $producto['referencia'] ? mb_substr($producto['referencia'], 0, 100) : null;
            $detalle->cantidad     = (int) $item['cantidad'];
            $detalle->save();
        }

        DB::connection('mysql')->table('actividad_asesores')->insert(
            collect($dia['asesores'] ?? [])->map('intval')->unique()->map(fn ($id) => [
                'actividad_id' => $actividad->id,
                'vendedor_id'  => $id,
                'nombre'       => mb_substr((string) $catalogos['asesores'][$id], 0, 200),
            ])->values()->all()
        );

        DB::connection('mysql')->table('actividad_checklist')->insert(
            collect($dia['checklist'] ?? [])->map('intval')->unique()->map(fn ($id) => [
                'actividad_id'      => $actividad->id,
                'checklist_item_id' => $id,
            ])->values()->all()
        );
    }

    public function eliminarDetalles(Actividad $actividad): void
    {
        ActividadProducto::query()->where('actividad_id', $actividad->id)->delete();
        DB::connection('mysql')->table('actividad_asesores')->where('actividad_id', $actividad->id)->delete();
        DB::connection('mysql')->table('actividad_checklist')->where('actividad_id', $actividad->id)->delete();
    }
}
