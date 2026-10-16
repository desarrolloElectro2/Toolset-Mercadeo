<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadEstado;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Matriz parametrizable de estados de actividad y consulta de sus reglas.
 * Las actividades guardan el `codigo` del estado: se genera del nombre al crearlo y no cambia después.
 */
class EstadoActividadService
{
    private const POR_PAGINA = 15;

    // Colores disponibles (los mismos nombres que usa el frontend en lib/coloresEstado.ts)
    public const COLORES = ['azul', 'celeste', 'morado', 'rosa', 'ambar', 'naranja', 'verde', 'rojo', 'gris'];

    // Estados que usa el código por su `codigo` (no cambia aunque se renombren)
    public const PRESUPUESTO_ASIGNADO   = 'PRESUPUESTO_ASIGNADO';
    public const PRESUPUESTO_AUTORIZADO = 'PRESUPUESTO_AUTORIZADO';
    public const ANULADA                = 'ANULADA';

    // Permiso para pasar una actividad a cada estado; los que no están aquí piden act_edit
    private const PERMISOS = [
        self::PRESUPUESTO_AUTORIZADO => 'act_autorizar',
        self::ANULADA                => 'act_anular',
    ];

    // Catálogo cargado una sola vez por petición (codigo => ActividadEstado)
    private ?Collection $catalogo = null;

    // ---------------------------------------------------------------- Consulta de reglas

    /** @return Collection<string, ActividadEstado> todos los estados por código, en orden */
    public function catalogo(): Collection
    {
        return $this->catalogo ??= ActividadEstado::query()->orderBy('orden')->orderBy('id')->get()->keyBy('codigo');
    }

    public function porCodigo(string $codigo): ?ActividadEstado
    {
        return $this->catalogo()->get($codigo);
    }

    // Código con el que se crean las actividades
    public function codigoInicial(): string
    {
        $inicial = $this->catalogo()->first(fn (ActividadEstado $e) => $e->inicial);

        if ($inicial === null) {
            throw new \DomainException('No hay un estado inicial configurado en Configuración › Estados actividad.');
        }

        return $inicial->codigo;
    }

    public function nombre(string $codigo): string
    {
        return $this->porCodigo($codigo)?->nombre ?? $codigo;
    }

    // Si se puede editar lo planeado; un código que ya no existe en la matriz no se deja editar
    public function esEditable(string $codigo): bool
    {
        return (bool) $this->porCodigo($codigo)?->editable;
    }

    /** Códigos de los estados que permiten editar lo planeado */
    public function codigosEditables(): array
    {
        return $this->catalogo()->filter(fn (ActividadEstado $e) => $e->editable)->keys()->all();
    }

    public function permiso(string $codigo): string
    {
        return self::PERMISOS[$codigo] ?? 'act_edit';
    }

    /** Lo que necesita el frontend para pintar etiquetas, filtros y el select de Estado Mercadeo */
    public function paraVista(): array
    {
        return $this->catalogo()->values()->map(fn (ActividadEstado $e) => [
            'codigo'              => $e->codigo,
            'nombre'              => $e->nombre,
            'color'               => $e->color,
            'requiereInicio'      => $e->requiere_inicio,
            'requiereFin'         => $e->requiere_fin,
            'requiereObservacion' => $e->requiere_observacion,
            'permiso'             => $this->permiso($e->codigo),
        ])->all();
    }

    // ---------------------------------------------------------------- Matriz (CRUD)

    public function listar(Request $request): array
    {
        $busqueda = trim((string) $request->query('buscar', ''));

        $estados = ActividadEstado::query()
            ->select('actividad_estados.*')
            ->selectSub(
                Actividad::query()->selectRaw('COUNT(*)')->whereColumn('actividades.estado', 'actividad_estados.codigo'),
                'total_actividades'
            )
            ->when($busqueda !== '', fn ($q) => $q->where('nombre', 'like', "%{$busqueda}%"))
            ->orderBy('orden')
            ->orderBy('id')
            ->paginate(self::POR_PAGINA)
            ->withQueryString();

        $estados->through(fn (ActividadEstado $e) => [
            'id'                  => $e->id,
            'codigo'              => $e->codigo,
            'nombre'              => $e->nombre,
            'color'               => $e->color,
            'orden'               => (int) $e->orden,
            'inicial'             => $e->inicial,
            'totalActividades'    => (int) $e->total_actividades,
        ]);

        return [
            'estados'  => $estados,
            'filtros'  => ['buscar' => $busqueda],
            'colores'  => self::COLORES,
        ];
    }

