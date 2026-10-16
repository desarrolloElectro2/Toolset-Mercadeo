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

    // Estado Mercadeo: cambio manual de estado (o solo observaciones si se deja el mismo)
    public function estado(Request $request, Actividad $actividad)
    {
        try {
            $mensaje = $this->ejecucionService->cambiarEstado($request, $actividad);
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return back()->with('mensaje', $mensaje);
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
}
