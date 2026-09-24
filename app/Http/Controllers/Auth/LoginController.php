<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class LoginController extends Controller
{
    public function showLoginForm()
    {
        return Inertia::render('Auth/Login');
    }

    public function login(Request $request)
    {
        $request->validate([
            'coduser' => 'required|string',
            'contrasena' => 'required|string',
        ]);

        $usuario = Usuario::find($request->coduser);

        if ($usuario === null || $usuario->contrasena !== md5($request->contrasena) || $usuario->useractivo != '1') {
            return back()->with('alerta', 'Error de autenticación!');
        }

        try {
            // Regenerar sesión para evitar fijación
            $request->session()->regenerate();

            // Eliminar sesiones anteriores del mismo usuario en la tabla sessions de mercadeo
            DB::table('sessions')->where('user_id', $usuario->coduser)->delete();

            Auth::login($usuario);

            // Guardar session_id_mercadeo solo si el login se completó (control de sesión única propio de mercadeo)
            $usuario->session_id_mercadeo = session()->getId();
            $usuario->save();
        } catch (\Throwable $e) {
            Log::error('Error al iniciar sesión (control de sesión única): '.$e->getMessage());

            return redirect()->route('login')
                ->with('alerta', 'Ocurrió un error al iniciar sesión, por favor intente nuevamente.');
        }

        return redirect()->intended(route('home'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
