<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class Usuario extends Authenticatable
{
    use Notifiable;

    public $incrementing = false;
    public $timestamps = false;
    protected $connection = 'toolset_perf';
    protected $table = 'usuarios';
    protected $primaryKey = 'coduser';
    protected $keyType = 'string';
    protected $rememberTokenName = false;

    protected $hidden = ['contrasena', 'session_id', 'session_id_mercadeo'];

    /** Rol del usuario en mercadeo (usuarios.nivel_mercadeo -> toolset_mercadeo.roles.id). */
    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class, 'nivel_mercadeo', 'id');
    }

    public function tieneAccesoMercadeo(): bool
    {
        return $this->useractivo == '1' && (int) $this->nivel_mercadeo !== 0;
    }

    /** @return array<int, string> */
    public function permisos(): array
    {
        return $this->rol?->listaPermisos() ?? [];
    }

    public function tienePermiso(string $codigo): bool
    {
        return in_array($codigo, $this->permisos(), true);
    }
}
