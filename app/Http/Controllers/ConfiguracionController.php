<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ConfiguracionController extends Controller
{
    /** Permisos de los submódulos de Configuración: con cualquiera de ellos se puede entrar. */
    private const PERMISOS_SUBMODULOS = ['usu_list', 'rol_list', 'tip_actividad'];

    public function index()
    {
        abort_unless(Gate::any(self::PERMISOS_SUBMODULOS), 403);

        return Inertia::render('Configuracion');
    }
}
