<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Archivos del proyecto en el disco del servidor (disco "samba", DISCO_4TB_PATH del .env).
 *
 * Estructura: MERCADEO/{MODULO}/{año}/{mes}/{día}/{id}/{PREFIJO}_{id}_{AAAAMMDD}_{HH-mm-ss}.{ext}
 *   ej. MERCADEO/ACTIVIDADES/2026/10/02/125/INICIO_125_20261002_08-30-15.jpg
 *
 * En la BD se guarda solo la ruta relativa que devuelve guardar(). La validación del archivo
 * (tipo, tamaño) la hace el servicio de cada módulo; aquí solo se guarda, entrega y borra.
 */
class ArchivoService
{
    private const DISCO = 'samba';
    private const CARPETA_SISTEMA = 'MERCADEO';

    /**
     * Guarda el archivo y devuelve su ruta relativa (para la BD).
     *
     * @param  string  $modulo   carpeta del módulo, ej. 'ACTIVIDADES'
     * @param  int|string  $id   registro dueño del archivo, ej. id de la actividad
     * @param  string  $prefijo  qué es el archivo, ej. 'INICIO', 'SOPORTE'
     */
    public function guardar(UploadedFile $archivo, string $modulo, int|string $id, string $prefijo, ?Carbon $fecha = null): string
    {
        $this->verificarDisponible();

        $fecha ??= now();
        $extension = strtolower($archivo->guessExtension() ?: $archivo->getClientOriginalExtension() ?: 'bin');

        $carpeta = implode('/', [
            self::CARPETA_SISTEMA,
            $this->limpiar($modulo),
            $fecha->format('Y'),
            $fecha->format('m'),
            $fecha->format('d'),
            $this->limpiar((string) $id),
        ]);
        $nombre = $this->limpiar($prefijo).'_'.$this->limpiar((string) $id).'_'.$fecha->format('Ymd').'_'.$fecha->format('H-i-s').'.'.$extension;

        Storage::disk(self::DISCO)->putFileAs($carpeta, $archivo, $nombre);

        return "{$carpeta}/{$nombre}";
    }

    // Entrega el archivo al navegador (usar desde una ruta protegida con el permiso del módulo)
    public function respuesta(string $rutaRelativa): BinaryFileResponse
    {
        $ruta = $this->rutaCompleta($rutaRelativa);

        abort_unless(is_file($ruta), 404, 'El archivo no existe en el disco del servidor.');

        return response()->file($ruta);
    }

    public function existe(?string $rutaRelativa): bool
    {
        return $rutaRelativa !== null && $rutaRelativa !== '' && Storage::disk(self::DISCO)->exists($rutaRelativa);
    }

    // Borra el archivo; si no existe o el disco no responde, solo se registra en el log
    public function eliminar(?string $rutaRelativa): void
    {
        if (! $this->existe($rutaRelativa)) {
            return;
        }

        try {
            Storage::disk(self::DISCO)->delete($rutaRelativa);
        } catch (\Throwable $e) {
            Log::warning("No se pudo eliminar el archivo {$rutaRelativa}: ".$e->getMessage());
        }
    }

    // El disco está montado y se puede escribir
    public function disponible(): bool
    {
        $raiz = config('filesystems.disks.'.self::DISCO.'.root');

        return is_string($raiz) && is_dir($raiz) && is_writable($raiz);
    }

    private function verificarDisponible(): void
    {
        if (! $this->disponible()) {
            Log::error('Disco de archivos no disponible: '.config('filesystems.disks.'.self::DISCO.'.root'));

            throw new \DomainException('El disco de archivos del servidor no está disponible. Intente de nuevo más tarde o avise a sistemas.');
        }
    }

    private function rutaCompleta(string $rutaRelativa): string
    {
        // Evita salir de la carpeta del disco con rutas como "../../"
        abort_if(str_contains($rutaRelativa, '..'), 404);

        return Storage::disk(self::DISCO)->path($rutaRelativa);
    }

    // Solo letras, números, guion y guion bajo (en mayúsculas para carpetas y prefijos)
    private function limpiar(string $texto): string
    {
        return Str::upper(preg_replace('/[^A-Za-z0-9_-]/', '', Str::ascii($texto)));
    }
}
