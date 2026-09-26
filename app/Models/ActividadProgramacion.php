<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Programación mensual de actividades de una agencia
class ActividadProgramacion extends Model
{
    protected $connection = 'mysql';
    protected $table = 'actividad_programaciones';

    public function actividades(): HasMany
    {
        return $this->hasMany(Actividad::class, 'programacion_id');
    }
}
