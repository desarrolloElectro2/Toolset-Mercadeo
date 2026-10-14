<?php

namespace App\Services;

use App\Models\Agencia;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Empleados de la agencia desde Manager ERP (PostgreSQL, vista electro.vw_tercero). Solo lectura.
 *  - Activo:  activo = 1
 *  - Cargo:   ccargo (ncargo es su nombre)
 *  - Agencia: centro_costo_contrato = "CÓDIGO-NOMBRE" (ej. "10413-POPAYAN 6"); el código es agencia.codigo_manager / codagen
 *  - Datos:   ccnit (cédula), nombre, vendedor_cod
 * Se usa para el responsable evento (según el tipo) y los asesores de planta / externos.
 */
class ResponsableAgenciaService
{
    /** Tipo de responsable => cargo */
    public const TIPOS = [
        'EVENTO_CORRERIA'     => ['nombre' => 'EVENTO CORRERÍA', 'cargo' => 'E105'],     // LIDER DE VENTAS JL&RB
        'EVENTO_AGENCIA'      => ['nombre' => 'EVENTO AGENCIA', 'cargo' => 'P016'],      // ASISTENTE COMERCIAL Y DE INVENTARIOS JL&RB
        'EVENTO_PTO_SATELITE' => ['nombre' => 'EVENTO PTO SATÉLITE', 'cargo' => 'E057'], // VT TIPO 1 JL&RB (asesor planta)
    ];

    /** Asesores por grupo => cargo */
    public const CARGOS_ASESORES = [
        'planta'   => 'E057', // VT TIPO 1 JL&RB (actividades en agencia)
        'externos' => 'E058', // VT TIPO 2 JL&RB (actividades en correría)
    ];

    /** Empleados activos por agencia (codagen => filas), para consultar Manager una sola vez por petición */
    private array $empleados = [];

    /** @return array<int, array{valor: string, nombre: string}> */
    public function tipos(): array
    {
        return collect(self::TIPOS)->map(fn ($t, $valor) => ['valor' => $valor, 'nombre' => $t['nombre']])->values()->all();
    }

    public function nombreTipo(?string $tipo): ?string
    {
        return $tipo === null ? null : (self::TIPOS[$tipo]['nombre'] ?? $tipo);
    }

    /**
     * Responsables evento de la agencia por tipo.
     * Devuelve null si Manager no responde, para que la pantalla lo informe en vez de mostrar "sin responsables".
     *
     * @return array<string, array<int, array{cedula: string, nombre: string, vendedor: ?string}>>|null  tipo => empleados
     */
    public function porAgencia(Agencia $agencia): ?array
    {
        $filas = $this->empleadosActivos($agencia);

        return $filas === null ? null : collect(self::TIPOS)->map(fn ($t) => $this->deCargo($filas, $t['cargo']))->all();
    }

    /**
     * Asesores de un grupo ('planta' | 'externos') de la agencia. null si Manager no responde.
     *
     * @return array<int, array{cedula: string, nombre: string, vendedor: ?string}>|null
     */
    public function asesores(Agencia $agencia, string $grupo): ?array
    {
        $filas = $this->empleadosActivos($agencia);

        return $filas === null ? null : $this->deCargo($filas, self::CARGOS_ASESORES[$grupo]);
    }

    /**
     * Nombre del empleado por su cédula; si Manager no responde o no existe, la cédula.
     */
    public function nombre(?string $cedula): ?string
    {
        if ($cedula === null || $cedula === '') {
            return null;
        }

        try {
            $nombre = DB::connection('mng')->table('electro.vw_tercero')->whereRaw('trim(ccnit) = ?', [$cedula])->value('nombre');
        } catch (\Throwable $e) {
            Log::error("No se pudo consultar el tercero {$cedula} en Manager: ".$e->getMessage());

            return $cedula;
        }

        return $nombre ? $this->limpiarNombre($nombre) : $cedula;
    }

