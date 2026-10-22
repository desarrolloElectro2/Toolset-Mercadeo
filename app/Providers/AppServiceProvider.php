<?php

namespace App\Providers;

use App\Models\Usuario;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Una sola instancia por petición: guarda los empleados de Manager ya consultados por agencia
        $this->app->scoped(\App\Services\ResponsableAgenciaService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // En el servidor el proyecto se sirve por /mercadeo con reescritura a public/, y Laravel detecta
        // /mercadeo/public como raíz: las URLs generadas (route(), redirect) salen de APP_URL
        if ($this->app->isProduction()) {
            URL::forceRootUrl(config('app.url'));

            if (str_starts_with(config('app.url'), 'https://')) {
                URL::forceScheme('https');
            }
        }

        // Cada código de la tabla permisos funciona como ability de Laravel:
        // ->middleware('can:usu_list'), Gate::allows('rol_edit'), $this->authorize('rol_delete')...
        Gate::before(function (Usuario $usuario, string $ability) {
            return $usuario->tienePermiso($ability) ? true : null;
        });
    }
}
