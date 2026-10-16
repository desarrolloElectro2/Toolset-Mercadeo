<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadEstado;
use App\Models\ActividadHistorial;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Estado Mercadeo: el estado se cambia manualmente a cualquiera de la matriz
 * (Configuración › Estados actividad). Lo que exige cada uno sale de sus reglas:
 *  - requiere_inicio:      hora de inicio + foto de inicio (no antes del día programado)
 *  - requiere_fin:         solo el archivo de soporte (foto o PDF); no pide los datos de inicio
 *  - requiere_observacion: observación obligatoria (motivo del cambio)
 *  - permiso:              el que exige el código para cada estado (EstadoActividadService::permiso)
 *  - presupuesto:          a PRESUPUESTO ASIGNADO / AUTORIZADO con las reglas de PresupuestoActividadService;
 *                          al autorizar, el presupuesto asignado pasa al autorizado
 * Lo que la actividad ya tiene (horas, foto, archivo) no se vuelve a pedir; si se envía, se reemplaza.
 * Dejando el mismo estado solo se actualizan las observaciones generales.
 */
class EjecucionActividadService
{
    private const MODULO_ARCHIVOS = 'ACTIVIDADES';

    public function __construct(
        private ArchivoService $archivoService,
        private EstadoActividadService $estadoService,
        private MarcaFotoService $marcaFotoService,
        private PresupuestoActividadService $presupuestoService,
    ) {
    }

    /** @return string Mensaje para el usuario */
    public function cambiarEstado(Request $request, Actividad $actividad): string
    {
        $codigo = (string) $request->input('estado');
        $mismoEstado = $codigo === $actividad->estado;

        if ($mismoEstado) {
            if (! $request->user()->can('act_edit')) {
                throw new \DomainException('No tiene permiso para modificar las observaciones de la actividad.');
            }

            $datos = $this->validar($request, ['observaciones' => ['required', 'string', 'max:1000']]);
            $this->guardar($actividad, $request, ['observaciones' => trim($datos['observaciones'])], [], 'Observaciones actualizadas');

            return "Observaciones de la actividad #{$actividad->id} guardadas.";
        }

        $estado = $this->estadoService->porCodigo($codigo);
        if ($estado === null) {
            throw ValidationException::withMessages(['estado' => 'El estado no es válido.']);
        }

        if (! $request->user()->can($this->estadoService->permiso($estado->codigo))) {
            throw new \DomainException("No tiene permiso para pasar actividades a «{$estado->nombre}».");
        }

        $motivo = $this->presupuestoService->motivoRechazo($actividad, $estado->codigo);
        if ($motivo !== null) {
            throw new \DomainException("La actividad #{$actividad->id} no se puede pasar a «{$estado->nombre}»: {$motivo}.");
        }

        // Lo que exige iniciar o finalizar no se registra antes del día programado
        if ($estado->requiere_inicio && $actividad->fecha->gt(today())) {
            throw new \DomainException("La actividad #{$actividad->id} está programada para el {$actividad->fecha->format('d/m/Y')}; no se puede pasar a «{$estado->nombre}» antes.");
        }

        $datos = $this->validar($request, $this->reglas($estado, $actividad));

        $cambios = ['estado' => $estado->codigo];
        $archivos = [];

        if (! empty($datos['observaciones'])) {
            $cambios['observaciones'] = trim($datos['observaciones']);
        }

        if ($this->pideInicio($estado)) {
            if (! empty($datos['hora_inicio'])) {
                $cambios['hora_inicio'] = $datos['hora_inicio'];
            }
            if ($request->hasFile('foto_inicio')) {
                $archivos['foto_inicio'] = ['archivo' => $request->file('foto_inicio'), 'prefijo' => 'INICIO', 'hora' => $cambios['hora_inicio'] ?? $actividad->hora_inicio, 'titulo' => 'Foto de inicio'];
            }
        }

        $inicio = substr((string) ($cambios['hora_inicio'] ?? $actividad->hora_inicio), 0, 5);

        // Al finalizar solo se carga el archivo de soporte (queda en la carpeta del día con la hora de carga)
        if ($estado->requiere_fin && $request->hasFile('archivo_fin')) {
            $archivos['archivo_fin'] = ['archivo' => $request->file('archivo_fin'), 'prefijo' => 'FIN', 'hora' => now()->format('H:i'), 'titulo' => 'Soporte de finalización'];
        }

        // Al autorizar, el presupuesto asignado pasa al autorizado (en la misma transacción del cambio de estado)
        $alGuardar = $estado->codigo === EstadoActividadService::PRESUPUESTO_AUTORIZADO
            ? fn () => $this->presupuestoService->copiarAutorizado($actividad)
            : null;

        $this->guardar($actividad, $request, $cambios, $archivos, $this->textoHistorial($estado, $datos, $inicio), $alGuardar);

        return "Actividad #{$actividad->id}: estado cambiado a {$estado->nombre}.";
    }

    // Archivo de finalización (foto o PDF) desde el disco del servidor
    public function archivoFin(Actividad $actividad): BinaryFileResponse
    {
        abort_unless($actividad->archivo_fin, 404);

        return $this->archivoService->respuesta($actividad->archivo_fin);
    }

    // Foto de inicio desde el disco del servidor
    public function foto(Actividad $actividad): BinaryFileResponse
    {
        abort_unless($actividad->foto_inicio, 404);

        return $this->archivoService->respuesta($actividad->foto_inicio);
    }

