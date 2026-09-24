<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->appendToGroup('web', [
            \App\Http\Middleware\UnicaSesion::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Sin permiso (can:..., authorize, abort(403)) -> página React de acceso denegado
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            if ($response->getStatusCode() === 403 && ! $request->expectsJson()) {
                return Inertia::render('Errors/AccesoDenegado')
                    ->toResponse($request)
                    ->setStatusCode(403);
            }

            // Límite de intentos de login (throttle) -> volver al formulario con alerta
            if ($response->getStatusCode() === 429 && $request->is('login')) {
                return back()->with('alerta', 'Demasiados intentos. Espere un minuto e intente nuevamente.');
            }

            return $response;
        });
    })->create();