    /**
     * Promotores activos (cargo con "PROMOT" en vw_tercero, de cualquier agencia), para la programación de visitas.
     * El nombre del cargo trae la marca (ej. "PROMOTOR EPSON"). null si Manager no responde.
     *
     * @return array<int, array{cedula: string, nombre: string, cargo: string}>|null
     */
    public function promotores(): ?array
    {
        try {
            $filas = DB::connection('mng')->select(
                "select trim(ccnit) as cedula, trim(nombre) as nombre, trim(ncargo) as cargo
                   from electro.vw_tercero
                  where activo = 1 and ncargo ilike '%promot%' and ncargo not ilike 'director%'
                  order by nombre"
            );
        } catch (\Throwable $e) {
            Log::error('No se pudieron consultar los promotores en Manager: '.$e->getMessage());

            return null;
        }

        return collect($filas)->unique('cedula')
            ->map(fn ($f) => ['cedula' => $f->cedula, 'nombre' => $this->limpiarNombre($f->nombre), 'cargo' => $f->cargo])
            ->values()->all();
    }

    /**
     * Nombres de varios empleados en una sola consulta (reportes). Si Manager no responde, cada uno queda con su cédula.
     *
     * @return array<string, string>  cédula => nombre
     */
    public function nombres(array $cedulas): array
    {
        $cedulas = array_values(array_unique(array_filter(array_map('strval', $cedulas))));
        $nombres = array_combine($cedulas, $cedulas) ?: [];
        if ($cedulas === []) {
            return [];
        }

        try {
            $filas = DB::connection('mng')->table('electro.vw_tercero')
                ->whereRaw('trim(ccnit) in ('.$this->marcadores($cedulas).')', $cedulas)
                ->get([DB::raw('trim(ccnit) as cedula'), 'nombre']);
        } catch (\Throwable $e) {
            Log::error('No se pudieron consultar los nombres de terceros en Manager: '.$e->getMessage());

            return $nombres;
        }

        foreach ($filas as $f) {
            $nombres[$f->cedula] = $this->limpiarNombre($f->nombre);
        }

        return $nombres;
    }

    // Empleados activos de la agencia con alguno de los cargos que usa el módulo
    private function empleadosActivos(Agencia $agencia): ?Collection
    {
        $clave = (string) $agencia->codagen;
        if (array_key_exists($clave, $this->empleados)) {
            return $this->empleados[$clave];
        }

        // Los puntos satélite tienen en Manager un código distinto al codagen (ej. 100501 -> 1050I)
        $centros = array_values(array_unique(array_filter([trim((string) $agencia->codigo_manager), trim((string) $agencia->codagen)])));
        $cargos = array_values(array_unique([...array_column(self::TIPOS, 'cargo'), ...array_values(self::CARGOS_ASESORES)]));

        try {
            $filas = DB::connection('mng')->select(
                'select trim(ccargo) as cargo, trim(ccnit) as cedula, trim(nombre) as nombre, trim(vendedor_cod) as vendedor
                   from electro.vw_tercero
                  where activo = 1
                    and trim(ccargo) in ('.$this->marcadores($cargos).')
                    and split_part(trim(centro_costo_contrato), \'-\', 1) in ('.$this->marcadores($centros).')
                  order by nombre',
                [...$cargos, ...$centros],
            );
        } catch (\Throwable $e) {
            Log::error("No se pudieron consultar los empleados en Manager (agencia {$agencia->codagen}): ".$e->getMessage());

            return $this->empleados[$clave] = null;
        }

        return $this->empleados[$clave] = collect($filas);
    }

    /** @return array<int, array{cedula: string, nombre: string, vendedor: ?string}> */
    private function deCargo(Collection $filas, string $cargo): array
    {
        return $filas->where('cargo', $cargo)
            ->unique('cedula') // la vista puede repetir a la persona
            ->map(fn ($f) => [
                'cedula'   => $f->cedula,
                'nombre'   => $this->limpiarNombre($f->nombre),
                'vendedor' => $f->vendedor !== null && $f->vendedor !== '' ? $f->vendedor : null,
            ])
            ->values()->all();
    }

    private function marcadores(array $valores): string
    {
        return implode(',', array_fill(0, count($valores), '?'));
    }

    // En Manager algunos nombres traen marcas al final ("*", "---#", "& #") y espacios de más
    private function limpiarNombre(string $nombre): string
    {
        return preg_replace(['/\P{L}+$/u', '/\s+/u'], ['', ' '], trim($nombre));
    }
}
