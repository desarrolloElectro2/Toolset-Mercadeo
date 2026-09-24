<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\ConfiguracionController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('guest')->group(function () {
    Route::get('/login', [LoginController::class, 'showLoginForm'])->name('login');
    Route::post('/login', [LoginController::class, 'login'])->middleware('throttle:5,1');
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [LoginController::class, 'logout'])->name('logout');

    Route::get('/', fn () => Inertia::render('Home'))->name('home');

    Route::prefix('configuracion')->name('configuracion.')->group(function () {
        Route::get('/', [ConfiguracionController::class, 'index'])->name('index');

        // Temporales hasta construir cada submódulo
        Route::get('/usuarios', fn () => Inertia::render('Proximamente', ['titulo' => 'Usuarios', 'icono' => '👥', 'padre' => 'Configuración']))
            ->middleware('can:usu_list')->name('usuarios.index');
        Route::get('/perfiles', fn () => Inertia::render('Proximamente', ['titulo' => 'Perfiles', 'icono' => '🔐', 'padre' => 'Configuración']))
            ->middleware('can:rol_list')->name('perfiles.index');
    });
});
