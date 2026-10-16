<?php

use App\Http\Controllers\ActividadController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\ConfiguracionController;
use App\Http\Controllers\EjecucionActividadController;
use App\Http\Controllers\EstadoActividadController;
use App\Http\Controllers\EvidenciaActividadController;
use App\Http\Controllers\LegalizacionActividadController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PerfilController;
use App\Http\Controllers\ProgramacionActividadController;
use App\Http\Controllers\PresupuestoActividadController;
use App\Http\Controllers\PromotoriaController;
use App\Http\Controllers\ReporteController;
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

        // Presupuesto en lote desde la lista: asignar (act_edit) y autorizar (act_autorizar)
        Route::post('/presupuesto/asignar', [PresupuestoActividadController::class, 'asignar'])
            ->middleware('can:act_edit')->name('presupuesto.asignar');
        Route::post('/presupuesto/autorizar', [PresupuestoActividadController::class, 'autorizar'])
            ->middleware('can:act_autorizar')->name('presupuesto.autorizar');

        // Estado Mercadeo: cambio manual de estado con sus datos (anular exige act_anular, lo demás act_edit;
        // se valida en el servicio según el estado escogido) y ver los archivos
        Route::post('/{actividad}/estado', [EjecucionActividadController::class, 'estado'])
            ->whereNumber('actividad')->middleware('can:act_list')->name('estado');
        Route::get('/{actividad}/foto-inicio', [EjecucionActividadController::class, 'foto'])
            ->whereNumber('actividad')->middleware('can:act_list')->name('foto');
        Route::get('/{actividad}/archivo-fin', [EjecucionActividadController::class, 'archivoFin'])
            ->whereNumber('actividad')->middleware('can:act_list')->name('archivo-fin');

        // Evidencias de la actividad: fotos del evento (las carga el responsable del evento)
        Route::post('/{actividad}/evidencias', [EvidenciaActividadController::class, 'store'])
            ->whereNumber('actividad')->middleware('can:act_edit')->name('evidencias.store');
        Route::get('/{actividad}/evidencias/{evidencia}', [EvidenciaActividadController::class, 'show'])
            ->whereNumber(['actividad', 'evidencia'])->middleware('can:act_list')->name('evidencias.show');
        Route::delete('/{actividad}/evidencias/{evidencia}', [EvidenciaActividadController::class, 'destroy'])
            ->whereNumber(['actividad', 'evidencia'])->middleware('can:act_edit')->name('evidencias.destroy');

        // Legalización de gasto: conceptos, detalle y soportes con su valor (con el presupuesto autorizado)
        Route::post('/{actividad}/legalizaciones', [LegalizacionActividadController::class, 'store'])
            ->whereNumber('actividad')->middleware('can:act_edit')->name('legalizaciones.store');
        Route::get('/{actividad}/legalizaciones/archivos/{archivo}', [LegalizacionActividadController::class, 'archivo'])
            ->whereNumber(['actividad', 'archivo'])->middleware('can:act_list')->name('legalizaciones.archivo');
        Route::delete('/{actividad}/legalizaciones/{legalizacion}', [LegalizacionActividadController::class, 'destroy'])
            ->whereNumber(['actividad', 'legalizacion'])->middleware('can:act_edit')->name('legalizaciones.destroy');

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

    // Promotoría: acc_promotoria para entrar al módulo y, además, el permiso de cada acción sobre las visitas
    Route::prefix('promotoria')->name('promotoria.')->middleware('can:acc_promotoria')->group(function () {
        Route::get('/', [PromotoriaController::class, 'index'])->middleware('can:vis_show')->name('index');

        Route::middleware('can:vis_create')->group(function () {
            Route::get('/crear', [PromotoriaController::class, 'create'])->name('create');
            Route::post('/', [PromotoriaController::class, 'store'])->name('store');
        });

        // La misma pantalla sirve de consulta (vis_show) y de edición (vis_edit)
        Route::get('/{programacion}/editar', [PromotoriaController::class, 'edit'])
            ->whereNumber('programacion')->middleware('can:vis_show')->name('edit');
        Route::put('/{programacion}', [PromotoriaController::class, 'update'])
            ->whereNumber('programacion')->middleware('can:vis_edit')->name('update');

        Route::middleware('can:vis_delete')->group(function () {
            Route::delete('/{programacion}', [PromotoriaController::class, 'destroy'])->whereNumber('programacion')->name('destroy');
            Route::delete('/visitas/{visita}', [PromotoriaController::class, 'destroyVisita'])->whereNumber('visita')->name('visitas.destroy');
        });

        // Datos para los selects dependientes (JSON)
        Route::get('/datos/agencias', [PromotoriaController::class, 'agencias'])->name('datos.agencias');
        Route::get('/datos/lugares/{codagen}', [PromotoriaController::class, 'lugares'])->name('datos.lugares');
    });

    // Reportes: acc_reportes para entrar al módulo y, además, el permiso de cada reporte
    Route::prefix('reportes')->name('reportes.')->middleware('can:acc_reportes')->group(function () {
        Route::get('/', [ReporteController::class, 'index'])->name('index');

        Route::middleware('can:rep_actividades')->group(function () {
            Route::get('/actividades', [ReporteController::class, 'actividades'])->name('actividades');
            Route::get('/actividades/exportar', [ReporteController::class, 'exportarActividades'])->name('actividades.exportar');
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

        // Estados de actividad (matriz parametrizable): un solo permiso para entrar y hacer todo el CRUD
        Route::middleware('can:est_actividad')->group(function () {
            Route::get('/estados-actividad', [EstadoActividadController::class, 'index'])->name('estados.index');
            Route::post('/estados-actividad', [EstadoActividadController::class, 'store'])->name('estados.store');
            Route::put('/estados-actividad/{estado}', [EstadoActividadController::class, 'update'])->whereNumber('estado')->name('estados.update');
            Route::delete('/estados-actividad/{estado}', [EstadoActividadController::class, 'destroy'])->whereNumber('estado')->name('estados.destroy');
        });
    });
});
