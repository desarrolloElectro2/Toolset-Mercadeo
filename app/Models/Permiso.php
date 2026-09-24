<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Permiso extends Model
{
    // Explícito: si no, al llegar por Usuario->rol() heredaría la conexión toolset_perf
    protected $connection = 'mysql';
    protected $table = 'permisos';
    public $timestamps = false;

    public function modulo(): BelongsTo
    {
        return $this->belongsTo(Modulo::class, 'modulo_id');
    }
}
