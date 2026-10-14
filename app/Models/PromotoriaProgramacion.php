<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Programación mensual de visitas de un promotor (Electromillonaria o Interelec)
class PromotoriaProgramacion extends Model
{
    public const ELECTROMILLONARIA = 'ELECTROMILLONARIA';
    public const INTERELEC = 'INTERELEC';

    protected $connection = 'mysql';
    protected $table = 'promotoria_programaciones';

    public function visitas(): HasMany
    {
        return $this->hasMany(PromotoriaVisita::class, 'programacion_id');
    }
}
