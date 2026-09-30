<?php

namespace App\Http\Controllers;

use App\Models\Actividad;
use App\Services\ActividadService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class ActividadController extends Controller
{
    public function __construct(private ActividadService $actividadService)
    {
    }

    // Lista de actividades con filtros y paginación
    public function index(Request $request)
    {
        return Inertia::render('Actividades/Index', $this->actividadService->listar($request));
    }

    // Calendario de actividades
    public function calendario()
    {
        return Inertia::render('Actividades/Calendario', $this->actividadService->datosCalendario());
    }

    // JSON: actividades del rango visible del calendario
    public function eventos(Request $request)
    {
        return response()->json($this->actividadService->eventosCalendario($request));
    }

    // Formulario de edición (o consulta si la actividad ya no es editable)
    public function edit(Actividad $actividad)
    {
        return Inertia::render('Actividades/Edit', $this->actividadService->obtenerParaEditar($actividad));
    }

    // Guarda los cambios de lo planeado para el día
    public function update(Request $request, Actividad $actividad)
    {
        try {
            $this->actividadService->actualizar($request, $actividad);
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return redirect()
            ->route('actividades.edit', $actividad)
            ->with('mensaje', "Actividad #{$actividad->id} actualizada correctamente.");
    }
}
