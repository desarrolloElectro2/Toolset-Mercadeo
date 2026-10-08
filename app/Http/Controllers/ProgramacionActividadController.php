<?php

namespace App\Http\Controllers;

use App\Models\ActividadProgramacion;
use App\Services\ProgramacionActividadService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class ProgramacionActividadController extends Controller
{
    public function __construct(private ProgramacionActividadService $programacionService)
    {
    }

    // Formulario de programación mensual (?programacion=ID abre con esa agencia y mes para agregar actividades)
    public function create(Request $request)
    {
        $programacion = $request->filled('programacion')
            ? ActividadProgramacion::query()->find((int) $request->query('programacion'))
            : null;

        return Inertia::render(
            'Actividades/Programacion/Create',
            $this->programacionService->datosFormulario($programacion),
        );
    }

    // Guarda la programación nueva, o agrega las actividades a la existente del mes
    public function store(Request $request)
    {
        $resultado = $this->programacionService->crear($request);

        $mensaje = $resultado['existente']
            ? "Se agregaron {$resultado['creadas']} actividad(es) a la programación del mes."
            : "Programación creada con {$resultado['creadas']} actividad(es) en estado Programada.";

        return redirect()->route('actividades.index')->with('mensaje', $mensaje);
    }

    // JSON: agencias activas de la regional (select dependiente)
    public function agencias(Request $request)
    {
        return response()->json(
            $this->programacionService->agenciasDeRegional((string) $request->query('regional')),
        );
    }

    // JSON: coordinador regional, municipios, asesores e inventario de la agencia
    public function datosAgencia(string $codagen)
    {
        return response()->json($this->programacionService->datosAgencia($codagen));
    }

    // JSON: { programacion: {...} | null } con la programación que ya tiene la agencia en el mes.
    // Va envuelto porque response()->json(null) responde "{}" y no "null".
    public function programacionExistente(Request $request)
    {
        return response()->json([
            'programacion' => $this->programacionService->programacionExistente(
                (string) $request->query('agencia'),
                (string) $request->query('mes'),
            ),
        ]);
    }
}
