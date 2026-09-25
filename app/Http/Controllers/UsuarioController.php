<?php

namespace App\Http\Controllers;

use App\Models\Usuario;
use App\Services\UsuarioService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class UsuarioController extends Controller
{
    public function __construct(private UsuarioService $usuarioService)
    {
    }

    // Listado de usuarios de toolset_perf con buscador, filtro y paginación
    public function index(Request $request)
    {
        return Inertia::render(
            'Configuracion/Usuarios/Index',
            $this->usuarioService->listar($request),
        );
    }

    // Formulario para editar un usuario
    public function edit(Usuario $usuario)
    {
        return Inertia::render(
            'Configuracion/Usuarios/Edit',
            $this->usuarioService->obtenerParaEditar($usuario),
        );
    }

    // Guarda los cambios del usuario
    public function update(Request $request, Usuario $usuario)
    {
        $this->usuarioService->actualizar($request, $usuario);

        return redirect()
            ->route('configuracion.usuarios.index')
            ->with('mensaje', "Usuario «{$usuario->coduser}» actualizado correctamente.");
    }
}
