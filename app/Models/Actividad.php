<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

// Una actividad = un día de la programación mensual
class Actividad extends Model
{
    public const PROGRAMADA = 'PROGRAMADA';
    public const EN_PROCESO = 'EN_PROCESO';
    public const FINALIZADA = 'FINALIZADA';
    public const ANULADA = 'ANULADA';

    protected $connection = 'mysql';
    protected $table = 'actividades';

    protected $casts = [
        'fecha' => 'date:Y-m-d',
    ];

    public function programacion(): BelongsTo
    {
        return $this->belongsTo(ActividadProgramacion::class, 'programacion_id');
    }

    public function productos(): HasMany
    {
        return $this->hasMany(ActividadProducto::class, 'actividad_id');
    }

    public function historial(): HasMany
    {
        return $this->hasMany(ActividadHistorial::class, 'actividad_id');
    }
}
