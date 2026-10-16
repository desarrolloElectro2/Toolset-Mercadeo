import { useForm } from '@inertiajs/react';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import Seccion from '@/components/Seccion';
import { useCan } from '@/hooks/useCan';
import { camposUbicacion, textoUbicacion, useUbicacion } from '@/hooks/useUbicacion';
import { url } from '@/lib/url';
import { EstadoCatalogo } from '@/types/actividades';

export interface DatosEjecucion {
    horaInicio: string | null;
    observaciones: string | null;
    tieneFoto: boolean;
    /** Archivo de finalización: 'imagen' (miniatura) o 'pdf' (enlace); null si no tiene */
    archivoFin: 'imagen' | 'pdf' | null;
    antesDeFecha: boolean;
    /** Observación del último cambio al estado actual, si ese estado la exige (p. ej. motivo de anulación) */
    motivoEstado: string | null;
}

interface Props {
    actividadId: number;
    estado: string;
    fecha: string; // "02/10/2026"
    ejecucion: DatosEjecucion;
    estados: EstadoCatalogo[];
}

const botonPrimario = 'rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50';

const claseArchivo =
    'block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
            <p className="mt-0.5 text-sm text-slate-800">{valor || '—'}</p>
        </div>
    );
}

/** Estado Mercadeo: lo ya registrado + select para cambiar el estado manualmente (reglas de la matriz de estados). */
export default function EjecucionActividad({ actividadId, estado, fecha, ejecucion, estados }: Props) {
    const can = useCan();
    const rutaFoto = url(`/actividades/${actividadId}/foto-inicio`);
    const rutaArchivoFin = url(`/actividades/${actividadId}/archivo-fin`);
    const actual = estados.find((e) => e.codigo === estado);

    // Estados a los que el usuario puede pasar: los que tienen el permiso que exige cada uno
    const destinos = estados.filter((e) => e.codigo !== estado && can(e.permiso));
    const modificable = destinos.length > 0 || can('act_edit');

    return (
        <Seccion titulo="Estado Mercadeo">
            {/* Lo ya registrado */}
            {(ejecucion.horaInicio || ejecucion.archivoFin || ejecucion.observaciones || ejecucion.motivoEstado) && (
                <div className="mb-5 space-y-4">
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                        <Dato etiqueta="Fecha" valor={fecha} />
                        <Dato etiqueta="Hora inicio" valor={ejecucion.horaInicio} />
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
                                <a href={rutaArchivoFin} target="_blank" rel="noreferrer" title="Ver soporte de finalización" className="block">
                                    <p className="mb-1 text-xs font-medium text-slate-500">Soporte de finalización</p>
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
                    {ejecucion.motivoEstado && (
                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{ejecucion.motivoEstado}</p>
                    )}
                </div>
            )}

            {modificable ? (
                <FormularioEstado
                    key={estado}
                    actividadId={actividadId}
                    estado={estado}
                    fecha={fecha}
                    ejecucion={ejecucion}
                    actual={actual}
                    destinos={destinos}
                    puedeObservar={can('act_edit')}
                />
            ) : (
                <Dato etiqueta="Estado" valor={actual?.nombre ?? estado} />
            )}
        </Seccion>
    );
}

interface FormEstado {
    estado: string;
    observaciones: string;
    motivo: string;
    hora_inicio: string;
    foto_inicio: File | null;
    archivo_fin: File | null;
}

/**
 * Select del estado (siempre visible) + los campos que exige el escogido según la matriz:
 * requiere inicio = hora inicio + foto; requiere fin = solo el archivo de soporte; requiere observación = motivo.
 * Lo que la actividad ya tiene (horas, foto, archivo) es opcional: solo se reemplaza.
 * Dejando el estado actual solo se guardan las observaciones generales.
 */
