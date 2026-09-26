<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// toolset_inter.vendedores: asesores de interelec (solo lectura)
class Vendedor extends Model
{
    protected $connection = 'toolset_inter';
    protected $table = 'vendedores';
    public $timestamps = false;
}