    // Obligatorio si la actividad aún no lo tiene; si ya lo tiene, se puede reemplazar
    private function reglas(ActividadEstado $estado, Actividad $actividad): array
    {
        $obligatorio = fn ($valorActual) => $valorActual ? 'nullable' : 'required';

        $reglas = [
            'observaciones' => ['nullable', 'string', 'max:1000'],
            'motivo'        => [$estado->requiere_observacion ? 'required' : 'nullable', 'string', 'min:5', 'max:500'],
            ...MarcaFotoService::reglasUbicacion(), // ubicación del navegador para marcar las fotos
        ];

        if ($this->pideInicio($estado)) {
            $reglas['hora_inicio'] = [$obligatorio($actividad->hora_inicio), 'date_format:H:i'];
            $reglas['foto_inicio'] = [$obligatorio($actividad->foto_inicio), 'file', 'image', 'mimes:jpg,jpeg,png', 'max:5120'];
        }

        if ($estado->requiere_fin) {
            $reglas['archivo_fin'] = [$obligatorio($actividad->archivo_fin), 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'];
        }

        return $reglas;
    }

    // Al finalizar no se piden los datos de inicio: solo el archivo de soporte
    private function pideInicio(ActividadEstado $estado): bool
    {
        return $estado->requiere_inicio && ! $estado->requiere_fin;
    }

    private function textoHistorial(ActividadEstado $estado, array $datos, string $inicio): string
    {
        $texto = "Cambio a {$estado->nombre}";

        if ($this->pideInicio($estado)) {
            $texto .= " (hora de inicio {$inicio})";
        }

        if (! empty($datos['motivo'])) {
            $texto .= ': '.trim($datos['motivo']);
        }

        return $texto;
    }

    /**
     * Guarda los archivos nuevos en el disco, aplica los cambios y registra el historial.
     * Si la BD falla se borran los archivos nuevos; si todo sale bien, los que fueron reemplazados.
     */
    private function guardar(Actividad $actividad, Request $request, array $cambios, array $archivos, string $observacion, ?\Closure $alGuardar = null): void
    {
        $nuevos = [];
        $reemplazados = [];

        try {
            // Los archivos quedan en la carpeta del día de la actividad: MERCADEO/ACTIVIDADES/{año}/{mes}/{día}/{id}/
            foreach ($archivos as $campo => $a) {
                // Fecha y hora de carga, ubicación y actividad escritas sobre la foto (los PDF quedan igual)
                $this->marcaFotoService->marcar($a['archivo'], $request, $actividad, $a['titulo']);
                $momento = Carbon::parse($actividad->fecha->format('Y-m-d').' '.substr((string) $a['hora'], 0, 5));
                $nuevos[$campo] = $this->archivoService->guardar($a['archivo'], self::MODULO_ARCHIVOS, $actividad->id, $a['prefijo'], $momento);
                $reemplazados[] = $actividad->{$campo};
            }

            DB::connection('mysql')->transaction(function () use ($actividad, $request, $cambios, $nuevos, $observacion, $alGuardar) {
                if ($alGuardar !== null) {
                    $alGuardar();
                }

                foreach ($cambios + $nuevos as $campo => $valor) {
                    $actividad->{$campo} = $valor;
                }
                $actividad->user_update = (string) $request->user()->coduser;
                $actividad->save();

                $historial = new ActividadHistorial();
                $historial->actividad_id = $actividad->id;
                $historial->estado       = $actividad->estado;
                $historial->observacion  = mb_substr($observacion, 0, 1000);
                $historial->user_new     = (string) $request->user()->coduser;
                $historial->save();
            });
        } catch (\Throwable $e) {
            // No se dejan archivos huérfanos en el disco
            foreach ($nuevos as $ruta) {
                $this->archivoService->eliminar($ruta);
            }
            throw $e;
        }

        foreach ($reemplazados as $ruta) {
            $this->archivoService->eliminar($ruta);
        }
    }

    private function validar(Request $request, array $reglas): array
    {
        $validator = Validator::make($request->all(), $reglas, [
            'hora_inicio.required'    => 'Digite la hora de inicio.',
            'hora_inicio.date_format' => 'La hora de inicio no es válida.',
            'foto_inicio.required'    => 'La foto de inicio es obligatoria.',
            'foto_inicio.image'       => 'El archivo debe ser una imagen.',
            'foto_inicio.mimes'       => 'La foto debe ser JPG o PNG.',
            'foto_inicio.max'         => 'La foto no puede pesar más de 5 MB.',
            'foto_inicio.uploaded'    => 'No se pudo subir la foto; puede que supere el tamaño permitido por el servidor.',
            'archivo_fin.required'    => 'El archivo de finalización es obligatorio.',
            'archivo_fin.mimes'       => 'El archivo debe ser JPG, PNG o PDF.',
            'archivo_fin.max'         => 'El archivo no puede pesar más de 5 MB.',
            'archivo_fin.uploaded'    => 'No se pudo subir el archivo; puede que supere el tamaño permitido por el servidor.',
            'observaciones.required'  => 'Escriba las observaciones.',
            'observaciones.max'       => 'Las observaciones no pueden tener más de 1000 caracteres.',
            'motivo.required'         => 'Escriba la observación del cambio de estado.',
            'motivo.min'              => 'La observación debe tener al menos 5 caracteres.',
            'motivo.max'              => 'La observación no puede tener más de 500 caracteres.',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }
}
