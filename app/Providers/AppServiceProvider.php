<?php

namespace App\Providers;

use App\Models\Usuario;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Cada código de la tabla permisos funciona como ability de Laravel:
        // ->middleware('can:usu_list'), Gate::allows('rol_edit'), $this->authorize('rol_delete')...
        Gate::before(function (Usuario $usuario, string $ability) {
            return $usuario->tienePermiso($ability) ? true : null;
        });
    }
}
