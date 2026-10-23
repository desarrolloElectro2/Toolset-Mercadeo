import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import EstadoActividad from '@/components/actividades/EstadoActividad';
import PestanasActividades from '@/components/actividades/PestanasActividades';
import { inputClass } from '@/components/Campo';
import { IconoActividades } from '@/components/Iconos';
import ModalConfirmar from '@/components/ModalConfirmar';
import Paginacion from '@/components/Paginacion';
import SelectBuscable from '@/components/SelectBuscable';
import { useCan } from '@/hooks/useCan';
import AppLayout from '@/layouts/AppLayout';
import { Paginado } from '@/types';
import { EstadoCatalogo } from '@/types/actividades';
import { url } from '@/lib/url';

interface ActividadFila {
    id: number;
    fecha: string;
    regional: string;
    agencia: string;
    municipio: string;
    tipo: string;
    responsable: string;
    horaInicio: string | null;
    estado: string;
    editable: boolean;
    presupuesto: number; // total asignado del checklist
    /** Cambio de presupuesto en lote que admite la actividad */
    accionPresupuesto: AccionPresupuesto | null;
    creadoPor: string; // usuario que creó la actividad
    creadoEn: string | null; // "YYYY-MM-DD HH:mm"
}

type AccionPresupuesto = 'asignar' | 'autorizar';

// Botón, permiso y ruta de cada cambio de presupuesto en lote
const ACCIONES: Record<AccionPresupuesto, { titulo: string; confirmar: string; permiso: string; ruta: string; destino: string }> = {
    asignar: { titulo: 'Asignar presupuesto', confirmar: 'Asignar', permiso: 'act_edit', ruta: '/actividades/presupuesto/asignar', destino: 'PRESUPUESTO ASIGNADO' },
    autorizar: { titulo: 'Autorizar presupuesto', confirmar: 'Autorizar', permiso: 'act_autorizar', ruta: '/actividades/presupuesto/autorizar', destino: 'PRESUPUESTO AUTORIZADO' },
};

