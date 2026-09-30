import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import DetalleActividad from '@/components/actividades/DetalleActividad';
import PestanasActividades from '@/components/actividades/PestanasActividades';
import Campo, { inputClass } from '@/components/Campo';
import { IconoActividades } from '@/components/Iconos';
import Seccion from '@/components/Seccion';
import SelectBuscable from '@/components/SelectBuscable';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';
import { DetalleDia, Item, Persona, ProductoInventario } from '@/types/actividades';

interface DatosAgencia {
    regional: string;
    coordinadoresRegionales: Persona[];
    municipios: Item[];
    inventario: ProductoInventario[];
    inventarioError: string | null;
}

interface ActividadForm extends DetalleDia {
    fecha: string;
    actividad_tipo_id: string;
    ciudad_id: string;
}

interface AgenciaOpcion {
    codigo: string;
    nombre: string;
    regional: string;
}

// Programación que la agencia ya tiene en el mes: las actividades nuevas se suman a ella
interface ProgramacionExistente {
    id: number;
    coorNacional: Persona;
    coorRegional: Persona;
    responsable: Persona;
    fechas: { fecha: string; id: number }[];
}

interface Props {
    departamentos: Item[];
    tipos: Item[];
    checklist: Item[];
    asesores: Item[];
    coordinadoresNacionales: Persona[];
    responsables: Persona[];
    /** Al llegar desde una actividad ("Agregar actividad a esta programación") */
    inicial: { departamento_id: string; agencia_id: string; mes: string } | null;
}

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// Mes actual y los 11 siguientes, en formato "YYYY-MM"
function mesesDisponibles() {
    const hoy = new Date();
    return Array.from({ length: 12 }, (_, i) => {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        const valor = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        return { valor, etiqueta: `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}` };
    });
}

// Primer y último día del mes ("YYYY-MM"), para limitar el selector de fecha
function limitesMes(mes: string): { min: string; max: string } {
    const [anio, numeroMes] = mes.split('-').map(Number);
    const ultimoDia = new Date(anio, numeroMes, 0).getDate();
    return { min: `${mes}-01`, max: `${mes}-${String(ultimoDia).padStart(2, '0')}` };
}

// "2026-10-02" -> ["02/10/2026", "viernes"] (fecha local para evitar el corrimiento por zona horaria)
function formatearFecha(fecha: string): [string, string] {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const diaSemana = new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { weekday: 'long' });
    return [`${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`, diaSemana];
}

