<?php

namespace App\Services;

use App\Models\Actividad;
use App\Models\ActividadHistorial;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Legalización de gasto: conceptos (elementos del checklist con presupuesto autorizado), detalle y
 * los soportes (cotizaciones / autorizaciones) con su valor. Una actividad puede tener varias.
 *  - Solo con el presupuesto ya autorizado y si la actividad no está anulada.
 *  - La suma de los valores de todas sus legalizaciones no puede superar el presupuesto autorizado.
 * Los archivos van al disco del servidor: MERCADEO/ACTIVIDADES/{año}/{mes}/{día}/{id}/LEGALIZACION-{n}-{fila}_...
 */
class LegalizacionActividadService
{
    private const MODULO_ARCHIVOS = 'ACTIVIDADES';
    private const MAX_ARCHIVOS = 10;

    public function __construct(
        private ArchivoService $archivoService,
        private PresupuestoActividadService $presupuestoService,
    ) {
    }

    /** Lo que necesita la sección Legalización de Gasto en la edición de la actividad */
    public function paraVista(Actividad $actividad): array
    {
        $legalizaciones = DB::connection('mysql')->table('actividad_legalizaciones')
            ->where('actividad_id', $actividad->id)->orderBy('id')->get();
        $ids = $legalizaciones->pluck('id')->all();
        $conceptos = DB::connection('mysql')->table('actividad_legalizacion_conceptos')
            ->whereIn('legalizacion_id', $ids)->orderBy('id')->get()->groupBy('legalizacion_id');
        $archivos = DB::connection('mysql')->table('actividad_legalizacion_archivos')
            ->whereIn('legalizacion_id', $ids)->orderBy('id')->get()->groupBy('legalizacion_id');
        $usuarios = Usuario::query()->whereIn('coduser', $legalizaciones->pluck('user_new')->unique())->pluck('nombre', 'coduser');

        return [
            'motivoBloqueo' => $this->motivoBloqueo($actividad),
            'autorizado'    => $this->totalAutorizado($actividad),
            'legalizado'    => $this->totalLegalizado($actividad),
            'conceptos'     => $this->conceptosDisponibles($actividad),
            'registros'     => $legalizaciones->map(fn ($l) => [
                'id'        => (int) $l->id,
                'detalle'   => $l->detalle,
                'conceptos' => $conceptos->get($l->id, collect())->pluck('nombre')->all(),
                'archivos'  => $archivos->get($l->id, collect())->map(fn ($a) => [
                    'id'     => (int) $a->id,
                    'nombre' => $a->nombre,
                    'valor'  => (float) $a->valor,
                    'esPdf'  => str_ends_with(strtolower($a->ruta), '.pdf'),
                ])->values()->all(),
                'total'     => (float) $archivos->get($l->id, collect())->sum(fn ($a) => (float) $a->valor),
                'usuario'   => $usuarios[$l->user_new] ?? $l->user_new,
                'fecha'     => $l->created_at ? substr((string) $l->created_at, 0, 16) : null,
            ])->all(),
        ];
    }