const pesos = (valor: number) => `$ ${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

interface Filtros {
    buscar: string;
    regional: string;
    agencia: string;
    mes: string;
    estado: string;
}

interface Props {
    actividades: Paginado<ActividadFila>;
    filtros: Filtros;
    opciones: {
        regionales: string[];
        agencias: { codigo: string; nombre: string }[];
        meses: { valor: string; etiqueta: string }[];
        estados: EstadoCatalogo[];
    };
}

// "2026-10-02" -> ["02/10/2026", "viernes"]
function formatearFecha(fecha: string): [string, string] {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const diaSemana = new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { weekday: 'long' });
    return [`${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`, diaSemana];
}

const botonAccion = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150';

export default function Index({ actividades, filtros, opciones }: Props) {
    const can = useCan();
    const [buscar, setBuscar] = useState(filtros.buscar);

    // Selección para el cambio de presupuesto en lote (solo la página actual)
    const [seleccion, setSeleccion] = useState<number[]>([]);
    const [confirmando, setConfirmando] = useState<AccionPresupuesto | null>(null);
    const [procesando, setProcesando] = useState(false);
    useEffect(() => setSeleccion([]), [actividades]);

    const seleccionables = actividades.data.filter((a) => a.accionPresupuesto && can(ACCIONES[a.accionPresupuesto].permiso));
    const todasMarcadas = seleccionables.length > 0 && seleccionables.every((a) => seleccion.includes(a.id));
    const marcar = (id: number, marcada: boolean) => setSeleccion((prev) => (marcada ? [...prev, id] : prev.filter((x) => x !== id)));
    const marcarTodas = (marcada: boolean) => setSeleccion(marcada ? seleccionables.map((a) => a.id) : []);

    // Seleccionadas que admiten cada acción
    const paraAccion = (accion: AccionPresupuesto) => actividades.data.filter((a) => seleccion.includes(a.id) && a.accionPresupuesto === accion);
    const totalAccion = (accion: AccionPresupuesto) => paraAccion(accion).reduce((suma, a) => suma + a.presupuesto, 0);

    const ejecutar = () => {
        if (!confirmando) return;
        router.post(
            url(ACCIONES[confirmando].ruta),
            { ids: paraAccion(confirmando).map((a) => a.id) },
            {
                preserveScroll: true,
                onStart: () => setProcesando(true),
                onFinish: () => {
                    setProcesando(false);
                    setConfirmando(null);
                },
            },
        );
    };

    const filtrar = (cambios: Partial<Filtros>) => {
        const nuevos = { ...filtros, buscar, ...cambios };
        // Solo viajan los filtros con valor (el mes siempre, para distinguir "mes actual" de "todos")
        const params = Object.fromEntries(Object.entries(nuevos).filter(([clave, valor]) => valor !== '' || clave === 'mes'));
        router.get(url('/actividades'), params, { preserveState: true, replace: true });
    };

    // Descarga el CSV de las actividades en PRESUPUESTO ASIGNADO con los filtros actuales (el de estado no aplica)
    const reportePresupuesto = () => {
        const { estado: _estado, ...resto } = filtros;
        const params = Object.entries(resto).filter(([clave, valor]) => valor !== '' || clave === 'mes');
        window.location.assign(url(`/actividades/presupuesto/reporte?${new URLSearchParams(params)}`));
    };

    const buscarTexto = (e: FormEvent) => {
        e.preventDefault();
        filtrar({ buscar });
    };

    return (
        <AppLayout titulo="Actividades" icono={<IconoActividades />}>
            <Head title="Lista actividades" />

            <PestanasActividades />

            <div className="rounded-lg border border-slate-200 bg-white p-6">
                {/* Filtros */}
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <form onSubmit={buscarTexto}>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Buscar</label>
                        <input
                            value={buscar}
                            onChange={(e) => setBuscar(e.target.value)}
                            placeholder="ID, agencia o municipio"
                            className={inputClass}
                        />
                    </form>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Regional</label>
                        <select value={filtros.regional} onChange={(e) => filtrar({ regional: e.target.value })} className={inputClass}>
                            <option value="">TODAS</option>
                            {opciones.regionales.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Agencia</label>
                        <SelectBuscable
                            opciones={[{ valor: '', etiqueta: 'TODAS' }, ...opciones.agencias.map((a) => ({ valor: a.codigo, etiqueta: a.nombre }))]}
                            valor={filtros.agencia}
                            onChange={(v) => filtrar({ agencia: v })}
                            placeholder="TODAS"
                        />
                    </div>

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
                        <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
                        <select value={filtros.estado} onChange={(e) => filtrar({ estado: e.target.value })} className={inputClass}>
                            <option value="">TODOS</option>
                            {opciones.estados.map((e) => (
                                <option key={e.codigo} value={e.codigo}>
                                    {e.nombre}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-3 flex justify-end">
                    <button
                        type="button"
                        onClick={reportePresupuesto}
                        title="Descargar en Excel las actividades en PRESUPUESTO ASIGNADO (con los filtros actuales) y su presupuesto por elemento"
                        className={`${botonAccion} border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <path d="M7 10l5 5 5-5" />
                            <path d="M12 15V3" />
                        </svg>
                        Reporte presupuesto asignado
                    </button>
                </div>

                {/* Cambio de presupuesto en lote */}
                {seleccionables.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                        <span className="mr-auto text-xs text-slate-500">
                            {seleccion.length > 0 ? `${seleccion.length} actividad(es) seleccionada(s)` : 'Seleccione las actividades para asignar o autorizar su presupuesto.'}
                        </span>
                        {(Object.keys(ACCIONES) as AccionPresupuesto[])
                            .filter((accion) => can(ACCIONES[accion].permiso))
                            .map((accion) => (
                                <button
                                    key={accion}
                                    type="button"
                                    disabled={paraAccion(accion).length === 0}
                                    onClick={() => setConfirmando(accion)}
                                    className={`${botonAccion} ${
                                        accion === 'autorizar'
                                            ? 'border-green-200 bg-green-50 text-green-700 hover:border-green-300 hover:bg-green-100'
                                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
                                    } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-400 disabled:shadow-none`}
                                >
                                    {ACCIONES[accion].titulo} ({paraAccion(accion).length})
                                </button>
                            ))}
                    </div>
                )}

                {/* Tabla */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                {seleccionables.length > 0 && (
                                    <th className="w-8 py-2 pr-2">
                                        <input
                                            type="checkbox"
                                            checked={todasMarcadas}
                                            onChange={(e) => marcarTodas(e.target.checked)}
                                            title="Seleccionar todas las de esta página"
                                            className="h-4 w-4 accent-blue-600"
                                        />
                                    </th>
                                )}
                                <th className="py-2 pr-3 font-medium">ID</th>
                                <th className="py-2 pr-3 font-medium">Fecha</th>
                                <th className="py-2 pr-3 font-medium">Regional</th>
                                <th className="py-2 pr-3 font-medium">Agencia</th>
                                <th className="py-2 pr-3 font-medium">Municipio</th>
                                <th className="py-2 pr-3 font-medium">Tipo</th>
                                <th className="py-2 pr-3 font-medium">Responsable mercadeo</th>
                                <th className="py-2 pr-3 font-medium">Inicio</th>
                                <th className="py-2 pr-3 text-right font-medium whitespace-nowrap">Presupuesto</th>
                                <th className="py-2 pr-3 font-medium">Estado</th>
                                <th className="py-2 pr-3 font-medium">Creada por</th>
                                <th className="py-2 pr-3 font-medium">Fecha creación</th>
                                <th className="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {actividades.data.map((a) => {
                                const [fecha, diaSemana] = formatearFecha(a.fecha);
                                // "2026-10-09 14:30" -> ["09/10/2026", "14:30"]
                                const creadoEn = a.creadoEn ? [formatearFecha(a.creadoEn.slice(0, 10))[0], a.creadoEn.slice(11, 16)] : null;
                                const puedeEditar = a.editable && can('act_edit');
                                const seleccionable = seleccionables.includes(a);

                                return (
                                    <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                        {seleccionables.length > 0 && (
                                            <td className="py-3 pr-2">
                                                {seleccionable && (
                                                    <input
                                                        type="checkbox"
                                                        checked={seleccion.includes(a.id)}
                                                        onChange={(e) => marcar(a.id, e.target.checked)}
                                                        className="h-4 w-4 accent-blue-600"
                                                    />
                                                )}
                                            </td>
                                        )}
                                        <td className="py-3 pr-3 font-semibold text-slate-800">{a.id}</td>
                                        <td className="py-3 pr-3 whitespace-nowrap text-slate-700">
                                            {fecha}
                                            <span className="block text-xs text-slate-400 capitalize">{diaSemana}</span>
                                        </td>
                                        <td className="py-3 pr-3 text-slate-600">{a.regional}</td>
                                        <td className="py-3 pr-3 text-slate-700">{a.agencia}</td>
                                        <td className="py-3 pr-3 text-slate-600">{a.municipio}</td>
                                        <td className="py-3 pr-3 text-slate-600">{a.tipo}</td>
                                        <td className="py-3 pr-3 text-slate-600">{a.responsable}</td>
                                        <td className="py-3 pr-3 text-slate-600">{a.horaInicio ?? '—'}</td>
                                        <td className="py-3 pr-3 text-right whitespace-nowrap text-slate-700">{a.presupuesto > 0 ? pesos(a.presupuesto) : '—'}</td>
                                        <td className="py-3 pr-3">
                                            <EstadoActividad estado={a.estado} estados={opciones.estados} />
                                        </td>
                                        <td className="py-3 pr-3 text-slate-600">{a.creadoPor}</td>
                                        <td className="py-3 pr-3 whitespace-nowrap text-slate-600">
                                            {creadoEn ? (
                                                <>
                                                    {creadoEn[0]}
                                                    <span className="block text-xs text-slate-400">{creadoEn[1]}</span>
                                                </>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                        <td className="py-3 text-right">
                                            <Link
                                                href={url(`/actividades/${a.id}/editar`)}
                                                className={
                                                    puedeEditar
                                                        ? `${botonAccion} border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100`
                                                        : `${botonAccion} border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100`
                                                }
                                            >
                                                {puedeEditar ? (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                    </svg>
                                                ) : (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                                        <circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                )}
                                                {puedeEditar ? 'Editar' : 'Ver'}
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {actividades.data.length === 0 && (
                    <div className="flex flex-col items-center py-10 text-center">
                        <div className="mb-3 text-slate-300">
                            <IconoActividades tamano={40} />
                        </div>
                        <p className="text-sm text-slate-400">No hay actividades con estos filtros.</p>
                        {can('act_create') && (
                            <Link
                                href={url('/actividades/programacion/crear')}
                                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Nueva programación
                            </Link>
                        )}
                    </div>
                )}

                <Paginacion datos={actividades} />
            </div>

            <ModalConfirmar
                abierto={confirmando !== null}
                titulo={confirmando ? ACCIONES[confirmando].titulo : ''}
                textoConfirmar={confirmando ? ACCIONES[confirmando].confirmar : ''}
                procesando={procesando}
                onConfirmar={ejecutar}
                onCancelar={() => setConfirmando(null)}
            >
                {confirmando && (
                    <>
                        ¿Pasar <strong className="text-slate-800">{paraAccion(confirmando).length} actividad(es)</strong> a {ACCIONES[confirmando].destino} por un total
                        de <strong className="text-slate-800">{pesos(totalAccion(confirmando))}</strong>?
                        {confirmando === 'autorizar' && ' El presupuesto asignado queda como autorizado y el checklist ya no se podrá cambiar.'}
                    </>
                )}
            </ModalConfirmar>
        </AppLayout>
    );
}
