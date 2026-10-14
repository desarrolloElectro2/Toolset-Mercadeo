<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\Agencia;
use App\Models\Ciudad;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

/**
 * Escribe sobre las fotos que se cargan una franja con la fecha y hora de carga, la ubicación y la actividad.
 * La ubicación la envía el navegador (latitud, longitud, precision); si no llega, se toma del GPS de la foto (EXIF).
 * Se modifica el archivo temporal antes de guardarlo (ArchivoService), así lo guardado ya lleva la marca.
 */
class MarcaFotoService
{
    // Fuentes TrueType que se intentan en orden (Windows / Linux); sin ninguna se usa la fuente interna de GD
    private const FUENTES = [
        'C:\\Windows\\Fonts\\arialbd.ttf',
        'C:\\Windows\\Fonts\\arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/TTF/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    ];

    /** Reglas de validación de la ubicación que envía el navegador (se suman a las del formulario) */
    public static function reglasUbicacion(): array
    {
        return [
            'latitud'   => ['nullable', 'numeric', 'between:-90,90'],
            'longitud'  => ['nullable', 'numeric', 'between:-180,180'],
            'precision' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * Marca la foto si es JPG o PNG (los PDF se dejan igual). Si algo falla, la foto se guarda sin marca.
     */
    public function marcar(UploadedFile $archivo, Request $request, Actividad $actividad, string $titulo): void
    {
        $ruta = $archivo->getRealPath();
        $tipo = @exif_imagetype($ruta);
        if (! in_array($tipo, [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
            return;
        }

        try {
            $imagen = $tipo === IMAGETYPE_JPEG ? @imagecreatefromjpeg($ruta) : @imagecreatefrompng($ruta);
            if (! $imagen) {
                return;
            }

            $exif = $tipo === IMAGETYPE_JPEG ? (@exif_read_data($ruta) ?: []) : [];
            $imagen = $this->orientar($imagen, (int) ($exif['Orientation'] ?? 1));

            $lineas = [
                $titulo.' · '.now()->format('d/m/Y h:i:s a'),
                $this->ubicacion($request, $exif),
                $this->actividad($actividad),
            ];
            $this->escribir($imagen, $lineas);

            $tipo === IMAGETYPE_JPEG ? imagejpeg($imagen, $ruta, 88) : imagepng($imagen, $ruta, 6);
            imagedestroy($imagen);
        } catch (\Throwable $e) {
            Log::warning("No se pudo marcar la foto de la actividad #{$actividad->id}: ".$e->getMessage());
        }
    }

    // "Ubicación: 1.21361, -77.28111 (±15 m)"; del navegador o, si no llegó, del GPS de la foto
    private function ubicacion(Request $request, array $exif): string
    {
        $lat = $request->input('latitud');
        $lon = $request->input('longitud');

        if (is_numeric($lat) && is_numeric($lon)) {
            $precision = is_numeric($request->input('precision')) ? ' (±'.round((float) $request->input('precision')).' m)' : '';

            return sprintf('Ubicación: %.5f, %.5f%s', $lat, $lon, $precision);
        }

        $gps = $this->gpsExif($exif);

        return $gps ? sprintf('Ubicación (GPS de la foto): %.5f, %.5f', $gps[0], $gps[1]) : 'Ubicación no disponible';
    }

    private function actividad(Actividad $actividad): string
    {
        $programacion = $actividad->programacion;
        $agencia = Agencia::query()->where('codagen', $programacion?->agencia_id)->value('agennom');
        $municipio = Ciudad::query()->where('id', $actividad->ciudad_id)->value('ciudad');

        return trim("Actividad #{$actividad->id} · ".implode(' · ', array_filter([$agencia, $municipio])), ' ·');
    }

    /** @return array{0: float, 1: float}|null */
    private function gpsExif(array $exif): ?array
    {
        if (! isset($exif['GPSLatitude'], $exif['GPSLongitude'], $exif['GPSLatitudeRef'], $exif['GPSLongitudeRef'])) {
            return null;
        }

        $grados = function (array $partes): float {
            $valor = fn ($p) => str_contains((string) $p, '/') ? (float) explode('/', $p)[0] / max(1, (float) explode('/', $p)[1]) : (float) $p;

            return $valor($partes[0] ?? 0) + $valor($partes[1] ?? 0) / 60 + $valor($partes[2] ?? 0) / 3600;
        };

        $lat = $grados($exif['GPSLatitude']) * ($exif['GPSLatitudeRef'] === 'S' ? -1 : 1);
        $lon = $grados($exif['GPSLongitude']) * ($exif['GPSLongitudeRef'] === 'W' ? -1 : 1);

        return [$lat, $lon];
    }

    // Las fotos de celular traen la rotación en EXIF; se aplica para que la franja quede abajo
    private function orientar(\GdImage $imagen, int $orientacion): \GdImage
    {
        $angulo = match ($orientacion) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        return $angulo === 0 ? $imagen : (imagerotate($imagen, $angulo, 0) ?: $imagen);
    }

    // Franja semitransparente abajo con las líneas en blanco; el tamaño de letra depende del ancho de la foto
    private function escribir(\GdImage $imagen, array $lineas): void
    {
        $ancho = imagesx($imagen);
        $alto = imagesy($imagen);
        $fuente = collect(self::FUENTES)->first(fn ($f) => is_file($f));
        $blanco = imagecolorallocate($imagen, 255, 255, 255);
        $fondo = imagecolorallocatealpha($imagen, 0, 0, 0, 50);

        if ($fuente && function_exists('imagettftext')) {
            $tamano = max(10, (int) round($ancho / 55));
            $alturaLinea = (int) round($tamano * 1.6);
            $margen = (int) round($tamano * 0.8);
            $franja = $alturaLinea * count($lineas) + $margen * 2;

            imagefilledrectangle($imagen, 0, $alto - $franja, $ancho, $alto, $fondo);
            foreach ($lineas as $i => $linea) {
                imagettftext($imagen, $tamano, 0, $margen, $alto - $franja + $margen + $alturaLinea * ($i + 1) - (int) round($tamano * 0.45), $blanco, $fuente, $linea);
            }

            return;
        }

        // Sin fuente TrueType: fuente interna de GD (sin tildes), escrita en pequeño y ampliada
        $escala = max(1, (int) floor($ancho / 600));
        $alturaLinea = imagefontheight(5) + 4;
        $capa = imagecreatetruecolor((int) ceil($ancho / $escala), $alturaLinea * count($lineas) + 8);
        imagefill($capa, 0, 0, imagecolorallocate($capa, 0, 0, 0));
        foreach ($lineas as $i => $linea) {
            imagestring($capa, 5, 6, 4 + $alturaLinea * $i, iconv('UTF-8', 'ASCII//TRANSLIT', $linea) ?: $linea, imagecolorallocate($capa, 255, 255, 255));
        }
        $franja = imagesy($capa) * $escala;
        imagecopyresized($imagen, $capa, 0, $alto - $franja, 0, 0, $ancho, $franja, imagesx($capa), imagesy($capa));
        imagedestroy($capa);
    }
}
