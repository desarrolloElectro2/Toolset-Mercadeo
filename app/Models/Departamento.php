<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// toolset_perf.departamentos (compartida, solo lectura)
class Departamento extends Model
{
    protected $connection = 'toolset_perf';
    protected $table = 'departamentos';
    public $timestamps = false;
}
