import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import { IconoReporteActividades } from '@/components/Iconos';
import Paginacion from '@/components/Paginacion';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';
import { Paginado } from '@/types';

type Fila = Record<string, string | number>;

interface Props {
    filtros: { desde: string; hasta: string };
    /** Clave de la fila => título de la columna (mismo orden que el CSV) */
    columnas: Record<string, string>;
    resultado: {
        actividades: Paginado<Fila>;
        totales: { actividades: number; presupuestoAsignado: number; presupuestoAutorizado: number };
    } | null;
    errors?: Record<string, string>;
}

const COLUMNAS_PESOS = ['presupuestoAsignado', 'presupuestoAutorizado'];
const pesos = (valor: number) => `$ ${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;

// Primer y último día del mes actual ("YYYY-MM-DD"), para empezar con un rango útil
function mesActual(): { desde: string; hasta: string } {
    const hoy = new Date();
    const dos = (n: number) => String(n).padStart(2, '0');
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const base = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}`;
    return { desde: `${base}-01`, hasta: `${base}-${dos(ultimo)}` };
}

export default function Actividades({ filtros, columnas, resultado, errors = {} }: Props) {
    const [rango, setRango] = useState(filtros.desde || filtros.hasta ? filtros : mesActual());
    const [generando, setGenerando] = useState(false);

    const generar = (e: FormEvent) => {
        e.preventDefault();
        router.get(url('/reportes/actividades'), rango, {
            preserveState: true,
            onStart: () => setGenerando(true),
            onFinish: () => setGenerando(false),
        });
    };

    // La descarga usa el rango ya generado (el que se ve en pantalla)
    const rutaExcel = url(`/reportes/actividades/exportar?${new URLSearchParams(filtros)}`);

    return (
        <AppLayout titulo="Reportes › Actividades" icono={<IconoReporteActividades />}>
            <Head title="Reporte de actividades" />

            <div className="space-y-4">
                <form onSubmit={generar} className="rounded-lg border border-slate-200 bg-white p-6">
                    <div className="grid gap-4 sm:grid-cols-[200px_200px_auto] sm:items-end">
                        <Campo etiqueta="Fecha desde" obligatorio error={errors.desde}>
                            <input type="date" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} className={inputClass} />
                        </Campo>
                        <Campo etiqueta="Fecha hasta" obligatorio error={errors.hasta}>
                            <input
                                type="date"
                                value={rango.hasta}
                                min={rango.desde || undefined}
                                onChange={(e) => setRango({ ...rango, hasta: e.target.value })}
                                className={inputClass}
                            />
                        </Campo>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="submit"
                                disabled={generando || !rango.desde || !rango.hasta}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                {generando ? 'Generando…' : 'Generar reporte'}
                            </button>
                            {resultado && resultado.totales.actividades > 0 && (
                                <a
                                    href={rutaExcel}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:border-green-300 hover:bg-green-100"
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <path d="m7 10 5 5 5-5" />
                                        <path d="M12 15V3" />
                                    </svg>
                                    Descargar Excel
                                </a>
                            )}
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Se toman las actividades cuya fecha programada está en el rango (máximo un año).</p>
                </form>

                {resultado && (
                    <>
                        {/* Totales del rango */}
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Total etiqueta="Actividades" valor={String(resultado.totales.actividades)} />
                            <Total etiqueta="Presupuesto asignado" valor={pesos(resultado.totales.presupuestoAsignado)} />
                            <Total etiqueta="Presupuesto autorizado" valor={pesos(resultado.totales.presupuestoAutorizado)} />
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-6">
                            {resultado.actividades.data.length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-400">No hay actividades en ese rango de fechas.</p>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                                    {Object.entries(columnas).map(([clave, titulo]) => (
                                                        <th key={clave} className="px-2 py-2 font-medium whitespace-nowrap">
                                                            {titulo}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {resultado.actividades.data.map((fila) => (
                                                    <tr key={fila.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                                                        {Object.keys(columnas).map((clave) => (
                                                            <td
                                                                key={clave}
                                                                className={`px-2 py-2 text-slate-700 ${
                                                                    COLUMNAS_PESOS.includes(clave) ? 'text-right whitespace-nowrap' : 'min-w-[90px]'
                                                                }`}
                                                            >
                                                                {clave === 'id' ? (
                                                                    <Link href={url(`/actividades/${fila.id}/editar`)} className="font-semibold text-blue-700 hover:underline">
                                                                        {fila.id}
                                                                    </Link>
                                                                ) : COLUMNAS_PESOS.includes(clave) ? (
                                                                    pesos(Number(fila[clave]))
                                                                ) : (
                                                                    fila[clave] || '—'
                                                                )}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Paginacion datos={resultado.actividades} />
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}

function Total({ etiqueta, valor }: { etiqueta: string; valor: string }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-800">{valor}</p>
        </div>
    );
}
