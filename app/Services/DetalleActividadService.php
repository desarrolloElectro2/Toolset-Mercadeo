<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadProducto;
use App\Models\ActividadTipo;
use App\Models\Agencia;
use App\Models\ChecklistItem;
use App\Models\Ciudad;
use App\Models\Usuario;
use Illuminate\Support\Facades\DB;

// Lo que comparten crear y editar una actividad (un día): catálogos por agencia, validación y guardado de detalles
class DetalleActividadService
{
    public function __construct(private InventarioService $inventarioService)
    {
    }

    /**
     * Municipios de la agencia: los de sus correrías (toolset_perf.correrias).
     * Si la agencia no tiene correrías, los del departamento de la agencia.
     *
     * @return array{municipios: array<int, array{id: int, nombre: string}>, origen: string}
     */
    public function municipiosDeAgencia(Agencia $agencia): array
    {
        $ids = DB::connection('toolset_perf')->table('correrias')
            ->where('agencia_id', $agencia->codagen)
            ->where('ciudad_id', '<>', 0)
            ->distinct()
            ->pluck('ciudad_id');

        $origen = 'correrias';
        $consulta = Ciudad::query()->whereIn('id', $ids);

        if ($ids->isEmpty()) {
            $origen = 'departamento';
            $consulta = Ciudad::query()->where('departamento', (int) $agencia->departamento_id);
        }

        return [
            'municipios' => $consulta->orderBy('ciudad')->get(['id', 'ciudad'])
                ->map(fn (Ciudad $c) => ['id' => (int) $c->id, 'nombre' => $c->ciudad])
                ->all(),
            'origen'     => $origen,
        ];
    }

    /**
     * Asesores de la agencia: usuarios activos de toolset_perf con perfil ASESOR que pertenecen a la agencia
     * o la tienen en las agencias asignadas de su perfil (mismo criterio que Correrías).
     *
     * @return array<int, array{coduser: string, nombre: string}>
     */
    public function asesoresDeAgencia(string $codagen): array
    {
        return Usuario::query()
            ->join('roles as r', 'usuarios.nivel', '=', 'r.codrol')
            ->where('r.tipo_rol', 'ASESOR')
            ->where('usuarios.useractivo', '1')
            ->where(fn ($q) => $q
                ->where('usuarios.agencia', $codagen)
                ->orWhere('r.agencias_asignadas', 'like', '%"'.$codagen.'"%'))
            ->orderBy('usuarios.nombre')
            ->get(['usuarios.coduser', 'usuarios.nombre'])
            ->map(fn ($u) => ['coduser' => (string) $u->coduser, 'nombre' => $u->nombre])
            ->all();
    }

    /**
     * Catálogos válidos para las actividades de una agencia.
     * $guardados: lo que la actividad ya tenía (productos, asesores, municipio); sigue siendo válido
     * aunque ya no tenga saldo, el asesor cambie de agencia o el municipio ya no esté en la lista.
     */
    public function catalogos(Agencia $agencia, array $guardados = []): array
    {
        $inventario = $this->inventarioService->productosDeAgencia($agencia);

        // Unión con "+" (no merge): los códigos son numéricos y merge() renumeraría las claves.
        // Prima el dato actual; lo guardado solo completa lo que ya no aparece.
        $productos = collect($inventario ?? [])->keyBy('producto')->all()
            + collect($guardados['productos'] ?? [])->keyBy('producto')->all();

        $asesores = collect($this->asesoresDeAgencia($agencia->codagen))->pluck('nombre', 'coduser')->all()
            + ($guardados['asesores'] ?? []);

        $municipios = collect($this->municipiosDeAgencia($agencia)['municipios'])->pluck('id')->all();
        if (isset($guardados['ciudad_id'])) {
            $municipios[] = (int) $guardados['ciudad_id'];
        }

        return [
            'tipos'      => ActividadTipo::query()->where('activo', 1)->pluck('id')->all(),
            'municipios' => $municipios,
            'asesores'   => $asesores,   // coduser => nombre
            'checklist'  => ChecklistItem::query()->where('activo', 1)->pluck('id')->all(),
            'inventario' => $inventario, // null = Manager no respondió
            'productos'  => $productos,  // código => [producto, nombre, referencia, ...]
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
            $errores[$campo('ciudad_id')] = 'El municipio no corresponde a la agencia.';
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

        // Las claves de un arreglo PHP pueden volverse enteros ('20' -> 20): se comparan como texto
        $asesoresValidos = array_map('strval', array_keys($catalogos['asesores']));
        if (array_diff(array_map('strval', $dia['asesores'] ?? []), $asesoresValidos)) {
            $errores[$campo('asesores')] = 'Hay asesores que no pertenecen a la agencia.';
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
            "{$p}asesores.*"             => ['string', 'max:7'], // coduser de toolset_perf
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
            collect($dia['asesores'] ?? [])->map('strval')->unique()->map(fn ($coduser) => [
                'actividad_id' => $actividad->id,
                'coduser'      => $coduser,
                'nombre'       => mb_substr((string) $catalogos['asesores'][$coduser], 0, 200),
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
