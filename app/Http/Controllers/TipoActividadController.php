<?php

namespace App\Http\Controllers;

use App\Models\ActividadTipo;
use App\Services\TipoActividadService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class TipoActividadController extends Controller
{
    public function __construct(private TipoActividadService $tipoService)
    {
    }

    // Matriz de tipos de actividad
    public function index(Request $request)
    {
        return Inertia::render('Configuracion/TiposActividad/Index', $this->tipoService->listar($request));
    }

    public function store(Request $request)
    {
        $tipo = $this->tipoService->crear($request);

        return back()->with('mensaje', "Tipo de actividad «{$tipo->nombre}» creado correctamente.");
    }

    public function update(Request $request, ActividadTipo $tipo)
    {
        $this->tipoService->actualizar($request, $tipo);

        return back()->with('mensaje', "Tipo de actividad «{$tipo->nombre}» actualizado correctamente.");
    }

    public function destroy(ActividadTipo $tipo)
    {
        try {
            $this->tipoService->eliminar($tipo);
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return back()->with('mensaje', "Tipo de actividad «{$tipo->nombre}» eliminado correctamente.");
    }
}
