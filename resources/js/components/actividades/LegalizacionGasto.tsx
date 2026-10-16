import { router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import ModalConfirmar from '@/components/ModalConfirmar';
import Seccion from '@/components/Seccion';
import { url } from '@/lib/url';

export interface DatosLegalizacion {
    /** Por qué todavía no se puede legalizar (presupuesto sin autorizar, actividad anulada); null = se puede */
    motivoBloqueo: string | null;
    autorizado: number;
    legalizado: number;
    /** Elementos del checklist con presupuesto autorizado */
    conceptos: string[];
    registros: {
        id: number;
        detalle: string;
        conceptos: string[];
        archivos: { id: number; nombre: string; valor: number; esPdf: boolean }[];
        total: number;
        usuario: string;
        fecha: string | null;
    }[];
}

interface Props {
    actividadId: number;
    agencia: string;
    datos: DatosLegalizacion;
    puedeCargar: boolean; // act_edit
}

interface FilaArchivo {
    nombre: string;
    valor: string;
    archivo: File | null;
}

interface FormLegalizacion {
    conceptos: string[];
    detalle: string;
    archivos: FilaArchivo[];
}

const FILA_VACIA: FilaArchivo = { nombre: '', valor: '', archivo: null };
const VACIO: FormLegalizacion = { conceptos: [''], detalle: '', archivos: [FILA_VACIA] };

const pesos = (valor: number) => `$ ${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;

const claseArchivo =
    'block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100';

const IconoQuitar = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
    </svg>
);

function Subtitulo({ children }: { children: string }) {
    return <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{children}</p>;
}

/**
 * Legalización de gasto: conceptos (elementos del checklist con presupuesto autorizado), detalle y los soportes
 * (cotizaciones / autorizaciones) con su valor. Puede haber varias; entre todas no superan el presupuesto autorizado.
 */
export default function LegalizacionGasto({ actividadId, agencia, datos, puedeCargar }: Props) {
    const { data, setData, post, processing, errors, reset } = useForm<FormLegalizacion>(VACIO);
    const errores = errors as Record<string, string>;
    // Cambia al guardar para limpiar los campos de archivo (no se pueden vaciar desde el estado)
    const [version, setVersion] = useState(0);

    const [porEliminar, setPorEliminar] = useState<DatosLegalizacion['registros'][number] | null>(null);
    const [eliminando, setEliminando] = useState(false);

    const disponible = Math.max(0, datos.autorizado - datos.legalizado);
    const totalFormulario = data.archivos.reduce((suma, a) => suma + (Number(a.valor) || 0), 0);
    const puedeLegalizar = puedeCargar && datos.motivoBloqueo === null && disponible > 0;

    // Conceptos que aún no se han escogido en otra fila
    const conceptosLibres = (actual: string) => datos.conceptos.filter((c) => c === actual || !data.conceptos.includes(c));

    const cambiarConcepto = (i: number, valor: string) => setData('conceptos', data.conceptos.map((c, j) => (j === i ? valor : c)));
    const agregarConcepto = () => setData('conceptos', [...data.conceptos, '']);
    const quitarConcepto = (i: number) => setData('conceptos', data.conceptos.filter((_, j) => j !== i));

    const cambiarFila = (i: number, cambios: Partial<FilaArchivo>) => setData('archivos', data.archivos.map((a, j) => (j === i ? { ...a, ...cambios } : a)));
    const agregarFila = () => setData('archivos', [...data.archivos, FILA_VACIA]);
    const quitarFila = (i: number) => setData('archivos', data.archivos.filter((_, j) => j !== i));

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        post(url(`/actividades/${actividadId}/legalizaciones`), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setVersion((v) => v + 1);
            },
        });
    };

    const eliminar = () => {
        if (!porEliminar) return;
        router.delete(url(`/actividades/${actividadId}/legalizaciones/${porEliminar.id}`), {
            preserveScroll: true,
            onStart: () => setEliminando(true),
            onFinish: () => {
                setEliminando(false);
                setPorEliminar(null);
            },
        });
    };

    return (
        <Seccion titulo="Legalización de Gasto">
            {/* Presupuesto */}
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Resumen etiqueta="Presupuesto autorizado" valor={pesos(datos.autorizado)} />
                <Resumen etiqueta="Legalizado" valor={pesos(datos.legalizado)} />
                <Resumen etiqueta="Disponible" valor={pesos(disponible)} />
            </div>

            {datos.motivoBloqueo && <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">{datos.motivoBloqueo}</p>}

            {puedeLegalizar && (
                <form key={version} onSubmit={guardar} className="mb-6 space-y-4">
                    <Subtitulo>Detalle legalización</Subtitulo>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Campo etiqueta="Agencia">
                            <input value={agencia} disabled className={inputClass} />
                        </Campo>

                        <Campo etiqueta="Concepto" obligatorio error={errores.conceptos}>
                            <div className="space-y-2">
                                {data.conceptos.map((concepto, i) => (
                                    <div key={i}>
                                        <div className="flex gap-2">
                                            <select value={concepto} onChange={(e) => cambiarConcepto(i, e.target.value)} className={inputClass}>
                                                <option value="">Seleccione...</option>
                                                {conceptosLibres(concepto).map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}
                                                    </option>
                                                ))}
                                            </select>
                                            {i === 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={agregarConcepto}
                                                    disabled={data.conceptos.length >= datos.conceptos.length}
                                                    title="Agregar otro concepto"
                                                    className="shrink-0 rounded-lg bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-40"
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                        <path d="M12 5v14M5 12h14" />
                                                    </svg>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => quitarConcepto(i)}
                                                    title="Quitar concepto"
                                                    className="shrink-0 rounded-lg border border-slate-200 px-3 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <IconoQuitar />
                                                </button>
                                            )}
                                        </div>
                                        {errores[`conceptos.${i}`] && <p className="mt-1 text-xs text-red-600">{errores[`conceptos.${i}`]}</p>}
                                    </div>
                                ))}
                            </div>
                        </Campo>
                    </div>

                    <Campo etiqueta="Detalle" obligatorio error={errores.detalle}>
                        <textarea value={data.detalle} onChange={(e) => setData('detalle', e.target.value)} rows={3} maxLength={1000} className={inputClass} />
                    </Campo>

                    <Subtitulo>Adjuntar cotizaciones / autorizaciones</Subtitulo>

                    <div>
                        <button
                            type="button"
                            onClick={agregarFila}
                            disabled={data.archivos.length >= 10}
                            className="mb-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                        >
                            Agregar fila
                        </button>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                        <th className="py-2 pr-3 font-medium">Nombre archivo</th>
                                        <th className="w-44 py-2 pr-3 font-medium">Valor</th>
                                        <th className="py-2 pr-3 font-medium">Archivo (JPG, PNG o PDF, máx. 5 MB)</th>
                                        <th className="w-12 py-2 text-center font-medium">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.archivos.map((fila, i) => (
                                        <tr key={i} className="border-b border-slate-100 align-top">
                                            <td className="py-2 pr-3">
                                                <input
                                                    value={fila.nombre}
                                                    onChange={(e) => cambiarFila(i, { nombre: e.target.value.toUpperCase() })}
                                                    maxLength={150}
                                                    placeholder="CUENTA DE COBRO"
                                                    className={inputClass}
                                                />
                                                {errores[`archivos.${i}.nombre`] && <p className="mt-1 text-xs text-red-600">{errores[`archivos.${i}.nombre`]}</p>}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    value={fila.valor}
                                                    onChange={(e) => cambiarFila(i, { valor: e.target.value })}
                                                    placeholder="$ 0"
                                                    className={inputClass}
                                                />
                                                {errores[`archivos.${i}.valor`] && <p className="mt-1 text-xs text-red-600">{errores[`archivos.${i}.valor`]}</p>}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,application/pdf"
                                                    onChange={(e) => cambiarFila(i, { archivo: e.target.files?.[0] ?? null })}
                                                    className={`${claseArchivo} rounded-lg border border-slate-300 bg-white p-1`}
                                                />
                                                {errores[`archivos.${i}.archivo`] && <p className="mt-1 text-xs text-red-600">{errores[`archivos.${i}.archivo`]}</p>}
                                            </td>
                                            <td className="py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => quitarFila(i)}
                                                    disabled={data.archivos.length === 1}
                                                    title="Quitar fila"
                                                    className="rounded bg-red-500 p-1.5 text-white hover:bg-red-600 disabled:opacity-30"
                                                >
                                                    <IconoQuitar />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="text-sm font-semibold text-slate-700">
                                        <td className="py-2 pr-3">Total</td>
                                        <td className={`py-2 pr-3 ${totalFormulario > disponible ? 'text-red-600' : ''}`}>{pesos(totalFormulario)}</td>
                                        <td colSpan={2} className="py-2 text-xs font-normal text-slate-400">
                                            Disponible: {pesos(disponible)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {errores.archivos && <p className="mt-1 text-xs text-red-600">{errores.archivos}</p>}
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            {processing ? 'Guardando…' : 'Registrar legalización'}
                        </button>
                    </div>
                </form>
            )}

            {/* Legalizaciones registradas */}
            {datos.registros.length === 0 ? (
                <p className="text-sm text-slate-400">Sin legalizaciones.</p>
            ) : (
                <div className="space-y-3">
                    {datos.registros.map((r) => (
                        <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                <div className="flex flex-wrap gap-1">
                                    {r.conceptos.map((c) => (
                                        <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                            {c}
                                        </span>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-400">
                                        {r.usuario} · {r.fecha ?? ''}
                                    </span>
                                    {puedeCargar && (
                                        <button
                                            type="button"
                                            onClick={() => setPorEliminar(r)}
                                            title="Eliminar legalización"
                                            className="rounded-full border border-slate-200 p-1 text-slate-400 hover:border-red-200 hover:text-red-600"
                                        >
                                            <IconoQuitar />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="mb-2 text-sm text-slate-700">{r.detalle}</p>
                            <table className="w-full text-sm">
                                <tbody>
                                    {r.archivos.map((a) => (
                                        <tr key={a.id} className="border-t border-slate-100">
                                            <td className="py-1.5 pr-3">
                                                <a
                                                    href={url(`/actividades/${actividadId}/legalizaciones/archivos/${a.id}`)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="font-medium text-blue-700 hover:underline"
                                                >
                                                    {a.nombre}
                                                </a>
                                                <span className="ml-1.5 text-xs text-slate-400">{a.esPdf ? 'PDF' : 'Imagen'}</span>
                                            </td>
                                            <td className="py-1.5 text-right whitespace-nowrap text-slate-700">{pesos(a.valor)}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t border-slate-200 font-semibold text-slate-700">
                                        <td className="py-1.5 pr-3">Total</td>
                                        <td className="py-1.5 text-right whitespace-nowrap">{pesos(r.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            <ModalConfirmar
                abierto={porEliminar !== null}
                titulo="Eliminar legalización"
                procesando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setPorEliminar(null)}
            >
                ¿Seguro que desea eliminar la legalización por <strong className="text-slate-800">{pesos(porEliminar?.total ?? 0)}</strong>? Sus archivos se borrarán del
                servidor.
            </ModalConfirmar>
        </Seccion>
    );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
    return (
        <div className="rounded-lg border border-slate-200 px-4 py-2">
            <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{valor}</p>
        </div>
    );
}
