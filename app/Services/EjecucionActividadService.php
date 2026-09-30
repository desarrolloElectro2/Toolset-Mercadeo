<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadHistorial;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

// Ejecución de una actividad: Programada -> En proceso -> Finalizada, o Anulada
class EjecucionActividadService
{
    private const MODULO_ARCHIVOS = 'ACTIVIDADES';

    public function __construct(private ArchivoService $archivoService)
    {
    }

    // Hora de inicio + foto obligatoria => En proceso (la fecha es siempre la programada)
    public function iniciar(Request $request, Actividad $actividad): void
    {
        $this->exigirEstado($actividad, [Actividad::PROGRAMADA], 'iniciar');

        if ($actividad->fecha->gt(today())) {
            throw new \DomainException("La actividad #{$actividad->id} está programada para el {$actividad->fecha->format('d/m/Y')}; no se puede iniciar antes.");
        }

        $datos = $this->validar($request, [
            'hora_inicio'   => ['required', 'date_format:H:i'],
            'foto_inicio'   => ['required', 'file', 'image', 'mimes:jpg,jpeg,png', 'max:5120'],
            'observaciones' => ['nullable', 'string', 'max:1000'],
        ]);

        // La foto queda en la carpeta del día de la actividad: MERCADEO/ACTIVIDADES/{año}/{mes}/{día}/{id}/
        $momento = Carbon::parse($actividad->fecha->format('Y-m-d').' '.$datos['hora_inicio']);
        $rutaFoto = $this->archivoService->guardar($request->file('foto_inicio'), self::MODULO_ARCHIVOS, $actividad->id, 'INICIO', $momento);

        try {
            DB::connection('mysql')->transaction(function () use ($actividad, $datos, $rutaFoto, $request) {
                $actividad->estado        = Actividad::EN_PROCESO;
                $actividad->hora_inicio   = $datos['hora_inicio'];
                $actividad->foto_inicio   = $rutaFoto;
                $actividad->observaciones = $datos['observaciones'] ?? $actividad->observaciones;
                $actividad->user_update   = (string) $request->user()->coduser;
                $actividad->save();

                $this->registrarHistorial($actividad, "Actividad iniciada a las {$datos['hora_inicio']}", $request);
            });
        } catch (\Throwable $e) {
            // Si la BD falla no se deja la foto huérfana en el disco
            $this->archivoService->eliminar($rutaFoto);
            throw $e;
        }
    }

    // Hora de fin (posterior a la de inicio) => Finalizada
    public function finalizar(Request $request, Actividad $actividad): void
    {
        $this->exigirEstado($actividad, [Actividad::EN_PROCESO], 'finalizar');

        $datos = $this->validar($request, [
            'hora_fin'      => ['required', 'date_format:H:i'],
            'observaciones' => ['nullable', 'string', 'max:1000'],
        ]);

        $inicio = substr((string) $actividad->hora_inicio, 0, 5);
        if ($datos['hora_fin'] <= $inicio) {
            throw ValidationException::withMessages(['hora_fin' => "La hora de fin debe ser posterior a la hora de inicio ({$inicio})."]);
        }

        DB::connection('mysql')->transaction(function () use ($actividad, $datos, $request) {
            $actividad->estado        = Actividad::FINALIZADA;
            $actividad->hora_fin      = $datos['hora_fin'];
            $actividad->observaciones = $datos['observaciones'] ?? $actividad->observaciones;
            $actividad->user_update   = (string) $request->user()->coduser;
            $actividad->save();

            $this->registrarHistorial($actividad, "Actividad finalizada a las {$datos['hora_fin']}", $request);
        });
    }

    // Motivo obligatorio; solo Programadas o En proceso
    public function anular(Request $request, Actividad $actividad): void
    {
        $this->exigirEstado($actividad, [Actividad::PROGRAMADA, Actividad::EN_PROCESO], 'anular');

        $datos = $this->validar($request, [
            'motivo' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        DB::connection('mysql')->transaction(function () use ($actividad, $datos, $request) {
            $actividad->estado      = Actividad::ANULADA;
            $actividad->user_update = (string) $request->user()->coduser;
            $actividad->save();

            $this->registrarHistorial($actividad, 'Anulada: '.trim($datos['motivo']), $request);
        });
    }

    // Foto de inicio desde el disco del servidor
    public function foto(Actividad $actividad): BinaryFileResponse
    {
        abort_unless($actividad->foto_inicio, 404);

        return $this->archivoService->respuesta($actividad->foto_inicio);
    }

    private function exigirEstado(Actividad $actividad, array $estados, string $accion): void
    {
        if (! in_array($actividad->estado, $estados, true)) {
            $estado = mb_strtolower(str_replace('_', ' ', $actividad->estado));
            throw new \DomainException("No se puede {$accion} la actividad #{$actividad->id} porque está {$estado}.");
        }
    }

    private function validar(Request $request, array $reglas): array
    {
        $validator = Validator::make($request->all(), $reglas, [
            'hora_inicio.required'    => 'Digite la hora de inicio.',
            'hora_inicio.date_format' => 'La hora de inicio no es válida.',
            'hora_fin.required'       => 'Digite la hora de fin.',
            'hora_fin.date_format'    => 'La hora de fin no es válida.',
            'foto_inicio.required'    => 'La foto de inicio es obligatoria.',
            'foto_inicio.image'       => 'El archivo debe ser una imagen.',
            'foto_inicio.mimes'       => 'La foto debe ser JPG o PNG.',
            'foto_inicio.max'         => 'La foto no puede pesar más de 5 MB.',
            'foto_inicio.uploaded'    => 'No se pudo subir la foto; puede que supere el tamaño permitido por el servidor.',
            'observaciones.max'       => 'Las observaciones no pueden tener más de 1000 caracteres.',
            'motivo.required'         => 'Escriba el motivo de la anulación.',
            'motivo.min'              => 'El motivo debe tener al menos 5 caracteres.',
            'motivo.max'              => 'El motivo no puede tener más de 500 caracteres.',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    private function registrarHistorial(Actividad $actividad, string $observacion, Request $request): void
    {
        $historial = new ActividadHistorial();
        $historial->actividad_id = $actividad->id;
        $historial->estado       = $actividad->estado;
        $historial->observacion  = $observacion;
        $historial->user_new     = (string) $request->user()->coduser;
        $historial->save();
    }
}
