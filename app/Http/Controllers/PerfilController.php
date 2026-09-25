<?php

namespace App\Http\Controllers;

use App\Models\Rol;
use App\Services\PerfilService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class PerfilController extends Controller
{
    public function __construct(private PerfilService $perfilService)
    {
    }

    // Listado de perfiles con buscador y paginación
    public function index(Request $request)
    {
        return Inertia::render(
            'Configuracion/Perfiles/Index',
            $this->perfilService->listar($request),
        );
    }

    // Formulario para editar los permisos de un perfil
    public function edit(Rol $rol)
    {
        return Inertia::render(
            'Configuracion/Perfiles/Edit',
            $this->perfilService->obtenerParaEditar($rol),
        );
    }

    // Guarda los permisos seleccionados
    public function update(Request $request, Rol $rol)
    {
        $this->perfilService->actualizar($request, $rol);

        return redirect()
            ->route('configuracion.perfiles.index')
            ->with('mensaje', "Perfil «{$rol->nombre}» actualizado correctamente.");
    }

    // Elimina el perfil (el servicio lo impide si tiene usuarios asignados)
    public function destroy(Rol $rol)
    {
        try {
            $this->perfilService->eliminar($rol);
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return back()->with('mensaje', "Perfil «{$rol->nombre}» eliminado correctamente.");
    }
}