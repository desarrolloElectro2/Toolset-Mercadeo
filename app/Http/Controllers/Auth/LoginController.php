<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LoginController extends Controller
{
    public function __construct(private AuthService $authService)
    {
    }

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

        $usuario = $this->authService->autenticar($request->coduser, $request->contrasena);

        if ($usuario === null) {
            return back()->with('alerta', 'Error de autenticación!');
        }

        if (! $this->authService->iniciarSesion($usuario)) {
            return redirect()->route('login')
                ->with('alerta', 'Ocurrió un error al iniciar sesión, por favor intente nuevamente.');
        }

        return redirect()->intended(route('home'));
    }

    public function logout()
    {
        $this->authService->cerrarSesion();

        return redirect()->route('login');
    }
}
