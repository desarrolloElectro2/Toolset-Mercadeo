import { router, useForm } from '@inertiajs/react';
import { FormEvent, useRef, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import ModalConfirmar from '@/components/ModalConfirmar';
import { camposUbicacion, textoUbicacion, useUbicacion } from '@/hooks/useUbicacion';
import Seccion from '@/components/Seccion';
import { url } from '@/lib/url';

export interface Evidencia {
    id: number;
    tipo: 'GASTO' | 'ACTIVIDAD';
    nombre: string;
    esPdf: boolean;
    usuario: string;
    fecha: string | null;
}

interface Props {
    actividadId: number;
    evidencias: Evidencia[];
    puedeCargar: boolean; // act_edit
}

const TIPOS = { GASTO: 'Evidencia del gasto', ACTIVIDAD: 'Evidencia de la actividad' } as const;

/** Evidencias que carga el responsable del evento: del gasto (facturas, soportes) y de la actividad (fotos). */
export default function EvidenciasActividad({ actividadId, evidencias, puedeCargar }: Props) {
    const ubicacion = useUbicacion(puedeCargar);
    const { data, setData, post, processing, errors, reset, transform } = useForm<{ tipo: string; archivos: File[] }>({ tipo: 'GASTO', archivos: [] });
    const errores = errors as Record<string, string>;
    const input = useRef<HTMLInputElement>(null);
    const [porEliminar, setPorEliminar] = useState<Evidencia | null>(null);
    const [eliminando, setEliminando] = useState(false);

    const subir = (e: FormEvent) => {
        e.preventDefault();
        // Con las fotos va la ubicación del dispositivo para escribirla sobre ellas
        transform((d) => ({ ...d, ...camposUbicacion(ubicacion) }));
        post(url(`/actividades/${actividadId}/evidencias`), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset('archivos');
                if (input.current) input.current.value = '';
            },
        });
    };

    const eliminar = () => {
        if (!porEliminar) return;
        router.delete(url(`/actividades/${actividadId}/evidencias/${porEliminar.id}`), {
            preserveScroll: true,
            onStart: () => setEliminando(true),
            onFinish: () => {
                setEliminando(false);
                setPorEliminar(null);
            },
        });
    };

    // Primer error de los archivos (archivos.0, archivos.1, ...)
    const errorArchivos = errores.archivos ?? Object.entries(errores).find(([campo]) => campo.startsWith('archivos.'))?.[1];

    return (
        <Seccion titulo="Evidencias del gasto y de la actividad">
            {puedeCargar && (
                <form onSubmit={subir} className="mb-5 grid gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
                    <Campo etiqueta="Tipo" obligatorio error={errores.tipo}>
                        <select value={data.tipo} onChange={(e) => setData('tipo', e.target.value)} className={inputClass}>
                            {Object.entries(TIPOS).map(([valor, etiqueta]) => (
                                <option key={valor} value={valor}>
                                    {etiqueta}
                                </option>
                            ))}
                        </select>
                    </Campo>
                    <Campo etiqueta="Archivos (JPG, PNG o PDF, máx. 5 MB cada uno, hasta 10)" obligatorio error={errorArchivos}>
                        <input
                            ref={input}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={(e) => setData('archivos', Array.from(e.target.files ?? []))}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </Campo>
                    <button
                        type="submit"
                        disabled={processing || data.archivos.length === 0}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {processing ? 'Subiendo…' : 'Subir'}
                    </button>
                    <p className={`text-xs sm:col-span-3 ${ubicacion.estado === 'ok' ? 'text-slate-500' : 'text-amber-700'}`}>
                        {textoUbicacion(ubicacion)} Las fotos se marcan con la fecha y hora de carga y la ubicación.
                    </p>
                </form>
            )}

            <div className="grid gap-5 md:grid-cols-2">
                {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((tipo) => {
                    const lista = evidencias.filter((e) => e.tipo === tipo);
                    return (
                        <div key={tipo}>
                            <p className="mb-2 text-xs font-medium text-slate-500">
                                {TIPOS[tipo]} ({lista.length})
                            </p>
                            {lista.length === 0 ? (
                                <p className="text-sm text-slate-400">Sin archivos.</p>
                            ) : (
                                <div className="flex flex-wrap gap-3">
                                    {lista.map((e) => {
                                        const ruta = url(`/actividades/${actividadId}/evidencias/${e.id}`);
                                        return (
                                            <div key={e.id} className="relative w-28">
                                                <a href={ruta} target="_blank" rel="noreferrer" title={`${e.nombre} · ${e.usuario} · ${e.fecha ?? ''}`} className="block">
                                                    {e.esPdf ? (
                                                        <span className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                                                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                                <path d="M14 2v6h6" />
                                                            </svg>
                                                            <span className="text-xs font-semibold">PDF</span>
                                                        </span>
                                                    ) : (
                                                        <img src={ruta} alt={e.nombre} className="h-20 w-28 rounded-lg border border-slate-200 object-cover hover:opacity-90" />
                                                    )}
                                                    <p className="mt-1 truncate text-[11px] text-slate-500">{e.nombre}</p>
                                                </a>
                                                {puedeCargar && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPorEliminar(e)}
                                                        title="Eliminar evidencia"
                                                        className="absolute -top-2 -right-2 rounded-full border border-slate-200 bg-white p-1 text-slate-400 shadow-sm hover:border-red-200 hover:text-red-600"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                            <path d="M18 6 6 18M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <ModalConfirmar
                abierto={porEliminar !== null}
                titulo="Eliminar evidencia"
                procesando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setPorEliminar(null)}
            >
                ¿Seguro que desea eliminar <strong className="text-slate-800">{porEliminar?.nombre}</strong>? El archivo se borrará del servidor.
            </ModalConfirmar>
        </Seccion>
    );
}
