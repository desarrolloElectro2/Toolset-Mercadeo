<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadTipo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Matriz parametrizable de tipos de actividad (show room, activación de marca, ...)
class TipoActividadService
{
    private const POR_PAGINA = 15;

    // Tabla con búsqueda, paginación y cuántas actividades usan cada tipo
    public function listar(Request $request): array
    {
        $busqueda = trim((string) $request->query('buscar', ''));

        $tipos = ActividadTipo::query()
            ->select(['id', 'nombre', 'activo'])
            ->selectSub(
                Actividad::query()->selectRaw('COUNT(*)')->whereColumn('actividades.actividad_tipo_id', 'actividad_tipos.id'),
                'total_actividades'
            )
            ->when($busqueda !== '', fn ($q) => $q->where('nombre', 'like', "%{$busqueda}%"))
            ->orderBy('nombre')
            ->paginate(self::POR_PAGINA)
            ->withQueryString();

        $tipos->through(fn (ActividadTipo $t) => [
            'id'               => $t->id,
            'nombre'           => $t->nombre,
            'activo'           => (bool) $t->activo,
            'totalActividades' => (int) $t->total_actividades,
        ]);

        return [
            'tipos'   => $tipos,
            'filtros' => ['buscar' => $busqueda],
        ];
    }

    public function crear(Request $request): ActividadTipo
    {
        $datos = $this->validar($request);

        $tipo = new ActividadTipo();
        $tipo->nombre = $datos['nombre'];
        $tipo->activo = $datos['activo'] ? 1 : 0;
        $tipo->save();

        return $tipo;
    }

    public function actualizar(Request $request, ActividadTipo $tipo): void
    {
        $datos = $this->validar($request, $tipo);

        $tipo->nombre = $datos['nombre'];
        $tipo->activo = $datos['activo'] ? 1 : 0;
        $tipo->save();
    }

    // Solo se elimina si ninguna actividad lo usa; si ya se usó, se debe inactivar
    public function eliminar(ActividadTipo $tipo): void
    {
        $usos = Actividad::query()->where('actividad_tipo_id', $tipo->id)->count();

        if ($usos > 0) {
            throw new \DomainException(
                "No se puede eliminar «{$tipo->nombre}»: lo usan {$usos} actividad(es). Inactívelo para que no aparezca al programar."
            );
        }

        $tipo->delete();
    }

    // Nombre obligatorio, único y en mayúsculas (como los demás catálogos)
    private function validar(Request $request, ?ActividadTipo $tipo = null): array
    {
        $entrada = [
            'nombre' => mb_strtoupper(trim((string) $request->input('nombre', ''))),
            'activo' => $request->boolean('activo'),
        ];

        $validator = Validator::make($entrada, [
            'nombre' => ['required', 'string', 'max:100', Rule::unique('mysql.actividad_tipos', 'nombre')->ignore($tipo?->id)],
            'activo' => ['boolean'],
        ], [
            'nombre.required' => 'El nombre del tipo de actividad es obligatorio.',
            'nombre.max'      => 'El nombre no puede tener más de 100 caracteres.',
            'nombre.unique'   => 'Ya existe un tipo de actividad con ese nombre.',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }
}
