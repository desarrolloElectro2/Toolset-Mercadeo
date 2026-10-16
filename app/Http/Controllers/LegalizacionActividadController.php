<?php

namespace App\Http\Controllers;

use App\Models\Actividad;
use App\Services\LegalizacionActividadService;
use Illuminate\Http\Request;

// El controlador solo recibe la petición, llama al servicio y responde.
class LegalizacionActividadController extends Controller
{
    public function __construct(private LegalizacionActividadService $legalizacionService)
    {
    }

    public function store(Request $request, Actividad $actividad)
    {
        try {
            $mensaje = $this->legalizacionService->registrar($request, $actividad);
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return back()->with('mensaje', $mensaje);
    }

    // Soporte de la legalización (ruta protegida; está en el disco del servidor)
    public function archivo(Actividad $actividad, int $archivo)
    {
        return $this->legalizacionService->verArchivo($actividad, $archivo);
    }

    public function destroy(Request $request, Actividad $actividad, int $legalizacion)
    {
        $this->legalizacionService->eliminar($request, $actividad, $legalizacion);

        return back()->with('mensaje', 'Legalización eliminada.');
    }
}
