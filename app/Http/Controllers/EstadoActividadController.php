<?php

namespace App\Http\Controllers;

use App\Models\ActividadEstado;
use App\Services\EstadoActividadService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class EstadoActividadController extends Controller
{
    public function __construct(private EstadoActividadService $estadoService)
    {
    }

    // Matriz de estados de actividad
    public function index(Request $request)
    {
        return Inertia::render('Configuracion/EstadosActividad/Index', $this->estadoService->listar($request));
    }

    public function store(Request $request)
    {
        $estado = $this->estadoService->crear($request);

        return back()->with('mensaje', "Estado «{$estado->nombre}» creado correctamente.");
    }

    public function update(Request $request, ActividadEstado $estado)
    {
        $this->estadoService->actualizar($request, $estado);

        return back()->with('mensaje', "Estado «{$estado->nombre}» actualizado correctamente.");
    }

    public function destroy(ActividadEstado $estado)
    {
        try {
            $this->estadoService->eliminar($estado);
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return back()->with('mensaje', "Estado «{$estado->nombre}» eliminado correctamente.");
    }
}
