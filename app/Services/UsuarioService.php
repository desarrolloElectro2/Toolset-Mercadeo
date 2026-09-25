<?php

namespace App\Services;

use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

// Usuarios de toolset_perf (tabla compartida con los demás sistemas)
class UsuarioService
{
    // Usuarios por página en el listado
    private const POR_PAGINA = 15;

    // Datos para la tabla de usuarios (búsqueda, filtro por perfil y paginación)
    public function listar(Request $request): array
    {
        $busqueda = trim((string) $request->query('buscar', ''));
        $perfil   = (string) $request->query('perfil', ''); // '' = todos, 'con', 'sin'

        $usuarios = Usuario::query()
            ->select(['coduser', 'cedula', 'nombre', 'correo', 'useractivo', 'nivel_mercadeo'])
            ->when($busqueda !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('coduser', 'like', "%{$busqueda}%")
                ->orWhere('cedula', 'like', "%{$busqueda}%")
                ->orWhere('nombre', 'like', "%{$busqueda}%")))
            ->when($perfil === 'con', fn ($q) => $q->where('nivel_mercadeo', '<>', 0))
            ->when($perfil === 'sin', fn ($q) => $q->where('nivel_mercadeo', 0))
            ->orderBy('nombre')
            ->paginate(self::POR_PAGINA)
            ->withQueryString();

        $perfiles = Rol::query()->pluck('nombre', 'id');

        $usuarios->through(fn (Usuario $u) => [
            'coduser' => $u->coduser,
            'cedula'  => $u->cedula,
            'nombre'  => $u->nombre,
            'correo'  => $u->correo,
            'activo'  => $u->useractivo == '1',
            'perfil'  => $perfiles[$u->nivel_mercadeo] ?? null,
        ]);

        return [
            'usuarios' => $usuarios,
            'filtros'  => ['buscar' => $busqueda, 'perfil' => $perfil],
        ];
    }

    // Datos para el formulario de edición
    public function obtenerParaEditar(Usuario $usuario): array
    {
        return [
            'usuario' => [
                'coduser'        => $usuario->coduser,
                'cedula'         => $usuario->cedula,
                'nombre'         => $usuario->nombre,
                'correo'         => $usuario->correo,
                'telefono'       => $usuario->telefono,
                'nivel_mercadeo' => (int) $usuario->nivel_mercadeo,
            ],
            'perfiles' => Rol::query()->orderBy('nombre')->get(['id', 'nombre']),
        ];
    }

    // Guarda los datos del usuario y su perfil de mercadeo
    public function actualizar(Request $request, Usuario $usuario): void
    {
        $datos = $this->validarActualizacion($request);

        $this->verificarNoCambiaSuPerfil($request, $usuario, (int) $datos['nivel_mercadeo']);

        $usuario->cedula         = $datos['cedula'];
        $usuario->nombre         = $datos['nombre'];
        $usuario->correo         = $datos['correo'];
        $usuario->telefono       = $datos['telefono'];
        $usuario->nivel_mercadeo = (int) $datos['nivel_mercadeo'];

        // Vacía = no se cambia. MD5 por compatibilidad con los demás sistemas de toolset_perf
        if (! empty($datos['contrasena'])) {
            $usuario->contrasena = md5($datos['contrasena']);
        }

        $usuario->user_update     = (string) $request->user()->coduser;
        $usuario->user_updated_at = now();
        $usuario->save();
    }

    // Nadie puede cambiar su propio perfil de mercadeo (podría dejarse sin acceso)
    private function verificarNoCambiaSuPerfil(Request $request, Usuario $usuario, int $nuevoNivel): void
    {
        $esElMismo = $request->user()->coduser === $usuario->coduser;

        if ($esElMismo && $nuevoNivel !== (int) $usuario->nivel_mercadeo) {
            throw ValidationException::withMessages([
                'nivel_mercadeo' => 'No puedes cambiar tu propio perfil de mercadeo.',
            ]);
        }
    }

    // Reglas según los tamaños de las columnas de toolset_perf.usuarios
    private function validarActualizacion(Request $request): array
    {
        // Sin convertir a mayúsculas: la tabla es compartida y tiene nombres en mayúsculas y minúsculas
        $validator = Validator::make($request->all(), [
            'cedula'         => ['required', 'string', 'max:15'],
            'nombre'         => ['required', 'string', 'max:50'],
            'correo'         => ['nullable', 'email', 'max:50'],
            'telefono'       => ['nullable', 'string', 'max:30'],
            'contrasena'     => ['nullable', 'string', 'max:50'],
            'nivel_mercadeo' => ['required', 'integer', Rule::when(
                (int) $request->input('nivel_mercadeo') !== 0,
                [Rule::exists('mysql.roles', 'id')]
            )],
        ], [
            'cedula.required'         => 'La cédula es obligatoria.',
            'cedula.max'              => 'La cédula no puede tener más de 15 caracteres.',
            'nombre.required'         => 'El nombre es obligatorio.',
            'nombre.max'              => 'El nombre no puede tener más de 50 caracteres.',
            'correo.email'            => 'El correo no es válido.',
            'correo.max'              => 'El correo no puede tener más de 50 caracteres.',
            'telefono.max'            => 'El teléfono no puede tener más de 30 caracteres.',
            'nivel_mercadeo.required' => 'Seleccione un perfil.',
            'nivel_mercadeo.exists'   => 'El perfil seleccionado no existe.',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }
}