function FormularioEstado({
    actividadId,
    estado,
    fecha,
    ejecucion,
    actual,
    destinos,
    puedeObservar,
}: {
    actividadId: number;
    estado: string;
    fecha: string;
    ejecucion: DatosEjecucion;
    actual: EstadoCatalogo | undefined;
    destinos: EstadoCatalogo[];
    puedeObservar: boolean; // act_edit: guardar solo observaciones
}) {
    const { data, setData, post, transform, processing, errors } = useForm<FormEstado>({
        estado,
        observaciones: ejecucion.observaciones ?? '',
        motivo: '',
        hora_inicio: ejecucion.horaInicio ?? '',
        foto_inicio: null,
        archivo_fin: null,
    });
    const [vistas, setVistas] = useState<{ foto_inicio: string | null; archivo_fin: string | null }>({ foto_inicio: null, archivo_fin: null });

    // Libera las URL temporales de las vistas previas
    useEffect(() => () => {
        Object.values(vistas).forEach((v) => v && URL.revokeObjectURL(v));
    }, [vistas]);

    const sinCambio = data.estado === estado;
    const destino = destinos.find((e) => e.codigo === data.estado);
    const pideFin = !sinCambio && !!destino?.requiereFin;
    // Al finalizar solo se carga el archivo de soporte: no se piden los datos de inicio
    const pideInicio = !sinCambio && !!destino?.requiereInicio && !pideFin;
    const pideMotivo = !sinCambio && !!destino?.requiereObservacion;
    // La ubicación se escribe sobre las fotos (también sobre el soporte si es imagen)
    const conFotos = pideInicio || pideFin;
    const ubicacion = useUbicacion(conFotos);

    const cambiarEstado = (nuevo: string) => {
        setData((prev) => ({ ...prev, estado: nuevo, foto_inicio: null, archivo_fin: null }));
        setVistas({ foto_inicio: null, archivo_fin: null });
    };

    const elegirArchivo = (campo: 'foto_inicio' | 'archivo_fin') => (e: ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0] ?? null;
        setData(campo, archivo);
        // Vista previa solo para fotos; del PDF se muestra el nombre
        setVistas((prev) => ({ ...prev, [campo]: archivo && archivo.type.startsWith('image/') ? URL.createObjectURL(archivo) : null }));
    };

    const guardar = (e: FormEvent) => {
        e.preventDefault();

        // Solo viajan los campos que exige el estado escogido
        const campos: (keyof FormEstado)[] = ['estado', 'observaciones'];
        if (pideMotivo) campos.push('motivo');
        if (pideInicio) campos.push('hora_inicio', 'foto_inicio');
        if (pideFin) campos.push('archivo_fin');

        // Con las fotos va la ubicación del dispositivo para escribirla sobre ellas
        transform((d) => ({ ...Object.fromEntries(campos.map((c) => [c, d[c]])), ...(conFotos ? camposUbicacion(ubicacion) : {}) }) as unknown as FormEstado);
        post(url(`/actividades/${actividadId}/estado`), { forceFormData: true, preserveScroll: true });
    };

    return (
        <form onSubmit={guardar} className="space-y-4 border-t border-slate-100 pt-4">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Campo etiqueta="Estado" obligatorio error={errors.estado}>
                    <select value={data.estado} onChange={(e) => cambiarEstado(e.target.value)} className={inputClass}>
                        <option value={estado}>{actual?.nombre ?? estado}</option>
                        {destinos.map((e) => {
                            // Iniciar o finalizar no se registra antes del día programado
                            const bloqueado = e.requiereInicio && ejecucion.antesDeFecha;
                            return (
                                <option key={e.codigo} value={e.codigo} disabled={bloqueado}>
                                    {e.nombre}
                                    {bloqueado ? ` (desde el ${fecha})` : ''}
                                </option>
                            );
                        })}
                    </select>
                </Campo>

                {pideInicio && (
                    <>
                        <Campo etiqueta="Hora inicio" obligatorio error={errors.hora_inicio}>
                            <input type="time" value={data.hora_inicio} onChange={(e) => setData('hora_inicio', e.target.value)} className={inputClass} />
                        </Campo>
                        <Campo
                            etiqueta={ejecucion.tieneFoto ? 'Reemplazar foto de inicio (opcional)' : 'Foto de inicio (JPG o PNG, máx. 5 MB)'}
                            obligatorio={!ejecucion.tieneFoto}
                            error={errors.foto_inicio}
                        >
                            <input type="file" accept="image/jpeg,image/png" onChange={elegirArchivo('foto_inicio')} className={claseArchivo} />
                        </Campo>
                    </>
                )}
            </div>

            {pideFin && (
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                    <Campo
                        etiqueta={ejecucion.archivoFin ? 'Reemplazar soporte de finalización (opcional)' : 'Soporte de finalización (JPG, PNG o PDF, máx. 5 MB)'}
                        obligatorio={!ejecucion.archivoFin}
                        error={errors.archivo_fin}
                    >
                        <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={elegirArchivo('archivo_fin')} className={claseArchivo} />
                    </Campo>
                </div>
            )}

            {/* Ubicación que se escribirá sobre las fotos (con la fecha y hora de carga) */}
            {conFotos && (
                <p className={`text-xs ${ubicacion.estado === 'ok' ? 'text-slate-500' : 'text-amber-700'}`}>
                    {textoUbicacion(ubicacion)} Las fotos se marcan con la fecha y hora de carga y la ubicación.
                </p>
            )}

            {(vistas.foto_inicio || vistas.archivo_fin || data.archivo_fin) && (
                <div className="flex flex-wrap gap-4">
                    {vistas.foto_inicio && <img src={vistas.foto_inicio} alt="Vista previa de la foto de inicio" className="h-32 rounded-lg border border-slate-200 object-cover" />}
                    {vistas.archivo_fin && <img src={vistas.archivo_fin} alt="Vista previa del archivo de finalización" className="h-32 rounded-lg border border-slate-200 object-cover" />}
                    {data.archivo_fin && !vistas.archivo_fin && (
                        <p className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <path d="M14 2v6h6" />
                            </svg>
                            {data.archivo_fin.name}
                        </p>
                    )}
                </div>
            )}

            {pideMotivo && (
                <Campo etiqueta={`Observación del cambio a ${destino?.nombre}`} obligatorio error={errors.motivo}>
                    <textarea value={data.motivo} onChange={(e) => setData('motivo', e.target.value)} rows={2} maxLength={500} className={inputClass} />
                </Campo>
            )}

            <Campo etiqueta="Observaciones generales" obligatorio={sinCambio} error={errors.observaciones}>
                <textarea
                    value={data.observaciones}
                    onChange={(e) => setData('observaciones', e.target.value)}
                    rows={2}
                    maxLength={1000}
                    disabled={!puedeObservar}
                    className={inputClass}
                />
            </Campo>

            {/* Guardar solo observaciones requiere act_edit */}
            {(!sinCambio || puedeObservar) && (
                <div className="flex justify-end">
                    <button type="submit" disabled={processing} className={`${botonPrimario} bg-blue-600 hover:bg-blue-700`}>
                        {processing ? 'Guardando…' : sinCambio ? 'Guardar observaciones' : `Cambiar a ${destino?.nombre ?? data.estado}`}
                    </button>
                </div>
            )}
        </form>
    );
}
