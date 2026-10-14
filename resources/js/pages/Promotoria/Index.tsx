import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { inputClass } from '@/components/Campo';
import { IconoPromotoria } from '@/components/Iconos';
import ModalConfirmar from '@/components/ModalConfirmar';
import Paginacion from '@/components/Paginacion';
import SelectBuscable from '@/components/SelectBuscable';
import { useCan } from '@/hooks/useCan';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';
import { Paginado } from '@/types';

interface VisitaFila {
    id: number;
    programacionId: number;
    fecha: string;
    jornada: string;
    dependencia: string;
    promotor: string;
    cargo: string | null;
    lugar: string;
    observacion: string;
    estado: string;
}

interface Filtros {
    mes: string;
    dependencia: string;
    promotor: string;
}

interface Props {
    visitas: Paginado<VisitaFila>;
    filtros: Filtros;
    opciones: {
        meses: { valor: string; etiqueta: string }[];
        dependencias: { valor: string; etiqueta: string }[];
        promotores: { cedula: string; nombre: string }[];
    };
}

// "2026-11-03" -> ["03/11/2026", "martes"]
function formatearFecha(fecha: string): [string, string] {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const diaSemana = new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { weekday: 'long' });
    return [`${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`, diaSemana];
}

const botonAccion = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150';

export default function Index({ visitas, filtros, opciones }: Props) {
    const can = useCan();
    const [porEliminar, setPorEliminar] = useState<VisitaFila | null>(null);
    const [eliminando, setEliminando] = useState(false);

    const filtrar = (cambios: Partial<Filtros>) => {
        const nuevos = { ...filtros, ...cambios };
        // Solo viajan los filtros con valor (el mes siempre, para distinguir "mes actual" de "todos")
        const params = Object.fromEntries(Object.entries(nuevos).filter(([clave, valor]) => valor !== '' || clave === 'mes'));
        router.get(url('/promotoria'), params, { preserveState: true, replace: true });
    };

    const eliminar = () => {
        if (!porEliminar) return;
        router.delete(url(`/promotoria/visitas/${porEliminar.id}`), {
            preserveScroll: true,
            onStart: () => setEliminando(true),
            onFinish: () => {
                setEliminando(false);
                setPorEliminar(null);
            },
        });
    };

    return (
        <AppLayout titulo="Promotoría › Visitas" icono={<IconoPromotoria />}>
            <Head title="Promotoría" />

            <div className="rounded-lg border border-slate-200 bg-white p-6">
                {/* Filtros + Nuevo */}
                <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Mes</label>
                        <select value={filtros.mes} onChange={(e) => filtrar({ mes: e.target.value })} className={inputClass}>
                            <option value="todos">TODOS</option>
                            {opciones.meses.map((m) => (
                                <option key={m.valor} value={m.valor}>
                                    {m.etiqueta}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Dependencia</label>
                        <select value={filtros.dependencia} onChange={(e) => filtrar({ dependencia: e.target.value })} className={inputClass}>
                            <option value="">TODAS</option>
                            {opciones.dependencias.map((d) => (
                                <option key={d.valor} value={d.valor}>
                                    {d.etiqueta}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Promotor</label>
                        <SelectBuscable
                            opciones={[{ valor: '', etiqueta: 'TODOS' }, ...opciones.promotores.map((p) => ({ valor: p.cedula, etiqueta: p.nombre }))]}
                            valor={filtros.promotor}
                            onChange={(v) => filtrar({ promotor: v })}
                            placeholder="TODOS"
                        />
                    </div>
                    {can('vis_create') && (
                        <Link
                            href={url('/promotoria/crear')}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            Nuevo
                        </Link>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                <th className="py-2 pr-3 font-medium">Fecha</th>
                                <th className="py-2 pr-3 font-medium">Jornada</th>
                                <th className="py-2 pr-3 font-medium">Promotor</th>
                                <th className="py-2 pr-3 font-medium">Dependencia</th>
                                <th className="py-2 pr-3 font-medium">Agencia / zona</th>
                                <th className="py-2 pr-3 font-medium">Observación</th>
                                <th className="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {visitas.data.map((v) => {
                                const [fecha, diaSemana] = formatearFecha(v.fecha);
                                return (
                                    <tr key={v.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                                        <td className="py-3 pr-3 whitespace-nowrap text-slate-700">
                                            {fecha}
                                            <span className="block text-xs text-slate-400 capitalize">{diaSemana}</span>
                                        </td>
                                        <td className="py-3 pr-3 text-slate-600">{v.jornada}</td>
                                        <td className="py-3 pr-3 text-slate-700">
                                            {v.promotor}
                                            {v.cargo && <span className="block text-xs text-slate-400">{v.cargo}</span>}
                                        </td>
                                        <td className="py-3 pr-3 text-slate-600">{v.dependencia}</td>
                                        <td className="py-3 pr-3 text-slate-700">{v.lugar || '—'}</td>
                                        <td className="py-3 pr-3 text-slate-600">{v.observacion || '—'}</td>
                                        <td className="py-3">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    href={url(`/promotoria/${v.programacionId}/editar`)}
                                                    className={`${botonAccion} border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100`}
                                                >
                                                    {can('vis_edit') ? 'Editar' : 'Ver'}
                                                </Link>
                                                {can('vis_delete') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPorEliminar(v)}
                                                        className={`${botonAccion} border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100`}
                                                    >
                                                        Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {visitas.data.length === 0 && (
                    <div className="flex flex-col items-center py-10 text-center">
                        <div className="mb-3 text-slate-300">
                            <IconoPromotoria tamano={40} />
                        </div>
                        <p className="text-sm text-slate-400">No hay visitas con estos filtros.</p>
                    </div>
                )}

                <Paginacion datos={visitas} />
            </div>

            <ModalConfirmar
                abierto={porEliminar !== null}
                titulo="Eliminar visita"
                procesando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setPorEliminar(null)}
            >
                ¿Seguro que desea eliminar la visita del <strong className="text-slate-800">{porEliminar && formatearFecha(porEliminar.fecha)[0]}</strong> (
                {porEliminar?.jornada.toLowerCase()}) de <strong className="text-slate-800">{porEliminar?.promotor}</strong>?
            </ModalConfirmar>
        </AppLayout>
    );
}
