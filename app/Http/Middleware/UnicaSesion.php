<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;

class UnicaSesion
{
    public function handle($request, Closure $next)
    {
        if (Auth::check()) {
            $usuario = Auth::user();
            $sessionIdActual = Session::getId();
            $sessionIdGuardado = $usuario->session_id_mercadeo;

            if ($sessionIdGuardado && $sessionIdActual !== $sessionIdGuardado) {
                Auth::logout();
                Session::invalidate();
                Session::regenerateToken();

                return redirect()->route('login')
                    ->with('alerta', 'Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.');
            }
        }

        return $next($request);
    }
}
