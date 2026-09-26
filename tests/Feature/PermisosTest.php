<?php

namespace Tests\Feature;

use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PermisosTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['web', 'auth', 'can:usu_list'])
            ->get('/_test/usuarios', fn () => 'ok');
    }

    /** Usuario en memoria (sin tocar toolset_perf) con un rol de mercadeo dado. */
    private function usuario(string $permisos, int $nivel = 1, string $activo = '1'): Usuario
    {
        $usuario = (new Usuario)->forceFill([
            'coduser' => 'prueba',
            'nombre' => 'Usuario Prueba',
            'useractivo' => $activo,
            'nivel_mercadeo' => $nivel,
        ]);

        return $usuario->setRelation('rol', (new Rol)->forceFill(['permisos' => $permisos]));
    }

    public function test_lee_permisos_con_formato_de_comas(): void
    {
        $usuario = $this->usuario(',usu_list,rol_edit,');

        $this->assertSame(['usu_list', 'rol_edit'], $usuario->permisos());
        $this->assertTrue($usuario->tienePermiso('usu_list'));
        $this->assertFalse($usuario->tienePermiso('rol_delete'));
        $this->assertFalse($usuario->tienePermiso(''));
    }

    public function test_sin_acceso_si_nivel_mercadeo_es_cero_o_inactivo(): void
    {
        $this->assertTrue($this->usuario(',usu_list,')->tieneAccesoMercadeo());
        $this->assertFalse($this->usuario(',usu_list,', nivel: 0)->tieneAccesoMercadeo());
        $this->assertFalse($this->usuario(',usu_list,', activo: '0')->tieneAccesoMercadeo());
    }

    public function test_ruta_con_permiso_permite_acceso(): void
    {
        $this->actingAs($this->usuario(',usu_list,'))
            ->get('/_test/usuarios')
            ->assertOk();
    }

    public function test_ruta_sin_permiso_muestra_acceso_denegado(): void
    {
        $this->actingAs($this->usuario(',rol_list,'))
            ->get('/_test/usuarios')
            ->assertForbidden()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Errors/AccesoDenegado')
                ->where('auth.permisos', ['rol_list']));
    }

    public function test_configuracion_accesible_con_cualquier_permiso_de_submodulo(): void
    {
        $this->actingAs($this->usuario(',rol_list,'))
            ->get('/configuracion')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Configuracion'));
    }

    public function test_configuracion_denegada_sin_permisos_de_submodulos(): void
    {
        $this->actingAs($this->usuario(',otro_permiso,'))
            ->get('/configuracion')
            ->assertForbidden();
    }

    public function test_perfiles_requiere_rol_list(): void
    {
        $this->actingAs($this->usuario(',usu_list,'))
            ->get('/configuracion/perfiles')
            ->assertForbidden();
    }

    // El caso con permiso consulta la BD (lista real); se probará cuando exista la base de pruebas
    public function test_actividades_requiere_act_list(): void
    {
        $this->actingAs($this->usuario(',usu_list,'))
            ->get('/actividades')
            ->assertForbidden();
    }

    public function test_programacion_requiere_act_create(): void
    {
        $this->actingAs($this->usuario(',act_list,'))
            ->get('/actividades/programacion/crear')
            ->assertForbidden();

        $this->actingAs($this->usuario(',act_list,'))
            ->getJson('/actividades/datos/agencias?departamento_id=52')
            ->assertForbidden();
    }

    public function test_usuario_sin_nivel_mercadeo_es_expulsado(): void
    {
        $this->actingAs($this->usuario(',usu_list,', nivel: 0))
            ->get('/_test/usuarios')
            ->assertRedirect(route('login'))
            ->assertSessionHas('alerta', 'Tu usuario no tiene acceso a Mercadeo.');
    }
}
