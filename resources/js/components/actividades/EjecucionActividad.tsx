import { useForm } from '@inertiajs/react';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import Modal from '@/components/Modal';
import Seccion from '@/components/Seccion';
import { url } from '@/lib/url';

export interface DatosEjecucion {
    horaInicio: string | null;
    horaFin: string | null;
    observaciones: string | null;
    tieneFoto: boolean;
    /** Archivo de finalización: 'imagen' (miniatura) o 'pdf' (enlace); null si no tiene */
    archivoFin: 'imagen' | 'pdf' | null;
    antesDeFecha: boolean;
    motivoAnulacion: string | null;
}

interface Props {
    actividadId: number;
    estado: string;
    fecha: string; // "02/10/2026"
    ejecucion: DatosEjecucion;
    puedeEjecutar: boolean; // act_edit
    puedeAnular: boolean; // act_anular
}

const botonPrimario = 'rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
            <p className="mt-0.5 text-sm text-slate-800">{valor || '—'}</p>
        </div>
    );
}

/** Ejecución de la actividad: iniciar (hora + foto), finalizar (hora fin) y anular (motivo). */
export default function EjecucionActividad({ actividadId, estado, fecha, ejecucion, puedeEjecutar, puedeAnular }: Props) {
    const rutaFoto = url(`/actividades/${actividadId}/foto-inicio`);
    const rutaArchivoFin = url(`/actividades/${actividadId}/archivo-fin`);
    const anulable = puedeAnular && (estado === 'PROGRAMADA' || estado === 'EN_PROCESO');
    const [anulando, setAnulando] = useState(false);

    return (
        <Seccion
            titulo="Ejecución"
            acciones={
                anulable && (
                    <button
                        type="button"
                        onClick={() => setAnulando(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:border-red-300 hover:bg-red-100"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="m4.9 4.9 14.2 14.2" />
                        </svg>
                        Anular actividad
                    </button>
                )
            }
        >
            {/* Lo ya registrado */}
            {(estado !== 'PROGRAMADA' || ejecucion.observaciones) && (
                <div className="mb-5 space-y-4">
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                        <Dato etiqueta="Fecha" valor={fecha} />
                        <Dato etiqueta="Hora inicio" valor={ejecucion.horaInicio} />
                        <Dato etiqueta="Hora fin" valor={ejecucion.horaFin} />
                    </div>

                    {(ejecucion.tieneFoto || ejecucion.archivoFin) && (
                        <div className="flex flex-wrap gap-6">
                            {ejecucion.tieneFoto && (
                                <a href={rutaFoto} target="_blank" rel="noreferrer" title="Ver foto de inicio" className="block">
                                    <p className="mb-1 text-xs font-medium text-slate-500">Foto de inicio</p>
                                    <img
                                        src={rutaFoto}
                                        alt="Foto de inicio de la actividad"
                                        className="h-20 w-28 rounded-lg border border-slate-200 object-cover hover:opacity-90"
                                    />
                                </a>
                            )}
                            {ejecucion.archivoFin && (
                                <a href={rutaArchivoFin} target="_blank" rel="noreferrer" title="Ver archivo de finalización" className="block">
                                    <p className="mb-1 text-xs font-medium text-slate-500">Archivo de finalización</p>
                                    {ejecucion.archivoFin === 'imagen' ? (
                                        <img
                                            src={rutaArchivoFin}
                                            alt="Archivo de finalización de la actividad"
                                            className="h-20 w-28 rounded-lg border border-slate-200 object-cover hover:opacity-90"
                                        />
                                    ) : (
                                        <span className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <path d="M14 2v6h6" />
                                            </svg>
                                            <span className="text-xs font-semibold">Ver PDF</span>
                                        </span>
                                    )}
                                </a>
                            )}
                        </div>
                    )}

                    {ejecucion.observaciones && <Dato etiqueta="Observaciones generales" valor={ejecucion.observaciones} />}
                    {ejecucion.motivoAnulacion && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{ejecucion.motivoAnulacion}</p>
                    )}
                </div>
            )}

            {estado === 'PROGRAMADA' &&
                (!puedeEjecutar ? (
                    <p className="text-sm text-slate-400">Pendiente de iniciar.</p>
                ) : ejecucion.antesDeFecha ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        La actividad se podrá iniciar desde el <strong>{fecha}</strong>.
                    </p>
                ) : (
                    <FormularioIniciar actividadId={actividadId} fecha={fecha} observaciones={ejecucion.observaciones} />
                ))}

            {estado === 'EN_PROCESO' && puedeEjecutar && (
                <FormularioFinalizar actividadId={actividadId} horaInicio={ejecucion.horaInicio} observaciones={ejecucion.observaciones} />
            )}

            {estado === 'FINALIZADA' && <p className="text-sm text-green-700">Actividad finalizada.</p>}

            <ModalAnular actividadId={actividadId} abierto={anulando} onCerrar={() => setAnulando(false)} />
        </Seccion>
    );
}

