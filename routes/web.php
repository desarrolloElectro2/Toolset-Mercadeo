<?php

use App\Http\Controllers\ActividadController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\ConfiguracionController;
use App\Http\Controllers\EjecucionActividadController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PerfilController;
use App\Http\Controllers\ProgramacionActividadController;
use App\Http\Controllers\TipoActividadController;
use App\Http\Controllers\UsuarioController;
use Inertia\Inertia;

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'showLoginForm'])->name('login');
    Route::post('/login', [LoginController::class, 'login'])->middleware('throttle:5,1');
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [LoginController::class, 'logout'])->name('logout');

    Route::get('/', fn () => Inertia::render('Home'))->name('home');

    // Actividades
    Route::prefix('actividades')->name('actividades.')->group(function () {
        Route::get('/', [ActividadController::class, 'index'])
            ->middleware('can:act_list')->name('index');

        // Calendario (la página y los eventos del rango visible en JSON)
        Route::get('/calendario', [ActividadController::class, 'calendario'])
            ->middleware('can:act_list')->name('calendario');
        Route::get('/calendario/eventos', [ActividadController::class, 'eventos'])
            ->middleware('can:act_list')->name('calendario.eventos');

        // Editar una actividad (un día); la misma pantalla sirve de consulta si ya no es editable
        Route::get('/{actividad}/editar', [ActividadController::class, 'edit'])
            ->whereNumber('actividad')->middleware('can:act_list')->name('edit');
        Route::put('/{actividad}', [ActividadController::class, 'update'])
            ->whereNumber('actividad')->middleware('can:act_edit')->name('update');

        // Ejecución: iniciar (hora + foto), finalizar (hora fin), anular (motivo) y ver la foto
        Route::post('/{actividad}/iniciar', [EjecucionActividadController::class, 'iniciar'])
            ->whereNumber('actividad')->middleware('can:act_edit')->name('iniciar');
        Route::post('/{actividad}/finalizar', [EjecucionActividadController::class, 'finalizar'])
            ->whereNumber('actividad')->middleware('can:act_edit')->name('finalizar');
        Route::post('/{actividad}/anular', [EjecucionActividadController::class, 'anular'])
            ->whereNumber('actividad')->middleware('can:act_anular')->name('anular');
        Route::get('/{actividad}/foto-inicio', [EjecucionActividadController::class, 'foto'])
            ->whereNumber('actividad')->middleware('can:act_list')->name('foto');
        Route::get('/{actividad}/archivo-fin', [EjecucionActividadController::class, 'archivoFin'])
            ->whereNumber('actividad')->middleware('can:act_list')->name('archivo-fin');

        // Programación mensual
        Route::middleware('can:act_create')->group(function () {
            Route::get('/programacion/crear', [ProgramacionActividadController::class, 'create'])->name('programacion.create');
            Route::post('/programacion', [ProgramacionActividadController::class, 'store'])->name('programacion.store');
            // Si el navegador recarga la dirección del POST (p. ej. tras un error), se vuelve al formulario en vez de un 405
            Route::get('/programacion', fn () => redirect()->route('actividades.programacion.create'));

            // Datos para los selects dependientes (JSON)
            Route::get('/datos/agencias', [ProgramacionActividadController::class, 'agencias'])->name('datos.agencias');
            Route::get('/datos/agencia/{codagen}', [ProgramacionActividadController::class, 'datosAgencia'])->name('datos.agencia');
            Route::get('/datos/programacion', [ProgramacionActividadController::class, 'programacionExistente'])->name('datos.programacion');
        });
    });

    Route::prefix('configuracion')->name('configuracion.')->group(function () {
        Route::get('/', [ConfiguracionController::class, 'index'])->name('index');
    
        // Perfiles
        Route::get('/perfiles', [PerfilController::class, 'index'])
            ->middleware('can:rol_list')->name('perfiles.index');
    
        Route::get('/perfiles/{rol}/edit', [PerfilController::class, 'edit'])
            ->middleware('can:rol_edit')->name('perfiles.edit');
    
        Route::put('/perfiles/{rol}', [PerfilController::class, 'update'])
            ->middleware('can:rol_edit')->name('perfiles.update');

        Route::delete('/perfiles/{rol}', [PerfilController::class, 'destroy'])
            ->middleware('can:rol_delete')->name('perfiles.destroy');
    
        // Usuarios (toolset_perf)
        Route::get('/usuarios', [UsuarioController::class, 'index'])
            ->middleware('can:usu_list')->name('usuarios.index');

        Route::get('/usuarios/{usuario}/edit', [UsuarioController::class, 'edit'])
            ->middleware('can:usu_edit')->name('usuarios.edit');

        Route::put('/usuarios/{usuario}', [UsuarioController::class, 'update'])
            ->middleware('can:usu_edit')->name('usuarios.update');

        // Tipos de actividad (matriz parametrizable): un solo permiso para entrar y hacer todo el CRUD
        Route::middleware('can:tip_actividad')->group(function () {
            Route::get('/tipos-actividad', [TipoActividadController::class, 'index'])->name('tipos.index');
            Route::post('/tipos-actividad', [TipoActividadController::class, 'store'])->name('tipos.store');
            Route::put('/tipos-actividad/{tipo}', [TipoActividadController::class, 'update'])->whereNumber('tipo')->name('tipos.update');
            Route::delete('/tipos-actividad/{tipo}', [TipoActividadController::class, 'destroy'])->whereNumber('tipo')->name('tipos.destroy');
        });
    });
});
