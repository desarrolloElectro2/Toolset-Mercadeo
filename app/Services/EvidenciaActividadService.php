<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadHistorial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Evidencias de la actividad (fotos del evento) que carga el responsable; el gasto va en la legalización.
 * Los archivos van al disco del servidor: MERCADEO/ACTIVIDADES/{año}/{mes}/{día}/{id}/EVIDENCIA-{n}_...
 */
class EvidenciaActividadService
{
    private const TITULO = 'Evidencia de la actividad';

    private const MODULO_ARCHIVOS = 'ACTIVIDADES';
    private const MAX_ARCHIVOS = 10;

    public function __construct(
        private ArchivoService $archivoService,
        private MarcaFotoService $marcaFotoService,
    ) {
    }

    /** @return int cuántos archivos se subieron */
    public function subir(Request $request, Actividad $actividad): int
    {
        $validator = Validator::make($request->all(), [
            'archivos'   => ['required', 'array', 'min:1', 'max:'.self::MAX_ARCHIVOS],
            'archivos.*' => ['file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            ...MarcaFotoService::reglasUbicacion(),
        ], [
            'archivos.required'   => 'Seleccione al menos un archivo.',
            'archivos.max'        => 'Puede subir máximo '.self::MAX_ARCHIVOS.' archivos a la vez.',
            'archivos.*.mimes'    => 'Los archivos deben ser JPG, PNG o PDF.',
            'archivos.*.max'      => 'Cada archivo puede pesar máximo 5 MB.',
            'archivos.*.uploaded' => 'No se pudo subir un archivo; puede que supere el tamaño permitido por el servidor.',
        ]);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $coduser = (string) $request->user()->coduser;
        $rutas = [];

        try {
            // Un número por archivo para que no choquen los nombres si se suben en el mismo segundo
            $siguiente = DB::connection('mysql')->table('actividad_evidencias')->where('actividad_id', $actividad->id)->count() + 1;
            foreach ($request->file('archivos') as $i => $archivo) {
                // Fecha y hora de carga, ubicación y actividad escritas sobre las fotos (los PDF quedan igual)
                $this->marcaFotoService->marcar($archivo, $request, $actividad, self::TITULO);
                $rutas[] = [
                    'ruta'   => $this->archivoService->guardar($archivo, self::MODULO_ARCHIVOS, $actividad->id, 'EVIDENCIA-'.($siguiente + $i)),
                    'nombre' => mb_substr($archivo->getClientOriginalName(), 0, 255),
                ];
            }

            DB::connection('mysql')->transaction(function () use ($actividad, $coduser, $rutas) {
                DB::connection('mysql')->table('actividad_evidencias')->insert(array_map(fn ($r) => [
                    'actividad_id'    => $actividad->id,
                    'ruta'            => $r['ruta'],
                    'nombre_original' => $r['nombre'],
                    'user_new'        => $coduser,
                ], $rutas));

                $this->historial($actividad, count($rutas).' evidencia(s) de la actividad cargada(s)', $coduser);
            });
        } catch (\Throwable $e) {
            // No se dejan archivos huérfanos en el disco
            foreach ($rutas as $r) {
                $this->archivoService->eliminar($r['ruta']);
            }
            throw $e;
        }

        return count($rutas);
    }

    public function ver(Actividad $actividad, int $evidencia): BinaryFileResponse
    {
        return $this->archivoService->respuesta($this->buscar($actividad, $evidencia)->ruta);
    }

    public function eliminar(Request $request, Actividad $actividad, int $evidencia): void
    {
        $registro = $this->buscar($actividad, $evidencia);
        $coduser = (string) $request->user()->coduser;

        DB::connection('mysql')->transaction(function () use ($actividad, $registro, $coduser) {
            DB::connection('mysql')->table('actividad_evidencias')->where('id', $registro->id)->delete();
            $this->historial($actividad, "Evidencia eliminada: {$registro->nombre_original}", $coduser);
        });

        $this->archivoService->eliminar($registro->ruta);
    }

    private function buscar(Actividad $actividad, int $evidencia): object
    {
        $registro = DB::connection('mysql')->table('actividad_evidencias')
            ->where('actividad_id', $actividad->id)->where('id', $evidencia)->first();
        abort_unless($registro, 404);

        return $registro;
    }

    private function historial(Actividad $actividad, string $observacion, string $coduser): void
    {
        $historial = new ActividadHistorial();
        $historial->actividad_id = $actividad->id;
        $historial->estado       = $actividad->estado;
        $historial->observacion  = mb_substr($observacion, 0, 1000);
        $historial->user_new     = $coduser;
        $historial->save();
    }
}
