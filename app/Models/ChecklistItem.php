<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChecklistItem extends Model
{
    protected $connection = 'mysql';
    protected $table = 'checklist_items';
    public $timestamps = false;
}
