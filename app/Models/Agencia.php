<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// toolset_perf.agencia (compartida, solo lectura)
class Agencia extends Model
{
    protected $connection = 'toolset_perf';
    protected $table = 'agencia';
    protected $primaryKey = 'codagen';
    protected $keyType = 'string';
    public $incrementing = false;
    public $timestamps = false;
}
