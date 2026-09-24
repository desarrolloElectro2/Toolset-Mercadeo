<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Rol extends Model
{
    // Explícito: si no, al llegar por Usuario->rol() heredaría la conexión toolset_perf
    protected $connection = 'mysql';
    protected $table = 'roles';

    /**
     * Los permisos se guardan como ",cod1,cod2," (mismo formato que los demás sistemas toolset).
     *
     * @return array<int, string>
     */
    public function listaPermisos(): array
    {
        return array_values(array_filter(explode(',', (string) $this->permisos)));
    }
}
