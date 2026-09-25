<?php

namespace App\Services;

use App\Models\Modulo;
use App\Models\Permiso;
use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PerfilService
{
    // Perfiles por página en el listado
    private const POR_PAGINA = 15;

    // Permisos que nadie se puede quitar de su propio perfil (evita quedarse sin acceso a Perfiles)
    private const PERMISOS_PROPIOS_OBLIGATORIOS = ['rol_list', 'rol_edit'];

    // Datos para la tabla de perfiles (con búsqueda y paginación)
    public function listar(Request $request): array
    {
        $busqueda = trim((string) $request->query('buscar', ''));

        $roles = Rol::query()
            ->select(['id', 'nombre', 'permisos', 'updated_at'])
            ->when($busqueda !== '', fn ($q) => $q->where('nombre', 'like', "%{$busqueda}%"))
            ->orderBy('nombre')
            ->paginate(self::POR_PAGINA)
            ->withQueryString();

        // Usuarios por perfil de la página actual, en una sola consulta a toolset_perf
        $usuariosPorRol = $this->contarUsuarios(collect($roles->items())->pluck('id')->all());

        $roles->through(fn (Rol $rol) => [
            'id'            => $rol->id,
            'nombre'        => $rol->nombre,
            'totalPermisos' => count($rol->listaPermisos()),
            'totalUsuarios' => (int) ($usuariosPorRol[$rol->id] ?? 0),
            'updatedAt'     => $rol->updated_at?->toDateTimeString(),
        ]);

        return [
            'roles'   => $roles,
            'filtros' => ['buscar' => $busqueda],
        ];
    }

    // Datos para editar un perfil: el rol y TODOS los módulos con sus permisos.
    // Deben ir todos: al guardar se reemplaza la lista completa, y un módulo que no
    // se muestre perdería sus permisos.
    public function obtenerParaEditar(Rol $rol): array
    {
        return [
            'rol' => [
                'id'       => $rol->id,
                'nombre'   => $rol->nombre,
                'permisos' => $rol->listaPermisos(),
            ],
            'modulos' => Modulo::query()
                ->with(['permisos' => fn ($q) => $q->orderBy('id')->select(['id', 'codigo', 'nombre', 'modulo_id'])])
                ->orderBy('id')
                ->get(['id', 'nombre']),
        ];
    }

    // Guarda el nombre y los permisos seleccionados del perfil
    public function actualizar(Request $request, Rol $rol): void
    {
        $datos = $this->validarActualizacion($request, $rol);

        // Solo aceptamos códigos que existan en la tabla permisos
        $validos = Permiso::query()
            ->whereIn('codigo', $datos['permisos'])
            ->pluck('codigo')
            ->all();

        $this->verificarNoSeQuitaAcceso($request, $rol, $validos);

        $rol->nombre      = $datos['nombre'];
        $rol->permisos    = $this->construirCsv($validos);
        $rol->user_update = (string) $request->user()->coduser;
        $rol->save(); // updated_at se actualiza solo
    }

    // Elimina el perfil; no se permite si hay usuarios con ese nivel_mercadeo
    // (quedarían entrando al sistema con un perfil inexistente y sin permisos)
    public function eliminar(Rol $rol): void
    {
        $usuarios = $this->contarUsuarios([$rol->id])[$rol->id] ?? 0;

        if ($usuarios > 0) {
            throw new \DomainException(
                "No se puede eliminar «{$rol->nombre}»: tiene {$usuarios} usuario(s) asignado(s). Asígneles otro perfil primero."
            );
        }

        $rol->delete();
    }

    /**
     * Cantidad de usuarios por perfil (usuarios.nivel_mercadeo).
     *
     * @param  array<int, int>  $idsRoles
     * @return array<int, int>  [id_rol => cantidad]
     */
    private function contarUsuarios(array $idsRoles): array
    {
        if ($idsRoles === []) {
            return [];
        }

        return Usuario::query()
            ->whereIn('nivel_mercadeo', $idsRoles)
            ->groupBy('nivel_mercadeo')
            ->selectRaw('nivel_mercadeo, COUNT(*) AS total')
            ->pluck('total', 'nivel_mercadeo')
            ->all();
    }

    // Si el perfil que se edita es el del propio usuario, no puede quitarse el acceso a Perfiles
    private function verificarNoSeQuitaAcceso(Request $request, Rol $rol, array $permisos): void
    {
        if ((int) $request->user()->nivel_mercadeo !== (int) $rol->id) {
            return;
        }

        $faltantes = array_diff(self::PERMISOS_PROPIOS_OBLIGATORIOS, $permisos);

        if ($faltantes !== []) {
            throw ValidationException::withMessages([
                'permisos' => 'No puedes quitarle a tu propio perfil los permisos de listar y editar perfiles; te quedarías sin acceso a este módulo.',
            ]);
        }
    }

    // Valida el nombre (único, en mayúsculas como en los demás sistemas) y la lista de permisos
    private function validarActualizacion(Request $request, Rol $rol): array
    {
        $entrada = $request->all();
        $entrada['nombre'] = mb_strtoupper(trim((string) $request->input('nombre', '')));

        $validator = Validator::make($entrada, [
            'nombre'     => ['required', 'string', 'max:100', Rule::unique('mysql.roles', 'nombre')->ignore($rol->id)],
            'permisos'   => ['present', 'array'],
            'permisos.*' => ['string'],
        ], [
            'nombre.required'   => 'El nombre del perfil es obligatorio.',
            'nombre.max'        => 'El nombre no puede tener más de 100 caracteres.',
            'nombre.unique'     => 'Ya existe un perfil con ese nombre.',
            'permisos.present'  => 'Debe enviar la lista de permisos.',
            'permisos.array'    => 'El formato de permisos es inválido.',
            'permisos.*.string' => 'Cada permiso debe ser un texto.',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    // Convierte ['rol_list', 'rol_edit'] en ",rol_list,rol_edit,"
    private function construirCsv(array $codigos): string
    {
        $codigos = array_values(array_unique(array_filter(array_map('trim', $codigos))));

        return $codigos === [] ? '' : ','.implode(',', $codigos).',';
    }
}
