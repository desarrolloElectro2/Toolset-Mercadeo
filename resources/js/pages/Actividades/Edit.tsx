import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import DetalleActividad from '@/components/actividades/DetalleActividad';
import EjecucionActividad, { DatosEjecucion } from '@/components/actividades/EjecucionActividad';
import EstadoActividad from '@/components/actividades/EstadoActividad';
import EvidenciasActividad, { Evidencia } from '@/components/actividades/EvidenciasActividad';
import ProspectosActividad, { ProspectosDelDia } from '@/components/actividades/ProspectosActividad';
import ResponsableEvento from '@/components/actividades/ResponsableEvento';
import PestanasActividades from '@/components/actividades/PestanasActividades';
import Campo, { inputClass } from '@/components/Campo';
import { IconoActividades } from '@/components/Iconos';
import Seccion from '@/components/Seccion';
import SelectBuscable from '@/components/SelectBuscable';
import { useCan } from '@/hooks/useCan';
import AppLayout from '@/layouts/AppLayout';
import { AsesoresManager, DetalleDia, EmpleadoManager, EstadoCatalogo, Item, Persona, ProductoInventario, TITULOS_ASESORES } from '@/types/actividades';
import { url } from '@/lib/url';

interface Props {
    actividad: DetalleDia & {
        id: number;
        fecha: string;
        estado: string;
        actividad_tipo_id: string;
        ciudad_id: string;
        tipo_responsable: string;
        responsable_evento_id: string; // cédula del empleado en Manager
    };
    programacion: {
        id: number;
        admiteNuevas: boolean;
        agencia: string;
        regional: string;
        mes: string;
        coorRegional: string;
        responsable: string; // responsable mercadeo
    };
    ejecucion: DatosEjecucion;
    editable: boolean;
    tipos: Item[];
    checklist: Item[];
    asesores: Persona[];
    municipios: Item[];
    inventario: ProductoInventario[];
    inventarioError: string | null;
    historial: { id: number; estado: string; observacion: string | null; usuario: string; fecha: string | null }[];
    estados: EstadoCatalogo[];
    tiposResponsable: { valor: string; nombre: string }[];
    /** Empleados de Manager por tipo (incluye el guardado); null si Manager no respondió */
    responsablesAgencia: Record<string, EmpleadoManager[]> | null;
    responsablesError: string | null;
    /** Asesores de Manager por grupo (planta / externos; coduser = cédula), incluye los guardados */
    asesoresManager: AsesoresManager;
    asesoresManagerError: string | null;
    /** Id del tipo de actividad => grupo de asesores de Manager; los demás usan toolset_perf */
    gruposAsesores: Record<string, string>;
    evidencias: Evidencia[];
    /** Solo cuando la actividad está finalizada */
    prospectos: ProspectosDelDia | null;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-slate-500">{etiqueta}</p>
            <p className="mt-0.5 text-sm text-slate-800">{valor}</p>
        </div>
    );
}

