import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import PestanasActividades from '@/components/actividades/PestanasActividades';
import Campo, { inputClass } from '@/components/Campo';
import { IconoActividades } from '@/components/Iconos';
import Seccion from '@/components/Seccion';
import DetalleActividad from '@/components/actividades/DetalleActividad';
import SelectBuscable from '@/components/SelectBuscable';
import AppLayout from '@/layouts/AppLayout';
import { DetalleDia, Item, Persona, ProductoInventario } from '@/types/actividades';

interface DatosAgencia {
    regional: string;
    coordinadoresRegionales: Persona[];
    municipios: Item[];
    inventario: ProductoInventario[];
    inventarioError: string | null;
}

interface Dia extends DetalleDia {
    fecha: string;
    actividad_tipo_id: string;
    ciudad_id: string;
}

interface Props {
    departamentos: Item[];
    tipos: Item[];
    checklist: Item[];
    asesores: Item[];
    coordinadoresNacionales: Persona[];
    responsables: Persona[];
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

// Todos los días del mes, vacíos
function generarDias(mes: string): Dia[] {
    const [anio, numeroMes] = mes.split('-').map(Number);
    const totalDias = new Date(anio, numeroMes, 0).getDate();

    return Array.from({ length: totalDias }, (_, i) => ({
        fecha: `${mes}-${String(i + 1).padStart(2, '0')}`,
        actividad_tipo_id: '',
        ciudad_id: '',
        productos: [],
        asesores: [],
        checklist: [],
    }));
}

const diaVacio = { actividad_tipo_id: '', ciudad_id: '', productos: [], asesores: [], checklist: [] };

// Un día se envía si el usuario diligenció cualquier dato
const tieneDatos = (d: Dia) =>
    d.actividad_tipo_id !== '' || d.ciudad_id !== '' || d.productos.length > 0 || d.asesores.length > 0 || d.checklist.length > 0;

async function obtenerJson<T>(url: string): Promise<T> {
    const respuesta = await fetch(url, { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return respuesta.json();
}

export default function Create({ departamentos, tipos, checklist, asesores, coordinadoresNacionales, responsables }: Props) {
    const meses = useMemo(mesesDisponibles, []);
    const { data, setData, post, processing, errors, transform } = useForm({
        departamento_id: '',
        agencia_id: '',
        mes: meses[0].valor,
        coor_nacional_id: '',
        coor_regional_id: '',
        responsable_id: '',
        dias: generarDias(meses[0].valor),
    });
    const errores = errors as Record<string, string>;

    const [agencias, setAgencias] = useState<{ codigo: string; nombre: string }[]>([]);
    const [datosAgencia, setDatosAgencia] = useState<DatosAgencia | null>(null);
    const [cargando, setCargando] = useState<'agencias' | 'agencia' | null>(null);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const agenciaSolicitada = useRef('');

    // Posición de cada día dentro de lo que se envía (para ubicar los errores "actividades.N.campo")
    const indiceEnvio = useMemo(() => {
        let k = 0;
        return data.dias.map((d) => (tieneDatos(d) ? k++ : -1));
    }, [data.dias]);
    const diasConActividad = indiceEnvio.filter((i) => i >= 0).length;

    const cambiarDepartamento = (id: string) => {
        setData((prev) => ({
            ...prev,
            departamento_id: id,
            agencia_id: '',
            coor_regional_id: '',
            dias: prev.dias.map((d) => ({ ...d, ciudad_id: '', productos: [] })),
        }));
        setAgencias([]);
        setDatosAgencia(null);
        setErrorCarga(null);
        if (!id) return;

        setCargando('agencias');
        obtenerJson<{ codigo: string; nombre: string }[]>(`/actividades/datos/agencias?departamento_id=${id}`)
            .then(setAgencias)
            .catch(() => setErrorCarga('No se pudieron cargar las agencias. Intente de nuevo.'))
            .finally(() => setCargando(null));
    };

    const cambiarAgencia = (codigo: string) => {
        // Otra agencia = otro inventario: se quitan los productos ya elegidos
        setData((prev) => ({
            ...prev,
            agencia_id: codigo,
            coor_regional_id: '',
            dias: prev.dias.map((d) => ({ ...d, productos: [] })),
        }));
        setDatosAgencia(null);
        setErrorCarga(null);
        agenciaSolicitada.current = codigo;
        if (!codigo) return;

        setCargando('agencia');
        obtenerJson<DatosAgencia>(`/actividades/datos/agencia/${encodeURIComponent(codigo)}`)
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
        if (diasConActividad > 0 && !window.confirm('Al cambiar el mes se borran los días diligenciados. ¿Desea continuar?')) {
            return;
        }
        setData((prev) => ({ ...prev, mes, dias: generarDias(mes) }));
    };

    const actualizarDia = (i: number, cambios: Partial<Dia>) => {
        setData((prev) => ({ ...prev, dias: prev.dias.map((d, j) => (j === i ? { ...d, ...cambios } : d)) }));
    };

    const guardar = (e: FormEvent) => {
        e.preventDefault();

        // Solo viajan los días diligenciados, con los campos que espera el servidor
        transform((d) => ({
            departamento_id: d.departamento_id,
            agencia_id: d.agencia_id,
            mes: d.mes,
            coor_nacional_id: d.coor_nacional_id,
            coor_regional_id: d.coor_regional_id,
            responsable_id: d.responsable_id,
            actividades: d.dias.filter(tieneDatos).map((dia) => ({
                fecha: dia.fecha,
                actividad_tipo_id: dia.actividad_tipo_id,
                ciudad_id: dia.ciudad_id,
                productos: dia.productos.map((p) => ({ producto: p.producto, cantidad: p.cantidad })),
                asesores: dia.asesores,
                checklist: dia.checklist,
            })),
        }));

        post('/actividades/programacion', { preserveScroll: true });
    };

    const hayErrores = Object.keys(errores).length > 0;

    return (
        <AppLayout titulo="Actividades › Nueva programación" icono={<IconoActividades />}>
            <Head title="Nueva programación" />

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

                        <Campo etiqueta="Agencia" obligatorio error={errores.agencia_id}>
                            <SelectBuscable
                                opciones={agencias.map((a) => ({ valor: a.codigo, etiqueta: a.nombre }))}
                                valor={data.agencia_id}
                                onChange={cambiarAgencia}
                                placeholder={cargando === 'agencias' ? 'Cargando...' : 'SELECCIONE'}
                                disabled={!data.departamento_id || cargando === 'agencias'}
                                conError={!!errores.agencia_id}
                            />
                        </Campo>

                        <Campo etiqueta="Regional">
                            <input
                                value={cargando === 'agencia' ? 'Cargando...' : (datosAgencia?.regional ?? '')}
                                disabled
                                placeholder="Se llena con la agencia"
                                className={inputClass}
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

                <Seccion
                    titulo="Actividades del mes"
                    acciones={<span className="text-xs font-medium text-blue-700">{diasConActividad} día(s) con actividad</span>}
                >
                    <p className="mb-3 text-xs text-slate-500">Diligencie solo los días que tendrán actividad; los días vacíos no se guardan.</p>

                    <div className="space-y-2">
                        {data.dias.map((dia, i) => (
                            <FilaDia
                                key={dia.fecha}
                                dia={dia}
                                error={(campo) => (indiceEnvio[i] >= 0 ? errores[`actividades.${indiceEnvio[i]}.${campo}`] : undefined)}
                                tipos={tipos}
                                checklist={checklist}
                                asesores={asesores}
                                datosAgencia={datosAgencia}
                                agenciaSeleccionada={!!data.agencia_id}
                                onChange={(cambios) => actualizarDia(i, cambios)}
                            />
                        ))}
                    </div>
                </Seccion>

                <div className="flex justify-end gap-2">
                    <Link href="/actividades" className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300">
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {processing ? 'Guardando…' : 'Guardar programación'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}

interface FilaDiaProps {
    dia: Dia;
    error: (campo: string) => string | undefined;
    tipos: Item[];
    checklist: Item[];
    asesores: Item[];
    datosAgencia: DatosAgencia | null;
    agenciaSeleccionada: boolean;
    onChange: (cambios: Partial<Dia>) => void;
}

// Un día del mes: fecha, tipo y municipio; al elegir tipo se despliegan productos, asesores y checklist
function FilaDia({ dia, error, tipos, checklist, asesores, datosAgencia, agenciaSeleccionada, onChange }: FilaDiaProps) {
    const [anio, mes, numeroDia] = dia.fecha.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, numeroDia); // fecha local (evita el corrimiento por zona horaria)
    const diaSemana = fecha.toLocaleDateString('es-CO', { weekday: 'long' });
    const finDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
    const lleno = tieneDatos(dia);

    return (
        <div className={`rounded-lg border ${lleno ? 'border-blue-200 bg-white shadow-sm' : finDeSemana ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
            <div className="grid gap-3 p-3 md:grid-cols-[150px_1fr_1fr_auto] md:items-start">
                <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5">
                    <p className="text-sm font-semibold text-slate-700">
                        {String(numeroDia).padStart(2, '0')}/{String(mes).padStart(2, '0')}/{anio}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{diaSemana}</p>
                </div>

                <div>
                    <select
                        value={dia.actividad_tipo_id}
                        onChange={(e) => onChange({ actividad_tipo_id: e.target.value })}
                        className={`${inputClass} ${error('actividad_tipo_id') ? 'border-red-400' : ''}`}
                    >
                        <option value="">TIPO DE ACTIVIDAD</option>
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
                        valor={dia.ciudad_id}
                        onChange={(v) => onChange({ ciudad_id: v })}
                        placeholder={datosAgencia ? 'MUNICIPIO' : 'Seleccione la agencia'}
                        disabled={!datosAgencia}
                        conError={!!error('ciudad_id')}
                    />
                    {error('ciudad_id') && <p className="mt-1 text-xs text-red-600">{error('ciudad_id')}</p>}
                </div>

                <div className="flex h-[38px] items-center">
                    {lleno && (
                        <button
                            type="button"
                            onClick={() => onChange(diaVacio)}
                            title="Limpiar este día"
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {lleno && (
                <div className="border-t border-slate-100 p-3">
                    <DetalleActividad
                        valor={dia}
                        onChange={onChange}
                        inventario={datosAgencia && !datosAgencia.inventarioError ? datosAgencia.inventario : null}
                        mensajeInventario={
                            !agenciaSeleccionada
                                ? 'Seleccione la agencia para ver su inventario.'
                                : (datosAgencia?.inventarioError ?? 'Cargando inventario...')
                        }
                        asesores={asesores}
                        checklist={checklist}
                        error={error}
                    />
                </div>
            )}
        </div>
    );
}