async function obtenerJson<T>(ruta: string): Promise<T> {
    const respuesta = await fetch(ruta, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return respuesta.json();
}

export default function Create({ departamentos, tipos, checklist, asesores, coordinadoresNacionales, responsables, inicial }: Props) {
    const meses = useMemo(mesesDisponibles, []);
    const { data, setData, post, processing, errors, transform } = useForm({
        departamento_id: '',
        regional: '',
        agencia_id: '',
        mes: inicial?.mes ?? meses[0].valor,
        coor_nacional_id: '',
        coor_regional_id: '',
        responsable_id: '',
        actividades: [] as ActividadForm[],
    });
    const errores = errors as Record<string, string>;

    const [agencias, setAgencias] = useState<AgenciaOpcion[]>([]);
    // Regionales que tienen agencias en el departamento, y las agencias de la regional elegida
    const regionales = useMemo(() => [...new Set(agencias.map((a) => a.regional))].sort(), [agencias]);
    const agenciasDeRegional = agencias.filter((a) => a.regional === data.regional);
    const [datosAgencia, setDatosAgencia] = useState<DatosAgencia | null>(null);
    const [cargando, setCargando] = useState<'agencias' | 'agencia' | null>(null);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const agenciaSolicitada = useRef('');

    // Programación existente de la agencia en el mes (modo "agregar actividades")
    const [existente, setExistente] = useState<ProgramacionExistente | null>(null);
    const consultaExistente = useRef('');
    const etiquetaMes = meses.find((m) => m.valor === data.mes)?.etiqueta ?? data.mes;
    const nombreAgencia = agencias.find((a) => a.codigo === data.agencia_id)?.nombre ?? '';

    const consultarExistente = (agencia: string, mes: string) => {
        setExistente(null);
        const clave = `${agencia}|${mes}`;
        consultaExistente.current = clave;
        if (!agencia) return;

        obtenerJson<{ programacion: ProgramacionExistente | null }>(url(`/actividades/datos/programacion?agencia=${encodeURIComponent(agencia)}&mes=${mes}`))
            .then((respuesta) => {
                if (consultaExistente.current !== clave) return; // respuesta de una consulta anterior
                // Solo cuenta como existente si trae sus fechas (nunca un objeto vacío)
                const programacion = respuesta?.programacion && Array.isArray(respuesta.programacion.fechas) ? respuesta.programacion : null;
                setExistente(programacion);
                if (programacion) {
                    // Se conservan los responsables de la programación existente
                    setData((prev) => ({
                        ...prev,
                        coor_nacional_id: programacion.coorNacional.coduser,
                        coor_regional_id: programacion.coorRegional.coduser,
                        responsable_id: programacion.responsable.coduser,
                    }));
                }
            })
            .catch(() => setErrorCarga('No se pudo verificar si la agencia ya tiene programación en el mes.'));
    };

    // Fila para agregar una actividad: fecha + tipo
    const [nuevaFecha, setNuevaFecha] = useState('');
    const [nuevoTipo, setNuevoTipo] = useState('');
    const [errorNueva, setErrorNueva] = useState<string | null>(null);
    const limites = limitesMes(data.mes);

    const cambiarDepartamento = (id: string) => {
        setData((prev) => ({
            ...prev,
            departamento_id: id,
            regional: '',
            agencia_id: '',
            coor_regional_id: '',
            actividades: prev.actividades.map((a) => ({ ...a, ciudad_id: '', productos: [] })),
        }));
        setAgencias([]);
        setDatosAgencia(null);
        setErrorCarga(null);
        consultarExistente('', data.mes);
        if (!id) return Promise.resolve([] as AgenciaOpcion[]);

        setCargando('agencias');
        return obtenerJson<AgenciaOpcion[]>(url(`/actividades/datos/agencias?departamento_id=${id}`))
            .then((lista) => {
                setAgencias(lista);
                // Si el departamento tiene una sola regional, se selecciona sola
                const unicas = [...new Set(lista.map((a) => a.regional))];
                if (unicas.length === 1) setData((prev) => ({ ...prev, regional: unicas[0] }));
                return lista;
            })
            .catch(() => {
                setErrorCarga('No se pudieron cargar las agencias. Intente de nuevo.');
                return [] as AgenciaOpcion[];
            })
            .finally(() => setCargando(null));
    };

    // Otra regional: si la agencia elegida no es de esa regional, se quita
    const cambiarRegional = (regional: string) => {
        setData((prev) => ({ ...prev, regional }));
        const agenciaActual = agencias.find((a) => a.codigo === data.agencia_id);
        if (agenciaActual && agenciaActual.regional !== regional) {
            cambiarAgencia('');
        }
    };

    // mes: se pasa explícito cuando se llama antes de que data.mes se actualice (carga inicial)
    const cambiarAgencia = (codigo: string, mes: string = data.mes) => {
        consultarExistente(codigo, mes);
        // Otra agencia = otro inventario: se quitan los productos ya elegidos
        setData((prev) => ({
            ...prev,
            agencia_id: codigo,
            coor_regional_id: '',
            actividades: prev.actividades.map((a) => ({ ...a, productos: [] })),
        }));
        setDatosAgencia(null);
        setErrorCarga(null);
        agenciaSolicitada.current = codigo;
        if (!codigo) return;

        setCargando('agencia');
        obtenerJson<DatosAgencia>(url(`/actividades/datos/agencia/${encodeURIComponent(codigo)}`))
            .then((datos) => {
                if (agenciaSolicitada.current !== codigo) return; // llegó la respuesta de una agencia anterior
                setDatosAgencia(datos);
                if (datos.coordinadoresRegionales.length === 1) {
                    setData((prev) => ({ ...prev, coor_regional_id: datos.coordinadoresRegionales[0].coduser }));
                }
            })
            .catch(() => setErrorCarga('No se pudieron cargar los datos de la agencia. Intente de nuevo.'))
            .finally(() => setCargando(null));
    };

    const cambiarMes = (mes: string) => {
        if (data.actividades.length > 0 && !window.confirm('Al cambiar el mes se quitan las actividades agregadas. ¿Desea continuar?')) {
            return;
        }
        setData((prev) => ({ ...prev, mes, actividades: [] }));
        setNuevaFecha('');
        setErrorNueva(null);
        consultarExistente(data.agencia_id, mes);
    };

    // Llegando desde una actividad: se cargan su departamento, agencia y mes
    useEffect(() => {
        if (!inicial) return;
        cambiarDepartamento(inicial.departamento_id).then((lista) => {
            const agencia = lista.find((a) => a.codigo === inicial.agencia_id);
            if (agencia) setData((prev) => ({ ...prev, regional: agencia.regional }));
            cambiarAgencia(inicial.agencia_id, inicial.mes);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir la página
    }, []);

    const agregarActividad = () => {
        if (!nuevaFecha || !nuevoTipo) {
            setErrorNueva('Escriba la fecha y seleccione el tipo de actividad.');
            return;
        }
        if (nuevaFecha < limites.min || nuevaFecha > limites.max) {
            setErrorNueva('La fecha debe estar dentro del mes seleccionado.');
            return;
        }
        if (data.actividades.some((a) => a.fecha === nuevaFecha)) {
            setErrorNueva('Ya hay una actividad agregada para esa fecha.');
            return;
        }
        const ocupada = existente?.fechas.find((f) => f.fecha === nuevaFecha);
        if (ocupada) {
            setErrorNueva(`Ya existe la actividad #${ocupada.id} en esa fecha para esta agencia.`);
            return;
        }

        const nueva: ActividadForm = { fecha: nuevaFecha, actividad_tipo_id: nuevoTipo, ciudad_id: '', productos: [], asesores: [], checklist: [] };
        setData((prev) => ({
            ...prev,
            actividades: [...prev.actividades, nueva].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        }));
        setNuevaFecha('');
        setErrorNueva(null);
    };

    // Enter en la fila de agregar agrega la actividad en vez de enviar el formulario
    const agregarConEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregarActividad();
        }
    };

    const actualizarActividad = (fecha: string, cambios: Partial<ActividadForm>) => {
        setData((prev) => ({ ...prev, actividades: prev.actividades.map((a) => (a.fecha === fecha ? { ...a, ...cambios } : a)) }));
    };

    const quitarActividad = (fecha: string) => {
        setData((prev) => ({ ...prev, actividades: prev.actividades.filter((a) => a.fecha !== fecha) }));
    };

    const guardar = (e: FormEvent) => {
        e.preventDefault();

        // Solo los campos que espera el servidor (sin nombres ni referencias de productos)
        transform((d) => ({
            departamento_id: d.departamento_id,
            regional: d.regional,
            agencia_id: d.agencia_id,
            mes: d.mes,
            coor_nacional_id: d.coor_nacional_id,
            coor_regional_id: d.coor_regional_id,
            responsable_id: d.responsable_id,
            actividades: d.actividades.map((a) => ({
                fecha: a.fecha,
                actividad_tipo_id: a.actividad_tipo_id,
                ciudad_id: a.ciudad_id,
                productos: a.productos.map((p) => ({ producto: p.producto, cantidad: p.cantidad })),
                asesores: a.asesores,
                checklist: a.checklist,
            })),
        }));

        post(url('/actividades/programacion'), { preserveScroll: true });
    };

    const hayErrores = Object.keys(errores).length > 0;

    return (
        <AppLayout titulo={existente ? 'Actividades › Agregar actividades' : 'Actividades › Nueva programación'} icono={<IconoActividades />}>
            <Head title={existente ? 'Agregar actividades' : 'Nueva programación'} />

            <PestanasActividades />

            <form onSubmit={guardar} className="space-y-4">
                {hayErrores && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errores.actividades ?? 'Hay campos por corregir. Revise los que están marcados en rojo.'}
                    </p>
                )}
                {errorCarga && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorCarga}</p>}

                <Seccion titulo="Información general">
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Campo etiqueta="Departamento" obligatorio error={errores.departamento_id}>
                            <SelectBuscable
                                opciones={departamentos.map((d) => ({ valor: String(d.id), etiqueta: d.nombre }))}
                                valor={data.departamento_id}
                                onChange={cambiarDepartamento}
                                conError={!!errores.departamento_id}
                            />
                        </Campo>

                        <Campo etiqueta="Regional" obligatorio error={errores.regional}>
                            <select
                                value={data.regional}
                                onChange={(e) => cambiarRegional(e.target.value)}
                                disabled={!data.departamento_id || cargando === 'agencias'}
                                className={inputClass}
                            >
                                <option value="">{cargando === 'agencias' ? 'Cargando...' : data.departamento_id ? 'SELECCIONE' : 'Seleccione el departamento'}</option>
                                {regionales.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </Campo>

                        <Campo etiqueta="Agencia" obligatorio error={errores.agencia_id}>
                            <SelectBuscable
                                opciones={agenciasDeRegional.map((a) => ({ valor: a.codigo, etiqueta: a.nombre }))}
                                valor={data.agencia_id}
                                onChange={(codigo) => cambiarAgencia(codigo)}
                                placeholder={cargando === 'agencia' ? 'Cargando...' : data.regional ? 'SELECCIONE' : 'Seleccione la regional'}
                                disabled={!data.regional}
                                conError={!!errores.agencia_id}
                            />
                        </Campo>

                        <Campo etiqueta="Mes actividad" obligatorio error={errores.mes}>
                            <select value={data.mes} onChange={(e) => cambiarMes(e.target.value)} className={inputClass}>
                                {meses.map((m) => (
                                    <option key={m.valor} value={m.valor}>
                                        {m.etiqueta}
                                    </option>
                                ))}
                            </select>
                        </Campo>
                    </div>
                </Seccion>

                {existente && (
                    <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        <svg className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        <p>
                            <strong>{nombreAgencia || 'La agencia'}</strong> ya tiene programación en <strong>{etiquetaMes}</strong> con{' '}
                            {existente.fechas.length} actividad(es). Las actividades que agregue se sumarán a esa programación y se conservan sus
                            responsables.
                        </p>
                    </div>
                )}

                {existente ? (
                    <Seccion titulo="Responsables (de la programación existente)">
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Campo etiqueta="Coordinador nacional">
                                <input value={existente.coorNacional.nombre} disabled className={inputClass} />
                            </Campo>
                            <Campo etiqueta="Coordinador regional">
                                <input value={existente.coorRegional.nombre} disabled className={inputClass} />
                            </Campo>
                            <Campo etiqueta="Responsable">
                                <input value={existente.responsable.nombre} disabled className={inputClass} />
                            </Campo>
                        </div>
                    </Seccion>
                ) : (
                    <Seccion titulo="Responsables">
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Campo etiqueta="Coordinador nacional" obligatorio error={errores.coor_nacional_id}>
                                <SelectBuscable
                                    opciones={coordinadoresNacionales.map((c) => ({ valor: c.coduser, etiqueta: c.nombre }))}
                                    valor={data.coor_nacional_id}
                                    onChange={(v) => setData('coor_nacional_id', v)}
                                    conError={!!errores.coor_nacional_id}
                                />
                            </Campo>
    
                            <Campo etiqueta="Coordinador regional" obligatorio error={errores.coor_regional_id}>
                                <SelectBuscable
                                    opciones={(datosAgencia?.coordinadoresRegionales ?? []).map((c) => ({ valor: c.coduser, etiqueta: c.nombre }))}
                                    valor={data.coor_regional_id}
                                    onChange={(v) => setData('coor_regional_id', v)}
                                    placeholder={data.agencia_id ? 'SELECCIONE' : 'Seleccione la agencia'}
                                    disabled={!datosAgencia}
                                    conError={!!errores.coor_regional_id}
                                />
                                {datosAgencia && datosAgencia.coordinadoresRegionales.length === 0 && (
                                    <p className="mt-1 text-xs text-amber-700">La agencia no tiene coordinador regional asignado.</p>
                                )}
                            </Campo>
    
                            <Campo etiqueta="Responsable" obligatorio error={errores.responsable_id}>
                                <SelectBuscable
                                    opciones={responsables.map((r) => ({ valor: r.coduser, etiqueta: r.nombre }))}
                                    valor={data.responsable_id}
                                    onChange={(v) => setData('responsable_id', v)}
                                    conError={!!errores.responsable_id}
                                />
                                {responsables.length === 0 && (
                                    <p className="mt-1 text-xs text-amber-700">
                                        Ningún usuario tiene un perfil con el permiso "Puede ser responsable de actividad".
                                    </p>
                                )}
                            </Campo>
                        </div>
                    </Seccion>
                )}

                <Seccion
                    titulo="Actividades del mes"
                    acciones={<span className="text-xs font-medium text-blue-700">{data.actividades.length} actividad(es) agregada(s)</span>}
                >
                    {/* Agregar: fecha + tipo */}
                    <div className="grid gap-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                        <Campo etiqueta="Fecha actividad" obligatorio>
                            <input
                                type="date"
                                value={nuevaFecha}
                                min={limites.min}
                                max={limites.max}
                                onChange={(e) => setNuevaFecha(e.target.value)}
                                onKeyDown={agregarConEnter}
                                className={inputClass}
                            />
                        </Campo>

                        <Campo etiqueta="Tipo de actividad" obligatorio>
                            <select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} onKeyDown={agregarConEnter} className={inputClass}>
                                <option value="">SELECCIONE</option>
                                {tipos.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.nombre}
                                    </option>
                                ))}
                            </select>
                        </Campo>

                        <button
                            type="button"
                            onClick={agregarActividad}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            Agregar
                        </button>
                    </div>
                    {errorNueva && <p className="mt-2 text-xs text-red-600">{errorNueva}</p>}

                    {/* Actividades agregadas */}
                    {data.actividades.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">Aún no ha agregado actividades para este mes.</p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {data.actividades.map((actividad, i) => (
                                <TarjetaActividad
                                    key={actividad.fecha}
                                    actividad={actividad}
                                    error={(campo) => errores[`actividades.${i}.${campo}`]}
                                    tipos={tipos}
                                    checklist={checklist}
                                    asesores={asesores}
                                    datosAgencia={datosAgencia}
                                    agenciaSeleccionada={!!data.agencia_id}
                                    onChange={(cambios) => actualizarActividad(actividad.fecha, cambios)}
                                    onQuitar={() => quitarActividad(actividad.fecha)}
                                />
                            ))}
                        </div>
                    )}
                </Seccion>

                <div className="flex justify-end gap-2">
                    <Link href={url('/actividades')} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {processing ? 'Guardando…' : existente ? 'Agregar a la programación' : 'Guardar programación'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}