// Programada -> En proceso
function FormularioIniciar({ actividadId, fecha, observaciones }: { actividadId: number; fecha: string; observaciones: string | null }) {
    const { data, setData, post, processing, errors } = useForm<{ hora_inicio: string; foto_inicio: File | null; observaciones: string }>({
        hora_inicio: '',
        foto_inicio: null,
        observaciones: observaciones ?? '',
    });
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

    // Libera la URL temporal de la vista previa
    useEffect(() => () => {
        if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    }, [vistaPrevia]);

    const elegirFoto = (e: ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0] ?? null;
        setData('foto_inicio', archivo);
        setVistaPrevia(archivo ? URL.createObjectURL(archivo) : null);
    };

    const iniciar = (e: FormEvent) => {
        e.preventDefault();
        post(url(`/actividades/${actividadId}/iniciar`), { forceFormData: true, preserveScroll: true });
    };

    return (
        <form onSubmit={iniciar} className="space-y-4">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Campo etiqueta="Fecha actividad">
                    <input value={fecha} disabled className={inputClass} />
                </Campo>
                <Campo etiqueta="Hora inicio" obligatorio error={errors.hora_inicio}>
                    <input type="time" value={data.hora_inicio} onChange={(e) => setData('hora_inicio', e.target.value)} className={inputClass} />
                </Campo>
                <Campo etiqueta="Foto de inicio (JPG o PNG, máx. 5 MB)" obligatorio error={errors.foto_inicio}>
                    <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={elegirFoto}
                        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                    />
                </Campo>
            </div>

            {vistaPrevia && <img src={vistaPrevia} alt="Vista previa de la foto" className="h-32 rounded-lg border border-slate-200 object-cover" />}

            <Campo etiqueta="Observaciones generales" error={errors.observaciones}>
                <textarea value={data.observaciones} onChange={(e) => setData('observaciones', e.target.value)} rows={2} maxLength={1000} className={inputClass} />
            </Campo>

            <div className="flex justify-end">
                <button type="submit" disabled={processing} className={`${botonPrimario} bg-amber-500 hover:bg-amber-600`}>
                    {processing ? 'Iniciando…' : 'Iniciar actividad'}
                </button>
            </div>
        </form>
    );
}

// En proceso -> Finalizada (hora fin + archivo obligatorio: foto o PDF)
function FormularioFinalizar({ actividadId, horaInicio, observaciones }: { actividadId: number; horaInicio: string | null; observaciones: string | null }) {
    const { data, setData, post, processing, errors } = useForm<{ hora_fin: string; archivo_fin: File | null; observaciones: string }>({
        hora_fin: '',
        archivo_fin: null,
        observaciones: observaciones ?? '',
    });
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

    // Libera la URL temporal de la vista previa
    useEffect(() => () => {
        if (vistaPrevia) URL.revokeObjectURL(vistaPrevia);
    }, [vistaPrevia]);

    const elegirArchivo = (e: ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0] ?? null;
        setData('archivo_fin', archivo);
        // Vista previa solo para fotos; del PDF se muestra el nombre
        setVistaPrevia(archivo && archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null);
    };

    const finalizar = (e: FormEvent) => {
        e.preventDefault();
        post(url(`/actividades/${actividadId}/finalizar`), { forceFormData: true, preserveScroll: true });
    };

    return (
        <form onSubmit={finalizar} className="space-y-4 border-t border-slate-100 pt-4">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Campo etiqueta="Hora fin" obligatorio error={errors.hora_fin}>
                    <input type="time" value={data.hora_fin} min={horaInicio ?? undefined} onChange={(e) => setData('hora_fin', e.target.value)} className={inputClass} />
                </Campo>
                <div className="sm:col-span-2">
                    <Campo etiqueta="Archivo de finalización (JPG, PNG o PDF, máx. 5 MB)" obligatorio error={errors.archivo_fin}>
                        <input
                            type="file"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={elegirArchivo}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </Campo>
                </div>
            </div>

            {vistaPrevia && <img src={vistaPrevia} alt="Vista previa del archivo" className="h-32 rounded-lg border border-slate-200 object-cover" />}
            {data.archivo_fin && !vistaPrevia && (
                <p className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                    </svg>
                    {data.archivo_fin.name}
                </p>
            )}

            <Campo etiqueta="Observaciones generales" error={errors.observaciones}>
                <textarea value={data.observaciones} onChange={(e) => setData('observaciones', e.target.value)} rows={2} maxLength={1000} className={inputClass} />
            </Campo>

            <div className="flex justify-end">
                <button type="submit" disabled={processing} className={`${botonPrimario} bg-green-600 hover:bg-green-700`}>
                    {processing ? 'Finalizando…' : 'Finalizar actividad'}
                </button>
            </div>
        </form>
    );
}

// Programada o En proceso -> Anulada (motivo obligatorio)
function ModalAnular({ actividadId, abierto, onCerrar }: { actividadId: number; abierto: boolean; onCerrar: () => void }) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({ motivo: '' });

    const cerrar = () => {
        reset();
        clearErrors();
        onCerrar();
    };

    const anular = (e: FormEvent) => {
        e.preventDefault();
        post(url(`/actividades/${actividadId}/anular`), { preserveScroll: true, onSuccess: cerrar });
    };

    return (
        <Modal abierto={abierto} titulo={`Anular actividad #${actividadId}`} onCerrar={cerrar} bloqueado={processing}>
            <form onSubmit={anular} className="space-y-4">
                <p className="text-sm text-slate-600">La actividad quedará anulada y ya no se podrá editar ni ejecutar.</p>
                <Campo etiqueta="Motivo de la anulación" obligatorio error={errors.motivo}>
                    <textarea value={data.motivo} onChange={(e) => setData('motivo', e.target.value)} rows={3} maxLength={500} autoFocus className={inputClass} />
                </Campo>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={cerrar}
                        disabled={processing}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancelar
                    </button>
                    <button type="submit" disabled={processing} className={`${botonPrimario} bg-red-600 hover:bg-red-700`}>
                        {processing ? 'Anulando…' : 'Anular'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
