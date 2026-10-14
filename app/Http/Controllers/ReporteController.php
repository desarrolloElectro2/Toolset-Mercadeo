<?php

namespace App\Http\Controllers;

use App\Services\ReporteActividadService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class ReporteController extends Controller
{
    public function __construct(private ReporteActividadService $reporteActividadService)
    {
    }

    // Módulo Reportes (permiso acc_reportes en la ruta): tarjetas de los reportes que puede ver el usuario
    public function index()
    {
        return Inertia::render('Reportes');
    }

    // Reporte de actividades: fecha desde / hasta y resultado en pantalla
    public function actividades(Request $request)
    {
        return Inertia::render('Reportes/Actividades', $this->reporteActividadService->pantalla($request));
    }

    // Reporte de actividades completo en CSV (Excel)
    public function exportarActividades(Request $request)
    {
        return $this->reporteActividadService->exportar($request);
    }
}