interface TarjetaActividadProps {
    actividad: ActividadForm;
    error: (campo: string) => string | undefined;
    tipos: Item[];
    checklist: Item[];
    asesores: Item[];
    datosAgencia: DatosAgencia | null;
    agenciaSeleccionada: boolean;
    onChange: (cambios: Partial<ActividadForm>) => void;
    onQuitar: () => void;
}

// Una actividad agregada: fecha fija, tipo y municipio editables, y su detalle (productos, asesores, checklist)
function TarjetaActividad({ actividad, error, tipos, checklist, asesores, datosAgencia, agenciaSeleccionada, onChange, onQuitar }: TarjetaActividadProps) {
    const [fecha, diaSemana] = formatearFecha(actividad.fecha);

    return (
        <div className="rounded-lg border border-blue-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-100 p-3 md:grid-cols-[150px_1fr_1fr_auto] md:items-start">
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5">
                    <p className="text-sm font-semibold text-slate-700">{fecha}</p>
                    <p className="text-xs text-slate-500 capitalize">{diaSemana}</p>
                    {error('fecha') && <p className="text-xs text-red-600">{error('fecha')}</p>}
                </div>

                <div>
                    <select
                        value={actividad.actividad_tipo_id}
                        onChange={(e) => onChange({ actividad_tipo_id: e.target.value })}
                        className={`${inputClass} ${error('actividad_tipo_id') ? 'border-red-400' : ''}`}
                    >
                        {tipos.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.nombre}
                            </option>
                        ))}
                    </select>
                    {error('actividad_tipo_id') && <p className="mt-1 text-xs text-red-600">{error('actividad_tipo_id')}</p>}
                </div>

                <div>
                    <SelectBuscable
                        opciones={(datosAgencia?.municipios ?? []).map((m) => ({ valor: String(m.id), etiqueta: m.nombre }))}
                        valor={actividad.ciudad_id}
                        onChange={(v) => onChange({ ciudad_id: v })}
                        placeholder={datosAgencia ? 'MUNICIPIO' : 'Seleccione la agencia'}
                        disabled={!datosAgencia}
                        conError={!!error('ciudad_id')}
                    />
                    {error('ciudad_id') && <p className="mt-1 text-xs text-red-600">{error('ciudad_id')}</p>}
                </div>

                <button
                    type="button"
                    onClick={onQuitar}
                    title="Quitar esta actividad"
                    className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    Quitar
                </button>
            </div>

            <div className="p-3">
                <DetalleActividad
                    valor={actividad}
                    onChange={onChange}
                    inventario={datosAgencia && !datosAgencia.inventarioError ? datosAgencia.inventario : null}
                    mensajeInventario={
                        !agenciaSeleccionada ? 'Seleccione la agencia para ver su inventario.' : (datosAgencia?.inventarioError ?? 'Cargando inventario...')
                    }
                    asesores={asesores}
                    checklist={checklist}
                    error={error}
                />
            </div>
        </div>
    );
}
