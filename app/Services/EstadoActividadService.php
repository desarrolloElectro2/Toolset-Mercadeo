<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadEstado;
use App\Models\Permiso;
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

    // Catálogo cargado una sola vez por petición (codigo => ActividadEstado)
    private ?Collection $catalogo = null;

    // ---------------------------------------------------------------- Consulta de reglas

    /** @return Collection<string, ActividadEstado> todos los estados (activos e inactivos) por código, en orden */
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
        $inicial = $this->catalogo()->first(fn (ActividadEstado $e) => $e->inicial && $e->activo);

        if ($inicial === null) {
            throw new \DomainException('No hay un estado inicial activo configurado en Configuración › Estados actividad.');
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

    /** Lo que necesita el frontend para pintar etiquetas, filtros y el select de Estado Mercadeo */
    public function paraVista(): array
    {
        return $this->catalogo()->values()->map(fn (ActividadEstado $e) => [
            'codigo'              => $e->codigo,
            'nombre'              => $e->nombre,
            'color'               => $e->color,
            'activo'              => $e->activo,
            'requiereInicio'      => $e->requiere_inicio,
            'requiereFin'         => $e->requiere_fin,
            'requiereObservacion' => $e->requiere_observacion,
            'permiso'             => $e->permiso,
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
            'editable'            => $e->editable,
            'requiereInicio'      => $e->requiere_inicio,
            'requiereFin'         => $e->requiere_fin,
            'requiereObservacion' => $e->requiere_observacion,
            'permiso'             => $e->permiso,
            'activo'              => $e->activo,
            'totalActividades'    => (int) $e->total_actividades,
        ]);

        return [
            'estados'  => $estados,
            'filtros'  => ['buscar' => $busqueda],
            'colores'  => self::COLORES,
            'permisos' => $this->permisosAsignables(),
        ];
    }

    public function crear(Request $request): ActividadEstado
    {
        $datos = $this->validar($request);

        $estado = new ActividadEstado();
        $estado->codigo = $this->generarCodigo($datos['nombre']);
        $this->guardar($estado, $datos);

        return $estado;
    }

    public function actualizar(Request $request, ActividadEstado $estado): void
    {
        $datos = $this->validar($request, $estado);

        // El estado inicial no se puede inactivar ni dejar de ser inicial sin escoger otro
        if ($estado->inicial && ! $datos['inicial']) {
            throw ValidationException::withMessages(['inicial' => 'Debe haber un estado inicial: marque otro estado como inicial y este dejará de serlo.']);
        }

        $this->guardar($estado, $datos);
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
            throw new \DomainException("No se puede eliminar «{$estado->nombre}»: ya lo usan actividades o su historial. Inactívelo para que no aparezca.");
        }

        $estado->delete();
    }

    private function guardar(ActividadEstado $estado, array $datos): void
    {
        DB::connection('mysql')->transaction(function () use ($estado, $datos) {
            // Solo un estado inicial
            if ($datos['inicial']) {
                ActividadEstado::query()->where('inicial', 1)->when($estado->exists, fn ($q) => $q->where('id', '<>', $estado->id))->update(['inicial' => 0]);
            }

            $estado->nombre               = $datos['nombre'];
            $estado->color                = $datos['color'];
            $estado->orden                = (int) $datos['orden'];
            $estado->inicial              = $datos['inicial'];
            $estado->editable             = $datos['editable'];
            // Finalizar implica haber iniciado
            $estado->requiere_inicio      = $datos['requiere_inicio'] || $datos['requiere_fin'];
            $estado->requiere_fin         = $datos['requiere_fin'];
            $estado->requiere_observacion = $datos['requiere_observacion'];
            $estado->permiso              = $datos['permiso'];
            $estado->activo               = $datos['activo'];
            $estado->save();
        });

        $this->catalogo = null;
    }

    // Nombre obligatorio, único y en mayúsculas (como los demás catálogos)
    private function validar(Request $request, ?ActividadEstado $estado = null): array
    {
        $entrada = [
            'nombre'               => mb_strtoupper(trim((string) $request->input('nombre', ''))),
            'color'                => (string) $request->input('color', ''),
            'orden'                => $request->input('orden'),
            'inicial'              => $request->boolean('inicial'),
            'editable'             => $request->boolean('editable'),
            'requiere_inicio'      => $request->boolean('requiere_inicio'),
            'requiere_fin'         => $request->boolean('requiere_fin'),
            'requiere_observacion' => $request->boolean('requiere_observacion'),
            'permiso'              => (string) $request->input('permiso', ''),
            'activo'               => $request->boolean('activo'),
        ];

        $validator = Validator::make($entrada, [
            'nombre'   => ['required', 'string', 'max:100', Rule::unique('mysql.actividad_estados', 'nombre')->ignore($estado?->id)],
            'color'    => ['required', Rule::in(self::COLORES)],
            'orden'    => ['required', 'integer', 'min:0', 'max:999'],
            'permiso'  => ['required', Rule::in(collect($this->permisosAsignables())->pluck('codigo')->all())],
            'inicial'  => ['boolean'],
            'editable' => ['boolean'],
            'activo'   => ['boolean'],
            'requiere_inicio'      => ['boolean'],
            'requiere_fin'         => ['boolean'],
            'requiere_observacion' => ['boolean'],
        ], [
            'nombre.required'  => 'El nombre del estado es obligatorio.',
            'nombre.max'       => 'El nombre no puede tener más de 100 caracteres.',
            'nombre.unique'    => 'Ya existe un estado con ese nombre.',
            'color.required'   => 'Seleccione el color.',
            'color.in'         => 'El color no es válido.',
            'orden.required'   => 'Digite el orden.',
            'orden.integer'    => 'El orden debe ser un número entero.',
            'orden.min'        => 'El orden no puede ser negativo.',
            'permiso.required' => 'Seleccione el permiso.',
            'permiso.in'       => 'El permiso no es válido.',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $datos = $validator->validated();

        if ($datos['inicial'] && ! $datos['activo']) {
            throw ValidationException::withMessages(['activo' => 'El estado inicial debe estar activo.']);
        }

        return $datos;
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

    // Permisos del módulo Actividades que se pueden exigir para asignar un estado
    // (no los de entrar, programar o ser responsable; sí los nuevos que se creen, p. ej. autorizar presupuesto)
    private function permisosAsignables(): array
    {
        return Permiso::query()
            ->join('modulos as m', 'm.id', '=', 'permisos.modulo_id')
            ->where('m.nombre', 'ACTIVIDADES')
            ->whereNotIn('permisos.codigo', ['act_list', 'act_create', 'act_responsable'])
            ->orderBy('permisos.id')
            ->get(['permisos.codigo', 'permisos.nombre'])
            ->map(fn ($p) => ['codigo' => $p->codigo, 'nombre' => $p->nombre])
            ->all();
    }
}
