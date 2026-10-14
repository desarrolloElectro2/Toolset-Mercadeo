import { Head, Link, router, useForm } from '@inertiajs/react';
import { FormEvent, KeyboardEvent, useMemo, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import { IconoPromotoria } from '@/components/Iconos';
import ModalConfirmar from '@/components/ModalConfirmar';
import Seccion from '@/components/Seccion';
import SelectBuscable from '@/components/SelectBuscable';
import { useCan } from '@/hooks/useCan';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';

interface Opcion {
    valor: string;
    etiqueta: string;
}
interface Agencia {
    codigo: string;
    nombre: string;
}
interface Lugar extends Agencia {
    satelite: boolean;
}

interface VisitaGuardada {
    id: number;
    fecha: string;
    jornada: string;
    agencia_id: string;
    ruta_id: string;
    observacion: string;
    estado: string;
}

interface Props {
    dependencias: Opcion[];
    jornadas: Opcion[];
    regionales: string[];
    promotores: { cedula: string; nombre: string; cargo: string }[];
    promotoresError: string | null;
    zonas: { id: string; nombre: string }[];
    /** null = programación nueva */
    programacion: {
        id: number;
        mes: string;
        dependencia: string;
        promotor_cedula: string;
        regional: string;
        agencia_id: string;
        lugares: Lugar[];
        agencias: Agencia[];
        visitas: VisitaGuardada[];
    } | null;
}

/** Visita agregada en el formulario; lugar = agencia (Electromillonaria) o zona (Interelec) */
interface Visita {
    fecha: string;
    jornada: string;
    lugar: string;
    observacion: string;
    estado?: string;
}

const ELECTRO = 'ELECTROMILLONARIA';
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const dos = (n: number) => String(n).padStart(2, '0');

// Mes actual y los 11 siguientes ("YYYY-MM")
function mesesDisponibles(): Opcion[] {
    const hoy = new Date();
    return Array.from({ length: 12 }, (_, i) => {
        const f = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        return { valor: `${f.getFullYear()}-${dos(f.getMonth() + 1)}`, etiqueta: `${MESES[f.getMonth()]} ${f.getFullYear()}` };
    });
}

// Primer y último día del mes ("YYYY-MM"), para limitar el selector de fecha
function limitesMes(mes: string): { min: string; max: string } {
    const [anio, numero] = mes.split('-').map(Number);
    return { min: `${mes}-01`, max: `${mes}-${dos(new Date(anio, numero, 0).getDate())}` };
}

// "2026-11-03" -> ["03/11/2026", "martes"]
function formatearFecha(fecha: string): [string, string] {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return [`${dos(dia)}/${dos(mes)}/${anio}`, new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { weekday: 'long' })];
}

// Por fecha y, en el mismo día, la mañana antes que la tarde
const ordenar = (lista: Visita[]) => [...lista].sort((a, b) => (a.fecha + (a.jornada === 'TARDE' ? 1 : 0)).localeCompare(b.fecha + (b.jornada === 'TARDE' ? 1 : 0)));