    /** @return string Mensaje para el usuario */
    public function registrar(Request $request, Actividad $actividad): string
    {
        $motivo = $this->motivoBloqueo($actividad);
        if ($motivo !== null) {
            throw new \DomainException($motivo);
        }

        $datos = $this->validar($request, $actividad);
        $valor = (float) collect($datos['archivos'])->sum(fn ($a) => (float) $a['valor']);
        $this->verificarTope($actividad, $valor);

        $coduser = (string) $request->user()->coduser;
        $rutas = [];

        try {
            // Primero los archivos en el disco; si la BD falla se borran
            $lote = DB::connection('mysql')->table('actividad_legalizaciones')->where('actividad_id', $actividad->id)->count() + 1;
            foreach ($datos['archivos'] as $i => $fila) {
                $archivo = $request->file("archivos.$i.archivo");
                $rutas[$i] = $this->archivoService->guardar($archivo, self::MODULO_ARCHIVOS, $actividad->id, "LEGALIZACION-{$lote}-".($i + 1));
            }

            DB::connection('mysql')->transaction(function () use ($actividad, $datos, $valor, $coduser, $rutas, $request) {
                // Con la actividad bloqueada se revisa otra vez el tope (por si otro usuario legalizó a la vez)
                Actividad::query()->whereKey($actividad->id)->lockForUpdate()->first();
                $this->verificarTope($actividad, $valor);

                $id = DB::connection('mysql')->table('actividad_legalizaciones')->insertGetId([
                    'actividad_id' => $actividad->id,
                    'detalle'      => trim($datos['detalle']),
                    'user_new'     => $coduser,
                ]);

                DB::connection('mysql')->table('actividad_legalizacion_conceptos')->insert(
                    array_map(fn ($nombre) => ['legalizacion_id' => $id, 'nombre' => $nombre], array_values(array_unique($datos['conceptos'])))
                );

                DB::connection('mysql')->table('actividad_legalizacion_archivos')->insert(
                    collect($datos['archivos'])->map(fn ($fila, $i) => [
                        'legalizacion_id' => $id,
                        'nombre'          => mb_strtoupper(trim($fila['nombre'])),
                        'valor'           => $fila['valor'],
                        'ruta'            => $rutas[$i],
                        'nombre_original' => mb_substr($request->file("archivos.$i.archivo")->getClientOriginalName(), 0, 255),
                    ])->values()->all()
                );

                $this->historial($actividad, 'Legalización de gasto registrada ('.implode(', ', $datos['conceptos']).'): '.PresupuestoActividadService::pesos($valor), $coduser);
            });
        } catch (\Throwable $e) {
            foreach ($rutas as $ruta) {
                $this->archivoService->eliminar($ruta);
            }
            throw $e;
        }

        return "Legalización registrada en la actividad #{$actividad->id} por ".PresupuestoActividadService::pesos($valor).'.';
    }

    public function verArchivo(Actividad $actividad, int $archivo): BinaryFileResponse
    {
        $registro = DB::connection('mysql')->table('actividad_legalizacion_archivos as a')
            ->join('actividad_legalizaciones as l', 'l.id', '=', 'a.legalizacion_id')
            ->where('l.actividad_id', $actividad->id)->where('a.id', $archivo)
            ->first(['a.ruta']);
        abort_unless($registro, 404);

        return $this->archivoService->respuesta($registro->ruta);
    }

    public function eliminar(Request $request, Actividad $actividad, int $legalizacion): void
    {
        $registro = DB::connection('mysql')->table('actividad_legalizaciones')
            ->where('actividad_id', $actividad->id)->where('id', $legalizacion)->first();
        abort_unless($registro, 404);

        $archivos = DB::connection('mysql')->table('actividad_legalizacion_archivos')->where('legalizacion_id', $registro->id)->get();
        $coduser = (string) $request->user()->coduser;

        // Sin llaves foráneas: los detalles se borran desde aquí
        DB::connection('mysql')->transaction(function () use ($actividad, $registro, $archivos, $coduser) {
            DB::connection('mysql')->table('actividad_legalizacion_archivos')->where('legalizacion_id', $registro->id)->delete();
            DB::connection('mysql')->table('actividad_legalizacion_conceptos')->where('legalizacion_id', $registro->id)->delete();
            DB::connection('mysql')->table('actividad_legalizaciones')->where('id', $registro->id)->delete();

            $this->historial($actividad, 'Legalización de gasto eliminada: '.PresupuestoActividadService::pesos((float) $archivos->sum('valor')), $coduser);
        });

        foreach ($archivos as $a) {
            $this->archivoService->eliminar($a->ruta);
        }
    }

    // null = se puede legalizar
    private function motivoBloqueo(Actividad $actividad): ?string
    {
        if ($actividad->estado === EstadoActividadService::ANULADA) {
            return 'La actividad está anulada: no se puede legalizar.';
        }
        if (! $this->presupuestoService->estaAutorizado($actividad)) {
            return 'Se puede legalizar cuando el presupuesto de la actividad esté autorizado.';
        }

        return null;
    }

