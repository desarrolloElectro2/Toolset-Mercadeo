<?php

namespace App\Http\Controllers;

use App\Services\ProgramacionActividadService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class ProgramacionActividadController extends Controller
{
    public function __construct(private ProgramacionActividadService $programacionService)
    {
    }

    // Formulario de programación mensual
    public function create()
    {
        return Inertia::render(
            'Actividades/Programacion/Create',
            $this->programacionService->datosFormulario(),
        );
    }

    // Guarda la programación y sus actividades
    public function store(Request $request)
    {
        $programacion = $this->programacionService->crear($request);
        $total = $programacion->actividades()->count();

        return redirect()
            ->route('actividades.index')
            ->with('mensaje', "Programación creada con {$total} actividad(es) en estado Programada.");
    }

    // JSON: agencias activas del departamento (select dependiente)
    public function agencias(Request $request)
    {
        return response()->json(
            $this->programacionService->agenciasDeDepartamento((int) $request->query('departamento_id')),
        );
    }

    // JSON: regional, coordinador regional, municipios e inventario de la agencia
    public function datosAgencia(string $codagen)
    {
        return response()->json($this->programacionService->datosAgencia($codagen));
    }
}
