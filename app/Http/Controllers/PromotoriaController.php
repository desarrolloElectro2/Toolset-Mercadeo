<?php

namespace App\Http\Controllers;

use App\Models\PromotoriaProgramacion;
use App\Models\PromotoriaVisita;
use App\Services\PromotoriaService;
use Illuminate\Http\Request;
use Inertia\Inertia;

// El controlador solo recibe la petición, llama al servicio y responde.
class PromotoriaController extends Controller
{
    public function __construct(private PromotoriaService $promotoriaService)
    {
    }

    // Lista de visitas programadas
    public function index(Request $request)
    {
        return Inertia::render('Promotoria/Index', $this->promotoriaService->listar($request));
    }

    public function create()
    {
        return Inertia::render('Promotoria/Form', $this->promotoriaService->datosFormulario());
    }

    public function store(Request $request)
    {
        $programacion = $this->promotoriaService->crear($request);

        return redirect()->route('promotoria.index', ['mes' => sprintf('%04d-%02d', $programacion->anio, $programacion->mes)])
            ->with('mensaje', "Programación #{$programacion->id} de {$programacion->promotor_nombre} creada con {$programacion->visitas()->count()} visita(s).");
    }

    // Editar (o consultar, si no tiene vis_edit) la programación del mes
    public function edit(PromotoriaProgramacion $programacion)
    {
        return Inertia::render('Promotoria/Form', $this->promotoriaService->datosFormulario($programacion));
    }

    public function update(Request $request, PromotoriaProgramacion $programacion)
    {
        $this->promotoriaService->actualizar($request, $programacion);

        return back()->with('mensaje', "Programación #{$programacion->id} actualizada.");
    }

    public function destroy(PromotoriaProgramacion $programacion)
    {
        $this->promotoriaService->eliminarProgramacion($programacion);

        return redirect()->route('promotoria.index')->with('mensaje', "Programación #{$programacion->id} eliminada.");
    }

    public function destroyVisita(PromotoriaVisita $visita)
    {
        $this->promotoriaService->eliminarVisita($visita);

        return back()->with('mensaje', 'Visita eliminada.');
    }

    // JSON: agencias principales de la regional (select dependiente)
    public function agencias(Request $request)
    {
        return response()->json($this->promotoriaService->agenciasPrincipales((string) $request->query('regional')));
    }

    // JSON: la agencia principal y sus puntos satélite (lugares de cada visita)
    public function lugares(string $codagen)
    {
        return response()->json($this->promotoriaService->lugares($codagen));
    }
}