export default function Edit({ actividad, programacion, ejecucion, editable, tipos, checklist, asesores, municipios, inventario, inventarioError, historial, estados, tiposResponsable, responsablesAgencia, responsablesError, asesoresManager, asesoresManagerError, gruposAsesores, evidencias, prospectos }: Props) {
    const can = useCan();
    const soloLectura = !editable || !can('act_edit');

    const { data, setData, put, processing, errors } = useForm({
        actividad_tipo_id: actividad.actividad_tipo_id,
        ciudad_id: actividad.ciudad_id,
        tipo_responsable: actividad.tipo_responsable,
        responsable_evento_id: actividad.responsable_evento_id,
        productos: actividad.productos,
        asesores: actividad.asesores,
        checklist: actividad.checklist,
    });
    const errores = errors as Record<string, string>;

    const [anio, mes, dia] = actividad.fecha.split('-').map(Number);
    const diaSemana = new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { weekday: 'long' });
    const fecha = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;

    // En agencia y en correría los asesores salen de Manager (planta / externos); en los demás tipos, de toolset_perf
    const grupo = gruposAsesores[data.actividad_tipo_id];
    const cambiarTipo = (tipo: string) =>
        // Al cambiar de lista de asesores se quitan los escogidos (son personas distintas)
        setData((prev) =>
            gruposAsesores[tipo] === gruposAsesores[prev.actividad_tipo_id]
                ? { ...prev, actividad_tipo_id: tipo }
                : { ...prev, actividad_tipo_id: tipo, asesores: [] },
        );

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        put(url(`/actividades/${actividad.id}`), { preserveScroll: true });
    };

    return (
        <AppLayout titulo={`Actividades › Actividad #${actividad.id}`} icono={<IconoActividades />}>
            <Head title={`Actividad #${actividad.id}`} />

            <PestanasActividades />

            <form onSubmit={guardar} className="space-y-4">
                {!editable && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Esta actividad ya no se puede editar por su estado; se muestra solo para consulta.
                    </p>
                )}

                <Seccion
                    titulo="Programación"
                    acciones={
                        programacion.admiteNuevas &&
                        can('act_create') && (
                            <Link
                                href={url(`/actividades/programacion/crear?programacion=${programacion.id}`)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                Agregar actividad a esta programación
                            </Link>
                        )
                    }
                >
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                        <Dato etiqueta="Agencia" valor={programacion.agencia} />
                        <Dato etiqueta="Regional" valor={programacion.regional} />
                        <Dato etiqueta="Mes" valor={programacion.mes} />
                        <Dato etiqueta="Coordinador regional" valor={programacion.coorRegional} />
                        <Dato etiqueta="Responsable mercadeo" valor={programacion.responsable} />
                    </div>
                </Seccion>

                <Seccion titulo={`Actividad #${actividad.id}`} acciones={<EstadoActividad estado={actividad.estado} estados={estados} />}>
                    <div className="mb-5 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                        <Campo etiqueta="Fecha">
                            <input value={`${fecha} · ${diaSemana}`} disabled className={`${inputClass} capitalize`} />
                        </Campo>

                        <Campo etiqueta="Tipo de actividad" obligatorio error={errores.actividad_tipo_id}>
                            <select
                                value={data.actividad_tipo_id}
                                onChange={(e) => cambiarTipo(e.target.value)}
                                disabled={soloLectura}
                                className={inputClass}
                            >
                                {tipos.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.nombre}
                                    </option>
                                ))}
                            </select>
                        </Campo>

                        <Campo etiqueta="Municipio" obligatorio error={errores.ciudad_id}>
                            <SelectBuscable
                                opciones={municipios.map((m) => ({ valor: String(m.id), etiqueta: m.nombre }))}
                                valor={data.ciudad_id}
                                onChange={(v) => setData('ciudad_id', v)}
                                disabled={soloLectura}
                                conError={!!errores.ciudad_id}
                            />
                        </Campo>

                        <ResponsableEvento
                            tipos={tiposResponsable}
                            responsables={responsablesAgencia}
                            mensaje={responsablesError}
                            tipo={data.tipo_responsable}
                            responsable={data.responsable_evento_id}
                            onChange={(cambios) => setData((prev) => ({ ...prev, ...cambios }))}
                            error={(campo) => errores[campo]}
                            soloLectura={soloLectura}
                        />
                    </div>

                    <DetalleActividad
                        valor={data}
                        onChange={(cambios) => setData((prev) => ({ ...prev, ...cambios }))}
                        inventario={inventarioError ? null : inventario}
                        mensajeInventario={inventarioError}
                        asesores={grupo ? (asesoresManager[grupo] ?? []) : asesores}
                        tituloAsesores={grupo ? TITULOS_ASESORES[grupo] : 'Asesores'}
                        mensajeAsesores={grupo && !soloLectura && asesoresManager[grupo] === null ? asesoresManagerError : undefined}
                        checklist={checklist}
                        error={(campo) => errores[campo]}
                        soloLectura={soloLectura}
                    />
                </Seccion>

                <div className="flex justify-end gap-2">
                    <Link href={url('/actividades')} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                        Regresar
                    </Link>
                    {!soloLectura && (
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {processing ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    )}
                </div>
            </form>

            <div className="mt-4 space-y-4">
                <EjecucionActividad
                    actividadId={actividad.id}
                    estado={actividad.estado}
                    fecha={fecha}
                    ejecucion={ejecucion}
                    estados={estados}
                />

                {prospectos && <ProspectosActividad datos={prospectos} />}

                <EvidenciasActividad actividadId={actividad.id} evidencias={evidencias} puedeCargar={can('act_edit')} />

                <Seccion titulo="Historial">
                    {historial.length === 0 ? (
                        <p className="text-sm text-slate-400">Sin movimientos.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                    <th className="py-2 pr-3 font-medium">Fecha</th>
                                    <th className="py-2 pr-3 font-medium">Estado</th>
                                    <th className="py-2 pr-3 font-medium">Observación</th>
                                    <th className="py-2 font-medium">Usuario</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map((h) => (
                                    <tr key={h.id} className="border-b border-slate-100 last:border-0">
                                        <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{h.fecha ?? '—'}</td>
                                        <td className="py-2 pr-3">
                                            <EstadoActividad estado={h.estado} estados={estados} />
                                        </td>
                                        <td className="py-2 pr-3 text-slate-700">{h.observacion ?? '—'}</td>
                                        <td className="py-2 text-slate-600">{h.usuario}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Seccion>
            </div>
        </AppLayout>
    );
}