    public function crear(Request $request): ActividadEstado
    {
        $datos = $this->validar($request);

        // En la matriz solo se digitan nombre, color y orden; el estado nuevo queda con el comportamiento por defecto
        $estado = new ActividadEstado();
        $estado->codigo               = $this->generarCodigo($datos['nombre']);
        $estado->inicial              = false;
        $estado->editable             = true;
        $estado->requiere_inicio      = false;
        $estado->requiere_fin         = false;
        $estado->requiere_observacion = false;
        $this->guardar($estado, $datos);

        return $estado;
    }

    public function actualizar(Request $request, ActividadEstado $estado): void
    {
        // Solo cambian nombre, color y orden: las reglas del estado (inicial, editable, requisitos, permiso) se conservan
        $this->guardar($estado, $this->validar($request, $estado));
    }

    // Solo se elimina si ninguna actividad lo usa y no es el inicial; si ya se usó, se debe inactivar
    public function eliminar(ActividadEstado $estado): void
    {
        if ($estado->inicial) {
            throw new \DomainException("No se puede eliminar «{$estado->nombre}»: es el estado inicial de las actividades.");
        }

        $usos = Actividad::query()->where('estado', $estado->codigo)->count()
            + DB::connection('mysql')->table('actividad_historial')->where('estado', $estado->codigo)->count();

        if ($usos > 0) {
            throw new \DomainException("No se puede eliminar «{$estado->nombre}»: ya lo usan actividades o su historial.");
        }

        $estado->delete();
    }

    private function guardar(ActividadEstado $estado, array $datos): void
    {
        $estado->nombre = $datos['nombre'];
        $estado->color  = $datos['color'];
        $estado->orden  = (int) $datos['orden'];
        $estado->save();

        $this->catalogo = null;
    }

    // Nombre obligatorio, único y en mayúsculas (como los demás catálogos)
    private function validar(Request $request, ?ActividadEstado $estado = null): array
    {
        $entrada = [
            'nombre' => mb_strtoupper(trim((string) $request->input('nombre', ''))),
            'color'  => (string) $request->input('color', ''),
            'orden'  => $request->input('orden'),
        ];

        $validator = Validator::make($entrada, [
            'nombre' => ['required', 'string', 'max:100', Rule::unique('mysql.actividad_estados', 'nombre')->ignore($estado?->id)],
            'color'  => ['required', Rule::in(self::COLORES)],
            'orden'  => ['required', 'integer', 'min:0', 'max:999'],
        ], [
            'nombre.required' => 'El nombre del estado es obligatorio.',
            'nombre.max'      => 'El nombre no puede tener más de 100 caracteres.',
            'nombre.unique'   => 'Ya existe un estado con ese nombre.',
            'color.required'  => 'Seleccione el color.',
            'color.in'        => 'El color no es válido.',
            'orden.required'  => 'Digite el orden.',
            'orden.integer'   => 'El orden debe ser un número entero.',
            'orden.min'       => 'El orden no puede ser negativo.',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    // "PRESUPUESTO AUTORIZADO" -> "PRESUPUESTO_AUTORIZADO" (máx. 30, único)
    private function generarCodigo(string $nombre): string
    {
        $base = mb_substr(trim(preg_replace('/[^A-Z0-9]+/', '_', Str::upper(Str::ascii($nombre))), '_'), 0, 30) ?: 'ESTADO';
        $codigo = $base;

        for ($i = 2; ActividadEstado::query()->where('codigo', $codigo)->exists(); $i++) {
            $codigo = mb_substr($base, 0, 30 - strlen("_$i"))."_$i";
        }

        return $codigo;
    }
}
