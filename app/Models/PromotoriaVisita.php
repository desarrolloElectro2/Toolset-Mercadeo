<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Visita de un promotor: un día y una jornada (mañana / tarde) en una agencia, punto satélite o zona
class PromotoriaVisita extends Model
{
    public const MANANA = 'MANANA';
    public const TARDE = 'TARDE';
    public const PROGRAMADA = 'PROGRAMADA';

    protected $connection = 'mysql';
    protected $table = 'promotoria_visitas';

    protected $casts = [
        'fecha' => 'date:Y-m-d',
    ];

    public function programacion(): BelongsTo
    {
        return $this->belongsTo(PromotoriaProgramacion::class, 'programacion_id');
    }
}
