<?php

namespace App\Http\Controllers;

use App\Models\Actividad;
use App\Services\EjecucionActividadService;
use Illuminate\Http\Request;

// El controlador solo recibe la petición, llama al servicio y responde.
class EjecucionActividadController extends Controller
{
    public function __construct(private EjecucionActividadService $ejecucionService)
    {
    }

    public function iniciar(Request $request, Actividad $actividad)
    {
        return $this->responder(
            fn () => $this->ejecucionService->iniciar($request, $actividad),
            "Actividad #{$actividad->id} iniciada: quedó En proceso."
        );
    }

    public function finalizar(Request $request, Actividad $actividad)
    {
        return $this->responder(
            fn () => $this->ejecucionService->finalizar($request, $actividad),
            "Actividad #{$actividad->id} finalizada."
        );
    }

    public function anular(Request $request, Actividad $actividad)
    {
        return $this->responder(
            fn () => $this->ejecucionService->anular($request, $actividad),
            "Actividad #{$actividad->id} anulada."
        );
    }

    // Archivo de finalización: foto o PDF (ruta protegida; está en el disco del servidor)
    public function archivoFin(Actividad $actividad)
    {
        return $this->ejecucionService->archivoFin($actividad);
    }

    // Foto de inicio (ruta protegida; el archivo está en el disco del servidor)
    public function foto(Actividad $actividad)
    {
        return $this->ejecucionService->foto($actividad);
    }

    private function responder(callable $accion, string $mensaje)
    {
        try {
            $accion();
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return back()->with('mensaje', $mensaje);
    }
}
