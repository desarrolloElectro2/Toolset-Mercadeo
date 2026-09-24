<?php

namespace App\Services;

use App\Models\Usuario;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;

class AuthService
{
    /**
     * Devuelve el usuario si las credenciales son válidas y tiene acceso a mercadeo; null en caso contrario.
     */
    public function autenticar(string $coduser, string $contrasena): ?Usuario
    {
        $usuario = Usuario::find($coduser);

        // Las contraseñas son MD5 por compatibilidad con los demás sistemas que comparten toolset_perf
        if ($usuario === null || ! hash_equals((string) $usuario->contrasena, md5($contrasena))) {
            return null;
        }

        return $usuario->tieneAccesoMercadeo() ? $usuario : null;
    }

    /**
     * Inicia la sesión aplicando el control de sesión única. Devuelve false si algo falló a mitad de camino.
     */
    public function iniciarSesion(Usuario $usuario): bool
    {
        try {
            // Eliminar sesiones anteriores del mismo usuario en la tabla sessions de mercadeo
            DB::table('sessions')->where('user_id', $usuario->coduser)->delete();

            // Auth::login regenera el id de sesión (evita fijación de sesión)
            Auth::login($usuario);

            // Guardar session_id_mercadeo solo si el login se completó (control de sesión única propio de mercadeo)
            $usuario->session_id_mercadeo = Session::getId();
            $usuario->save();

            return true;
        } catch (\Throwable $e) {
            Log::error('Error al iniciar sesión (control de sesión única): '.$e->getMessage());

            return false;
        }
    }

    public function cerrarSesion(): void
    {
        Auth::logout();
        Session::invalidate();
        Session::regenerateToken();
    }
}
