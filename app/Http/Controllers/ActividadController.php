<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
// El ActividadService se agrega cuando se defina la tabla de actividades.
class ActividadController extends Controller
{
    // Listado de actividades
    public function index()
    {
        return Inertia::render('Actividades/Index');
    }
}
