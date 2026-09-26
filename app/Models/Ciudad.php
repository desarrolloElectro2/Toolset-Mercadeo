<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// toolset_perf.ciudades (municipios; compartida, solo lectura)
class Ciudad extends Model
{
    protected $connection = 'toolset_perf';
    protected $table = 'ciudades';
    public $timestamps = false;
}
