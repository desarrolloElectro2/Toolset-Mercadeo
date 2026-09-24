<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Modulo extends Model
{
    // Explícito: si no, al llegar por Usuario->rol() heredaría la conexión toolset_perf
    protected $connection = 'mysql';
    protected $table = 'modulos';
    public $timestamps = false;

    public function permisos(): HasMany
    {
        return $this->hasMany(Permiso::class, 'modulo_id');
    }
}
