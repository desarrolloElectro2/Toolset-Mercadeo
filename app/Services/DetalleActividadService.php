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
use Illuminate\Support\Str;

// Lo que comparten crear y editar una actividad (un día): catálogos por agencia, validación y guardado de detalles
class DetalleActividadService
{
    /**
     * Tipos de actividad cuyos asesores salen de Manager (vw_tercero) en vez de toolset_perf:
     * nombre del tipo (sin tildes) => grupo de ResponsableAgenciaService::CARGOS_ASESORES.
     */
    public const TIPOS_ASESORES_MANAGER = [
        'ACTIVIDAD EN AGENCIA'  => 'planta',   // asesores de planta (E057)
        'ACTIVIDAD EN CORRERIA' => 'externos', // asesores externos (E058)
    ];

    public const TITULOS_ASESORES = ['planta' => 'Asesores de planta', 'externos' => 'Asesores externos'];

    public function __construct(
        private InventarioService $inventarioService,
        private ResponsableAgenciaService $responsableService,
    ) {
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
     * Id del tipo de actividad => grupo de asesores de Manager ('planta' | 'externos').
     * Se compara el nombre sin tildes: "ACTIVIDAD EN CORRERÍA" = "ACTIVIDAD EN CORRERIA".
     *
     * @return array<int, string>
     */
    public function gruposAsesores(): array
    {
        return ActividadTipo::query()->get(['id', 'nombre'])
            ->mapWithKeys(fn (ActividadTipo $t) => [(int) $t->id => self::TIPOS_ASESORES_MANAGER[Str::upper(Str::ascii(trim($t->nombre)))] ?? null])
            ->filter()
            ->all();
    }

    /**
     * Asesores de Manager de la agencia por grupo, con la forma de los demás asesores (coduser = cédula).
     * Un grupo en null = Manager no respondió.
     *
     * @return array<string, array<int, array{coduser: string, nombre: string, vendedor: ?string}>|null>
     */
    public function asesoresManager(Agencia $agencia): array
    {
        return collect(ResponsableAgenciaService::CARGOS_ASESORES)->map(function ($cargo, $grupo) use ($agencia) {
            $lista = $this->responsableService->asesores($agencia, $grupo);

            return $lista === null ? null : array_map(fn ($e) => ['coduser' => $e['cedula'], 'nombre' => $e['nombre'], 'vendedor' => $e['vendedor']], $lista);
        })->all();
    }

    /**
     * Catálogos válidos para las actividades de una agencia.
     * $guardados: lo que la actividad ya tenía (productos, asesores, municipio, responsable evento); sigue siendo
     * válido aunque ya no tenga saldo, el asesor o el responsable cambien de agencia o el municipio ya no esté en la lista.
     */
    public function catalogos(Agencia $agencia, array $guardados = []): array
    {
        $inventario = $this->inventarioService->productosDeAgencia($agencia);

        // Unión con "+" (no merge): los códigos son numéricos y merge() renumeraría las claves.
        // Prima el dato actual; lo guardado solo completa lo que ya no aparece.
        $productos = collect($inventario ?? [])->keyBy('producto')->all()
            + collect($guardados['productos'] ?? [])->keyBy('producto')->all();

        // Asesores válidos por fuente: coduser/cédula => ['nombre', 'vendedor'] (+ los que ya tenía la actividad)
        $guardadosAsesores = $guardados['asesores'] ?? [];
        $asesores = ['toolset' => collect($this->asesoresDeAgencia($agencia->codagen))
            ->mapWithKeys(fn ($a) => [$a['coduser'] => ['nombre' => $a['nombre'], 'vendedor' => null]])->all() + $guardadosAsesores];
        $asesoresError = [];
        foreach ($this->asesoresManager($agencia) as $grupo => $lista) {
            $asesoresError[$grupo] = $lista === null;
            $asesores[$grupo] = collect($lista ?? [])
                ->mapWithKeys(fn ($a) => [$a['coduser'] => ['nombre' => $a['nombre'], 'vendedor' => $a['vendedor']]])->all() + $guardadosAsesores;
        }

        $municipios = collect($this->municipiosDeAgencia($agencia)['municipios'])->pluck('id')->all();
        if (isset($guardados['ciudad_id'])) {
            $municipios[] = (int) $guardados['ciudad_id'];
        }

        // Responsables evento de Manager por tipo (null = Manager no respondió) + el que ya tenía la actividad
        $responsables = $this->responsableService->porAgencia($agencia);
        $guardado = $guardados['responsable_evento'] ?? null; // ['tipo' => ..., 'cedula' => ...]
        if ($responsables !== null && $guardado && isset($responsables[$guardado['tipo']])
            && ! collect($responsables[$guardado['tipo']])->contains('cedula', $guardado['cedula'])) {
            $responsables[$guardado['tipo']][] = ['cedula' => $guardado['cedula'], 'nombre' => $this->responsableService->nombre($guardado['cedula'])];
        }

        return [
            'tipos'      => ActividadTipo::query()->where('activo', 1)->pluck('id')->all(),
            'responsables' => $responsables, // tipo => [['cedula', 'nombre'], ...] | null
            'municipios' => $municipios,
            'asesores'      => $asesores,      // fuente ('toolset' | 'planta' | 'externos') => [coduser => ['nombre', 'vendedor']]
            'asesoresError' => $asesoresError, // grupo => Manager no respondió
            'gruposAsesores' => $this->gruposAsesores(), // tipo de actividad => grupo de Manager
            // Ítems fijos del checklist: id => nombre (activos + los que la actividad ya tenía)
            'checklist'  => ChecklistItem::query()
                ->where(fn ($q) => $q->where('activo', 1)->orWhereIn('id', $guardados['checklist'] ?? []))
                ->pluck('nombre', 'id')->all(),
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

        // Responsable evento: empleado activo de Manager de la agencia con el cargo del tipo escogido
        if (! isset(ResponsableAgenciaService::TIPOS[$dia['tipo_responsable']])) {
            $errores[$campo('tipo_responsable')] = 'El tipo de responsable no es válido.';
        } elseif ($catalogos['responsables'] === null) {
            $errores[$campo('responsable_evento_id')] = 'No se pudo validar el responsable evento en Manager. Intente de nuevo.';
        } elseif (! collect($catalogos['responsables'][$dia['tipo_responsable']])->contains('cedula', (string) $dia['responsable_evento_id'])) {
            $errores[$campo('responsable_evento_id')] = 'El responsable evento no corresponde a la agencia y al tipo seleccionado.';
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
        $asesoresValidos = array_map('strval', array_keys($this->asesoresDelDia($dia, $catalogos)));
        if (array_diff(array_map('strval', $dia['asesores'] ?? []), $asesoresValidos)) {
            $fuente = $this->fuenteAsesores($dia, $catalogos);
            $titulo = mb_strtolower(self::TITULOS_ASESORES[$fuente] ?? 'asesores');
            $errores[$campo('asesores')] = match (true) {
                $fuente === 'toolset'                => 'Hay asesores que no pertenecen a la agencia.',
                $catalogos['asesoresError'][$fuente] => "No se pudieron validar los {$titulo} en Manager. Intente de nuevo.",
                default                              => "Hay asesores que no son {$titulo} activos de la agencia.",
            };
        }
        // Checklist: ítems fijos válidos o agregados con nombre, sin repetir
        $nombres = [];
        foreach ($dia['checklist'] ?? [] as $j => $item) {
            $id = $item['checklist_item_id'] ?? null;
            if ($id !== null && ! isset($catalogos['checklist'][(int) $id])) {
                $errores[$campo("checklist.$j.nombre")] = 'El elemento del checklist no es válido.';
                continue;
            }
            $nombre = mb_strtoupper(trim($id !== null ? $catalogos['checklist'][(int) $id] : (string) ($item['nombre'] ?? '')));
            if ($nombre === '') {
                $errores[$campo("checklist.$j.nombre")] = 'Escriba el nombre del elemento.';
            } elseif (in_array($nombre, $nombres, true)) {
                $errores[$campo("checklist.$j.nombre")] = 'El elemento está repetido en el checklist.';
            }
            $nombres[] = $nombre;
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
            "{$p}tipo_responsable"       => ['required', 'string', 'max:30'],
            "{$p}responsable_evento_id"  => ['required', 'string', 'max:20'], // cédula del empleado en Manager
            "{$p}productos"              => ['array'],
            "{$p}productos.*.producto"   => ['required', 'string'], // repetidos se validan en erroresDia
            "{$p}productos.*.cantidad"   => ['required', 'integer', 'min:1'],
            "{$p}asesores"               => ['array'],
            "{$p}asesores.*"             => ['string', 'max:20'], // coduser de toolset_perf o cédula (asesores de planta)
            "{$p}checklist"                          => ['array'],
            "{$p}checklist.*.checklist_item_id"      => ['nullable', 'integer'],            // null = agregado en la actividad
            "{$p}checklist.*.nombre"                 => ['nullable', 'string', 'max:100'],
            "{$p}checklist.*.presupuesto_asignado"   => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
        ];
    }

    public function mensajesDia(string $prefijo): array
    {
        $p = $prefijo === '' ? '' : "$prefijo.";

        return [
            "{$p}actividad_tipo_id.required"    => 'Seleccione el tipo de actividad.',
            "{$p}ciudad_id.required"            => 'Seleccione el municipio.',
            "{$p}tipo_responsable.required"     => 'Seleccione el tipo de responsable.',
            "{$p}responsable_evento_id.required" => 'Seleccione el responsable evento.',
            "{$p}productos.*.cantidad.required" => 'Digite la cantidad.',
            "{$p}productos.*.cantidad.integer"  => 'La cantidad debe ser un número entero.',
            "{$p}productos.*.cantidad.min"      => 'La cantidad debe ser mayor a cero.',
            "{$p}checklist.*.nombre.max"                => 'El nombre no puede tener más de 100 caracteres.',
            "{$p}checklist.*.presupuesto_asignado.numeric" => 'El presupuesto debe ser un número.',
            "{$p}checklist.*.presupuesto_asignado.min"     => 'El presupuesto no puede ser negativo.',
            "{$p}checklist.*.presupuesto_asignado.max"     => 'El presupuesto es demasiado alto.',
        ];
    }

    // De dónde salen los asesores del día según su tipo: 'planta' / 'externos' (Manager) o 'toolset' (toolset_perf)
    private function fuenteAsesores(array $dia, array $catalogos): string
    {
        return $catalogos['gruposAsesores'][(int) $dia['actividad_tipo_id']] ?? 'toolset';
    }

    // Asesores válidos del día: coduser/cédula => ['nombre', 'vendedor']
    private function asesoresDelDia(array $dia, array $catalogos): array
    {
        return $catalogos['asesores'][$this->fuenteAsesores($dia, $catalogos)];
    }

    // Tipo de responsable y responsable evento del día (se guardan con el save() de la actividad)
    public function asignarResponsable(Actividad $actividad, array $dia): void
    {
        $actividad->tipo_responsable      = $dia['tipo_responsable'];
        $actividad->responsable_evento_id = (string) $dia['responsable_evento_id'];
    }

    // Reemplaza productos, asesores y checklist de la actividad (sin llaves foráneas: se borra desde aquí)
    public function guardarDetalles(Actividad $actividad, array $dia, array $catalogos): void
    {
        // El presupuesto autorizado no se digita aquí (lo pone la autorización): se conserva al reemplazar el checklist
        $autorizados = DB::connection('mysql')->table('actividad_checklist')
            ->where('actividad_id', $actividad->id)->whereNotNull('presupuesto_autorizado')
            ->pluck('presupuesto_autorizado', 'nombre')->all();

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
                'nombre'       => mb_substr((string) $this->asesoresDelDia($dia, $catalogos)[$coduser]['nombre'], 0, 200),
                'vendedor_cod' => $this->asesoresDelDia($dia, $catalogos)[$coduser]['vendedor'] ?? null, // código de vendedor en Manager
            ])->values()->all()
        );

        DB::connection('mysql')->table('actividad_checklist')->insert(
            collect($dia['checklist'] ?? [])->map(function ($item) use ($actividad, $catalogos, $autorizados) {
                $id = isset($item['checklist_item_id']) ? (int) $item['checklist_item_id'] : null;
                $nombre = mb_substr(mb_strtoupper(trim($id !== null ? $catalogos['checklist'][$id] : (string) $item['nombre'])), 0, 100);

                return [
                    'actividad_id'           => $actividad->id,
                    'checklist_item_id'      => $id,
                    'nombre'                 => $nombre,
                    'presupuesto_asignado'   => isset($item['presupuesto_asignado']) && $item['presupuesto_asignado'] !== '' ? $item['presupuesto_asignado'] : null,
                    'presupuesto_autorizado' => $autorizados[$nombre] ?? null,
                ];
            })->values()->all()
        );
    }

    public function eliminarDetalles(Actividad $actividad): void
    {
        ActividadProducto::query()->where('actividad_id', $actividad->id)->delete();
        DB::connection('mysql')->table('actividad_asesores')->where('actividad_id', $actividad->id)->delete();
        DB::connection('mysql')->table('actividad_checklist')->where('actividad_id', $actividad->id)->delete();
    }
}