async function obtenerJson<T>(ruta: string): Promise<T> {
    const respuesta = await fetch(ruta, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return respuesta.json();
}

export default function Form({ dependencias, jornadas, regionales, promotores, promotoresError, zonas, programacion }: Props) {
    const can = useCan();
    const editando = programacion !== null;
    const soloLectura = editando && !can('vis_edit');
    const meses = useMemo(() => {
        const lista = mesesDisponibles();
        // Al editar un mes que ya no está en la lista, se agrega para poder mostrarlo
        if (programacion && !lista.some((m) => m.valor === programacion.mes)) {
            const [a, m] = programacion.mes.split('-').map(Number);
            lista.unshift({ valor: programacion.mes, etiqueta: `${MESES[m - 1]} ${a}` });
        }
        return lista;
    }, [programacion]);

    const { data, setData, post, put, transform, processing, errors } = useForm({
        mes: programacion?.mes ?? meses[0].valor,
        dependencia: programacion?.dependencia ?? '',
        promotor_cedula: programacion?.promotor_cedula ?? '',
        regional: programacion?.regional ?? '',
        agencia_id: programacion?.agencia_id ?? '',
    });
    const errores = errors as Record<string, string>;

    // Visitas agregadas (siempre ordenadas: el índice coincide con el de los errores visitas.N.campo)
    const [visitas, setVisitas] = useState<Visita[]>(() =>
        ordenar(
            (programacion?.visitas ?? []).map((v) => ({
                fecha: v.fecha,
                jornada: v.jornada,
                lugar: v.agencia_id || v.ruta_id,
                observacion: v.observacion,
                estado: v.estado,
            })),
        ),
    );

    // Fila para agregar una visita
    const [nueva, setNueva] = useState<Visita>({ fecha: '', jornada: '', lugar: '', observacion: '' });
    const [errorNueva, setErrorNueva] = useState<string | null>(null);

    const [agencias, setAgencias] = useState<Agencia[]>(programacion?.agencias ?? []);
    const [lugares, setLugares] = useState<Lugar[]>(programacion?.lugares ?? []);
    const [cargando, setCargando] = useState<string | null>(null);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [eliminando, setEliminando] = useState<'confirmar' | 'procesando' | null>(null);

    const electro = data.dependencia === ELECTRO;
    const limites = limitesMes(data.mes);
    const opcionesLugar = electro
        ? lugares.map((l) => ({ valor: l.codigo, etiqueta: l.satelite ? `↳ ${l.nombre}` : l.nombre }))
        : zonas.map((z) => ({ valor: z.id, etiqueta: z.nombre }));
    const nombreLugar = (valor: string) => opcionesLugar.find((o) => o.valor === valor)?.etiqueta.replace('↳ ', '') ?? valor;
    const etiquetaJornada = (valor: string) => jornadas.find((j) => j.valor === valor)?.etiqueta ?? valor;
    const listo = electro ? lugares.length > 0 : data.dependencia !== '';

    // Cambiar mes o dependencia deja sin sentido las visitas agregadas
    const cambiarMes = (mes: string) => {
        if (visitas.length > 0 && !window.confirm('Al cambiar el mes se quitan las visitas agregadas. ¿Desea continuar?')) return;
        setData('mes', mes);
        setVisitas([]);
        setNueva((n) => ({ ...n, fecha: '' }));
    };
    const cambiarDependencia = (dependencia: string) => {
        if (visitas.length > 0 && !window.confirm('Al cambiar la dependencia se quitan las visitas agregadas. ¿Desea continuar?')) return;
        setData((prev) => ({ ...prev, dependencia, regional: '', agencia_id: '' }));
        setAgencias([]);
        setLugares([]);
        setVisitas([]);
        setNueva((n) => ({ ...n, lugar: '' }));
    };

    const cambiarRegional = (regional: string) => {
        setData((prev) => ({ ...prev, regional, agencia_id: '' }));
        setAgencias([]);
        setLugares([]);
        setErrorCarga(null);
        if (!regional) return;
        setCargando('agencias');
        obtenerJson<Agencia[]>(url(`/promotoria/datos/agencias?regional=${encodeURIComponent(regional)}`))
            .then(setAgencias)
            .catch(() => setErrorCarga('No se pudieron cargar las agencias. Intente de nuevo.'))
            .finally(() => setCargando(null));
    };

    // Agencia principal -> sus puntos satélite; las visitas con un lugar que ya no aplica quedan sin lugar
    const cambiarAgencia = (codigo: string) => {
        setData('agencia_id', codigo);
        setLugares([]);
        setErrorCarga(null);
        setNueva((n) => ({ ...n, lugar: '' }));
        if (!codigo) return;
        setCargando('lugares');
        obtenerJson<Lugar[]>(url(`/promotoria/datos/lugares/${encodeURIComponent(codigo)}`))
            .then((lista) => {
                setLugares(lista);
                const validos = new Set(lista.map((l) => l.codigo));
                setVisitas((prev) => prev.map((v) => (validos.has(v.lugar) ? v : { ...v, lugar: '' })));
            })
            .catch(() => setErrorCarga('No se pudieron cargar los puntos satélite. Intente de nuevo.'))
            .finally(() => setCargando(null));
    };

    const agregar = () => {
        if (!nueva.fecha || !nueva.jornada || !nueva.lugar) {
            setErrorNueva(`Escoja la fecha, la jornada y ${electro ? 'el lugar' : 'la zona'}.`);
            return;
        }
        if (nueva.fecha < limites.min || nueva.fecha > limites.max) {
            setErrorNueva('La fecha debe estar dentro del mes seleccionado.');
            return;
        }
        if (visitas.some((v) => v.fecha === nueva.fecha && v.jornada === nueva.jornada)) {
            setErrorNueva(`Ya hay una visita el ${formatearFecha(nueva.fecha)[0]} en la ${etiquetaJornada(nueva.jornada).toLowerCase()}.`);
            return;
        }
        setVisitas((prev) => ordenar([...prev, { ...nueva }]));
        // Se conservan fecha y lugar para agregar rápido la otra jornada del mismo día
        setNueva((n) => ({ ...n, jornada: '', observacion: '' }));
        setErrorNueva(null);
    };

    // Enter en la fila de agregar agrega la visita en vez de enviar el formulario
    const agregarConEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregar();
        }
    };

    const cambiarVisita = (i: number, cambios: Partial<Visita>) => setVisitas((prev) => prev.map((v, k) => (k === i ? { ...v, ...cambios } : v)));
    const quitarVisita = (i: number) => setVisitas((prev) => prev.filter((_, k) => k !== i));

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            visitas: visitas.map((v) => ({
                fecha: v.fecha,
                jornada: v.jornada,
                agencia_id: electro ? v.lugar : '',
                ruta_id: electro ? '' : v.lugar,
                observacion: v.observacion,
            })),
        }));

        if (editando) {
            put(url(`/promotoria/${programacion.id}`), { preserveScroll: true });
        } else {
            post(url('/promotoria'), { preserveScroll: true });
        }
    };

    const eliminarProgramacion = () => {
        if (!programacion) return;
        router.delete(url(`/promotoria/${programacion.id}`), {
            onStart: () => setEliminando('procesando'),
            onFinish: () => setEliminando(null),
        });
    };

    const errorVisita = (i: number) =>
        errores[`visitas.${i}.agencia_id`] ?? errores[`visitas.${i}.ruta_id`] ?? errores[`visitas.${i}.fecha`] ?? errores[`visitas.${i}.observacion`];

    const titulo = editando ? `Promotoría › Programación #${programacion.id}` : 'Promotoría › Nueva programación';

    return (
        <AppLayout titulo={titulo} icono={<IconoPromotoria />}>
            <Head title={editando ? `Programación #${programacion.id}` : 'Nueva programación'} />

            <form onSubmit={guardar} className="space-y-4">
                {Object.keys(errores).length > 0 && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errores.visitas ?? 'Hay campos por corregir. Revise los que están marcados en rojo.'}
                    </p>
                )}
                {errorCarga && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorCarga}</p>}
                {soloLectura && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Consulta: no tiene permiso para editar visitas.</p>
                )}

                <Seccion titulo="Información general">
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                        <Campo etiqueta="Mes de la visita" obligatorio error={errores.mes}>
                            <select value={data.mes} onChange={(e) => cambiarMes(e.target.value)} disabled={editando} className={inputClass}>
                                {meses.map((m) => (
                                    <option key={m.valor} value={m.valor}>
                                        {m.etiqueta}
                                    </option>
                                ))}
                            </select>
                        </Campo>

                        <Campo etiqueta="Dependencia" obligatorio error={errores.dependencia}>
                            <select value={data.dependencia} onChange={(e) => cambiarDependencia(e.target.value)} disabled={editando} className={inputClass}>
                                <option value="">SELECCIONE</option>
                                {dependencias.map((d) => (
                                    <option key={d.valor} value={d.valor}>
                                        {d.etiqueta}
                                    </option>
                                ))}
                            </select>
                        </Campo>

                        <Campo etiqueta="Promotor" obligatorio error={errores.promotor_cedula ?? promotoresError ?? undefined}>
                            <SelectBuscable
                                opciones={promotores.map((p) => ({ valor: p.cedula, etiqueta: p.nombre, detalle: p.cargo }))}
                                valor={data.promotor_cedula}
                                onChange={(v) => setData('promotor_cedula', v)}
                                disabled={editando}
                                conError={!!errores.promotor_cedula}
                            />
                        </Campo>

                        {electro && (
                            <>
                                <Campo etiqueta="Regional" obligatorio error={errores.regional}>
                                    <select value={data.regional} onChange={(e) => cambiarRegional(e.target.value)} disabled={soloLectura} className={inputClass}>
                                        <option value="">SELECCIONE</option>
                                        {regionales.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                </Campo>
                                <Campo etiqueta="Agencia principal" obligatorio error={errores.agencia_id}>
                                    <SelectBuscable
                                        opciones={agencias.map((a) => ({ valor: a.codigo, etiqueta: a.nombre }))}
                                        valor={data.agencia_id}
                                        onChange={cambiarAgencia}
                                        placeholder={cargando === 'agencias' ? 'Cargando...' : data.regional ? 'SELECCIONE' : 'Seleccione la regional'}
                                        disabled={soloLectura || !data.regional || cargando === 'agencias'}
                                        conError={!!errores.agencia_id}
                                    />
                                </Campo>
                                <Campo etiqueta="Puntos satélite de la agencia">
                                    <p className="py-2 text-sm text-slate-600">
                                        {cargando === 'lugares'
                                            ? 'Cargando...'
                                            : lugares.length === 0
                                              ? '—'
                                              : lugares.filter((l) => l.satelite).map((l) => l.nombre).join(', ') || 'No tiene puntos satélite'}
                                    </p>
                                </Campo>
                            </>
                        )}
                    </div>
                </Seccion>

                <Seccion
                    titulo="Visitas del mes"
                    acciones={<span className="text-xs font-medium text-blue-700">{visitas.length} visita(s) agregada(s)</span>}
                >
                    {!listo ? (
                        <p className="py-6 text-center text-sm text-slate-400">
                            {data.dependencia === '' ? 'Seleccione la dependencia.' : 'Seleccione la regional y la agencia principal.'}
                        </p>
                    ) : (
                        <>
                            {/* Agregar: fecha + jornada + lugar + observación */}
                            {!soloLectura && (
                                <>
                                    <div className="grid gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3 sm:grid-cols-[170px_140px_1fr_1fr_auto] sm:items-end">
                                        <Campo etiqueta="Fecha visita" obligatorio>
                                            <input
                                                type="date"
                                                value={nueva.fecha}
                                                min={limites.min}
                                                max={limites.max}
                                                onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })}
                                                onKeyDown={agregarConEnter}
                                                className={inputClass}
                                            />
                                        </Campo>
                                        <Campo etiqueta="Jornada" obligatorio>
                                            <select
                                                value={nueva.jornada}
                                                onChange={(e) => setNueva({ ...nueva, jornada: e.target.value })}
                                                onKeyDown={agregarConEnter}
                                                className={inputClass}
                                            >
                                                <option value="">SELECCIONE</option>
                                                {jornadas.map((j) => (
                                                    <option key={j.valor} value={j.valor}>
                                                        {j.etiqueta}
                                                    </option>
                                                ))}
                                            </select>
                                        </Campo>
                                        <Campo etiqueta={electro ? 'Agencia / punto satélite' : 'Zona'} obligatorio>
                                            <SelectBuscable
                                                opciones={opcionesLugar}
                                                valor={nueva.lugar}
                                                onChange={(v) => setNueva({ ...nueva, lugar: v })}
                                                placeholder="SELECCIONE"
                                            />
                                        </Campo>
                                        <Campo etiqueta="Observación visita">
                                            <input
                                                value={nueva.observacion}
                                                onChange={(e) => setNueva({ ...nueva, observacion: e.target.value })}
                                                onKeyDown={agregarConEnter}
                                                maxLength={1000}
                                                className={inputClass}
                                            />
                                        </Campo>
                                        <button
                                            type="button"
                                            onClick={agregar}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                <path d="M12 5v14M5 12h14" />
                                            </svg>
                                            Agregar
                                        </button>
                                    </div>
                                    {errorNueva && <p className="mt-2 text-xs text-red-600">{errorNueva}</p>}
                                </>
                            )}

                            {/* Visitas agregadas */}
                            {visitas.length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-400">Aún no ha agregado visitas para este mes.</p>
                            ) : (
                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                                <th className="w-36 py-2 pr-3 font-medium">Fecha visita</th>
                                                <th className="w-24 py-2 pr-3 font-medium">Jornada</th>
                                                <th className="py-2 pr-3 font-medium">{electro ? 'Agencia / punto satélite' : 'Zona'}</th>
                                                <th className="py-2 pr-3 font-medium">Observación visita</th>
                                                <th className="w-24 py-2 pr-3 font-medium">Estado</th>
                                                {!soloLectura && <th className="w-10"></th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visitas.map((v, i) => {
                                                const [fecha, dia] = formatearFecha(v.fecha);
                                                const error = errorVisita(i);
                                                return (
                                                    <tr key={`${v.fecha}|${v.jornada}`} className="border-b border-slate-100 align-top last:border-0">
                                                        <td className="py-2 pr-3">
                                                            <p className="font-medium text-slate-700">{fecha}</p>
                                                            <p className="text-xs text-slate-400 capitalize">{dia}</p>
                                                        </td>
                                                        <td className="py-2 pr-3 text-slate-700">{etiquetaJornada(v.jornada)}</td>
                                                        <td className="py-2 pr-3">
                                                            {soloLectura ? (
                                                                <span className="text-slate-700">{nombreLugar(v.lugar)}</span>
                                                            ) : (
                                                                <select
                                                                    value={v.lugar}
                                                                    onChange={(e) => cambiarVisita(i, { lugar: e.target.value })}
                                                                    className={`${inputClass} py-1.5 ${error ? 'border-red-400' : ''}`}
                                                                >
                                                                    <option value="">SELECCIONE</option>
                                                                    {opcionesLugar.map((o) => (
                                                                        <option key={o.valor} value={o.valor}>
                                                                            {o.etiqueta}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                            {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
                                                        </td>
                                                        <td className="py-2 pr-3">
                                                            {soloLectura ? (
                                                                <span className="text-slate-600">{v.observacion || '—'}</span>
                                                            ) : (
                                                                <input
                                                                    value={v.observacion}
                                                                    onChange={(e) => cambiarVisita(i, { observacion: e.target.value })}
                                                                    maxLength={1000}
                                                                    className={`${inputClass} py-1.5`}
                                                                />
                                                            )}
                                                        </td>
                                                        <td className="py-2 pr-3 text-xs text-slate-500">{v.estado ?? 'NUEVA'}</td>
                                                        {!soloLectura && (
                                                            <td className="py-2 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => quitarVisita(i)}
                                                                    title="Quitar visita"
                                                                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                                        <path d="M18 6 6 18M6 6l12 12" />
                                                                    </svg>
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </Seccion>

                <div className="flex flex-wrap justify-between gap-2">
                    <div>
                        {editando && can('vis_delete') && (
                            <button
                                type="button"
                                onClick={() => setEliminando('confirmar')}
                                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:border-red-300 hover:bg-red-100"
                            >
                                Eliminar programación
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Link href={url('/promotoria')} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                            {soloLectura ? 'Regresar' : 'Cancelar'}
                        </Link>
                        {!soloLectura && (
                            <button
                                type="submit"
                                disabled={processing || !listo || visitas.length === 0}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {processing ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar programación'}
                            </button>
                        )}
                    </div>
                </div>
            </form>

            <ModalConfirmar
                abierto={eliminando !== null}
                titulo="Eliminar programación"
                procesando={eliminando === 'procesando'}
                onConfirmar={eliminarProgramacion}
                onCancelar={() => setEliminando(null)}
            >
                ¿Seguro que desea eliminar la programación #{programacion?.id} con sus {programacion?.visitas.length} visita(s)? Esta acción no se puede deshacer.
            </ModalConfirmar>
        </AppLayout>
    );
}
