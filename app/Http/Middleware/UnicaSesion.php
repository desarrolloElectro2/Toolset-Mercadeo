<?php

namespace App\Http\Middleware;

use App\Services\AuthService;
use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;

class UnicaSesion
{
    public function __construct(private AuthService $authService)
    {
    }

    public function handle($request, Closure $next)
    {
        if (Auth::check()) {
            $usuario = Auth::user();
            $sessionIdGuardado = $usuario->session_id_mercadeo;

            if ($sessionIdGuardado && Session::getId() !== $sessionIdGuardado) {
                return $this->expulsar('Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.');
            }

            // Si lo desactivan o le quitan el rol mientras está conectado, sale en la siguiente petición
            if (! $usuario->tieneAccesoMercadeo()) {
                return $this->expulsar('Tu usuario no tiene acceso a Mercadeo.');
            }
        }

        return $next($request);
    }

    private function expulsar(string $mensaje)
    {
        $this->authService->cerrarSesion();

        return redirect()->route('login')->with('alerta', $mensaje);
    }
}