    /** Elementos del checklist con presupuesto autorizado: son los conceptos que se pueden legalizar */
    private function conceptosDisponibles(Actividad $actividad): array
    {
        return DB::connection('mysql')->table('actividad_checklist')
            ->where('actividad_id', $actividad->id)->where('presupuesto_autorizado', '>', 0)
            ->orderBy('id')->pluck('nombre')->all();
    }

    private function totalAutorizado(Actividad $actividad): float
    {
        return (float) DB::connection('mysql')->table('actividad_checklist')
            ->where('actividad_id', $actividad->id)->sum('presupuesto_autorizado');
    }

    private function totalLegalizado(Actividad $actividad): float
    {
        return (float) DB::connection('mysql')->table('actividad_legalizacion_archivos as a')
            ->join('actividad_legalizaciones as l', 'l.id', '=', 'a.legalizacion_id')
            ->where('l.actividad_id', $actividad->id)->sum('a.valor');
    }

    private function verificarTope(Actividad $actividad, float $valor): void
    {
        $autorizado = $this->totalAutorizado($actividad);
        $legalizado = $this->totalLegalizado($actividad);

        if (round($legalizado + $valor, 2) > round($autorizado, 2)) {
            $disponible = max(0, $autorizado - $legalizado);
            throw ValidationException::withMessages([
                'archivos' => 'El valor de la legalización ('.PresupuestoActividadService::pesos($valor).') supera lo disponible del presupuesto autorizado ('
                    .PresupuestoActividadService::pesos($disponible).' de '.PresupuestoActividadService::pesos($autorizado).').',
            ]);
        }
    }

    private function validar(Request $request, Actividad $actividad): array
    {
        $validator = Validator::make($request->all(), [
            'conceptos'           => ['required', 'array', 'min:1'],
            'conceptos.*'         => ['required', 'string', 'distinct', Rule::in($this->conceptosDisponibles($actividad))],
            'detalle'             => ['required', 'string', 'min:5', 'max:1000'],
            'archivos'            => ['required', 'array', 'min:1', 'max:'.self::MAX_ARCHIVOS],
            'archivos.*.nombre'   => ['required', 'string', 'max:150'],
            'archivos.*.valor'    => ['required', 'numeric', 'gt:0', 'max:999999999999'],
            'archivos.*.archivo'  => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ], [
            'conceptos.required'          => 'Seleccione al menos un concepto.',
            'conceptos.*.required'        => 'Seleccione el concepto.',
            'conceptos.*.distinct'        => 'El concepto está repetido.',
            'conceptos.*.in'              => 'El concepto no tiene presupuesto autorizado en el checklist.',
            'detalle.required'            => 'Escriba el detalle de la legalización.',
            'detalle.min'                 => 'El detalle debe tener al menos 5 caracteres.',
            'detalle.max'                 => 'El detalle no puede tener más de 1000 caracteres.',
            'archivos.required'           => 'Agregue al menos un archivo.',
            'archivos.max'                => 'Puede agregar máximo '.self::MAX_ARCHIVOS.' archivos.',
            'archivos.*.nombre.required'  => 'Escriba el nombre del archivo.',
            'archivos.*.nombre.max'       => 'El nombre no puede tener más de 150 caracteres.',
            'archivos.*.valor.required'   => 'Digite el valor.',
            'archivos.*.valor.numeric'    => 'El valor debe ser un número.',
            'archivos.*.valor.gt'         => 'El valor debe ser mayor a cero.',
            'archivos.*.valor.max'        => 'El valor es demasiado alto.',
            'archivos.*.archivo.required' => 'Seleccione el archivo.',
            'archivos.*.archivo.mimes'    => 'El archivo debe ser JPG, PNG o PDF.',
            'archivos.*.archivo.max'      => 'El archivo puede pesar máximo 5 MB.',
            'archivos.*.archivo.uploaded' => 'No se pudo subir el archivo; puede que supere el tamaño permitido por el servidor.',
        ]);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
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
