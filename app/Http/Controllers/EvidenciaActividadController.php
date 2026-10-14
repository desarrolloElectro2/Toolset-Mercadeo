<?php

namespace App\Http\Controllers;

use App\Models\Actividad;
use App\Services\EvidenciaActividadService;
use Illuminate\Http\Request;

// El controlador solo recibe la petición, llama al servicio y responde.
class EvidenciaActividadController extends Controller
{
    public function __construct(private EvidenciaActividadService $evidenciaService)
    {
    }

    public function store(Request $request, Actividad $actividad)
    {
        $total = $this->evidenciaService->subir($request, $actividad);

        return back()->with('mensaje', "Se cargaron {$total} evidencia(s) en la actividad #{$actividad->id}.");
    }

    // Archivo de la evidencia (ruta protegida; está en el disco del servidor)
    public function show(Actividad $actividad, int $evidencia)
    {
        return $this->evidenciaService->ver($actividad, $evidencia);
    }

    public function destroy(Request $request, Actividad $actividad, int $evidencia)
    {
        $this->evidenciaService->eliminar($request, $actividad, $evidencia);

        return back()->with('mensaje', 'Evidencia eliminada.');
    }
}
