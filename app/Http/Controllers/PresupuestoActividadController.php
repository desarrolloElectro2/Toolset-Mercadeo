<?php

namespace App\Http\Controllers;

use App\Services\PresupuestoActividadService;
use Illuminate\Http\Request;

// El controlador solo recibe la petición, llama al servicio y responde.
class PresupuestoActividadController extends Controller
{
    public function __construct(private PresupuestoActividadService $presupuestoService)
    {
    }

    // Lista actividades: pasa las seleccionadas a PRESUPUESTO ASIGNADO
    public function asignar(Request $request)
    {
        return $this->responder(fn () => $this->presupuestoService->asignarLote($request));
    }

    // Lista actividades: autoriza el presupuesto de las seleccionadas (asignado -> autorizado)
    public function autorizar(Request $request)
    {
        return $this->responder(fn () => $this->presupuestoService->autorizarLote($request));
    }

    private function responder(\Closure $accion)
    {
        try {
            $mensaje = $accion();
        } catch (\DomainException $e) {
            return back()->with('alerta', $e->getMessage());
        }

        return back()->with('mensaje', $mensaje);
    }
}
