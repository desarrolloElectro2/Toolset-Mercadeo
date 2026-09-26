<?php

use App\Http\Controllers\ActividadController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\ConfiguracionController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PerfilController;
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
    Route::get('/actividades', [ActividadController::class, 'index'])
        ->middleware('can:act_list')->name('actividades.index');

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
    });
});
