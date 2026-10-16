import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import { IconoEstadosActividad } from '@/components/Iconos';
import Modal from '@/components/Modal';
import ModalConfirmar from '@/components/ModalConfirmar';
import Paginacion from '@/components/Paginacion';
import AppLayout from '@/layouts/AppLayout';
import { COLORES_ESTADO, colorEstado } from '@/lib/coloresEstado';
import { url } from '@/lib/url';
import { Paginado } from '@/types';

interface EstadoFila {
    id: number;
    codigo: string;
    nombre: string;
    color: string;
    orden: number;
    inicial: boolean;
    totalActividades: number;
}

interface Props {
    estados: Paginado<EstadoFila>;
    filtros: { buscar: string };
    colores: string[];
}

interface FormEstado {
    nombre: string;
    color: string;
    orden: string;
}

const VACIO: FormEstado = { nombre: '', color: 'azul', orden: '' };

const botonAccion =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2';

export default function Index({ estados, filtros, colores }: Props) {
    const [buscar, setBuscar] = useState(filtros.buscar);

    // Modal de crear/editar: null = cerrado, 'nuevo' = crear, EstadoFila = editar
    const [enFormulario, setEnFormulario] = useState<EstadoFila | 'nuevo' | null>(null);
    const { data, setData, post, put, processing, errors, clearErrors } = useForm<FormEstado>(VACIO);

    const [porEliminar, setPorEliminar] = useState<EstadoFila | null>(null);
    const [eliminando, setEliminando] = useState(false);

    const buscarEstados = (e: FormEvent) => {
        e.preventDefault();
        router.get(url('/configuracion/estados-actividad'), buscar ? { buscar } : {}, { preserveState: true, replace: true });
    };

    const abrirFormulario = (estado: EstadoFila | 'nuevo') => {
        clearErrors();
        setData(
            estado === 'nuevo'
                ? { ...VACIO, orden: String(Math.max(0, ...estados.data.map((e) => e.orden)) + 1) }
                : { nombre: estado.nombre, color: estado.color, orden: String(estado.orden) },
        );
        setEnFormulario(estado);
    };

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        const opciones = { preserveScroll: true, onSuccess: () => setEnFormulario(null) };

        if (enFormulario === 'nuevo') {
            post(url('/configuracion/estados-actividad'), opciones);
        } else if (enFormulario) {
            put(url(`/configuracion/estados-actividad/${enFormulario.id}`), opciones);
        }
    };

    const confirmarEliminar = () => {
        if (!porEliminar) return;

        router.delete(url(`/configuracion/estados-actividad/${porEliminar.id}`), {
            preserveScroll: true,
            onStart: () => setEliminando(true),
            onFinish: () => {
                setEliminando(false);
                setPorEliminar(null);
            },
        });
    };

    return (
        <AppLayout titulo="Configuración › Estados actividad" icono={<IconoEstadosActividad />}>
            <Head title="Estados actividad" />

            <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <form onSubmit={buscarEstados} className="flex gap-2">
                        <input
                            value={buscar}
                            onChange={(e) => setBuscar(e.target.value)}
                            placeholder="Buscar estado..."
                            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Buscar</button>
                    </form>

                    <button
                        type="button"
                        onClick={() => abrirFormulario('nuevo')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Nuevo estado
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                <th className="py-2 pr-3 font-medium">Orden</th>
                                <th className="py-2 pr-3 font-medium">Estado</th>
                                <th className="py-2 pr-3 font-medium">Actividades</th>
                                <th className="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {estados.data.map((estado) => {
                                const bloqueado = estado.totalActividades > 0 || estado.inicial;

                                return (
                                    <tr key={estado.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                        <td className="py-3 pr-3 text-slate-600">{estado.orden}</td>
                                        <td className="py-3 pr-3">
                                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colorEstado(estado.color).clase}`}>
                                                {estado.nombre}
                                            </span>
                                            <p className="mt-1 text-[11px] text-slate-400">{estado.codigo}</p>
                                        </td>
                                        <td className="py-3 pr-3 text-slate-600">{estado.totalActividades}</td>
                                        <td className="py-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => abrirFormulario(estado)}
                                                    className={`${botonAccion} border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 focus-visible:ring-blue-300`}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                    </svg>
                                                    Editar
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setPorEliminar(estado)}
                                                    disabled={bloqueado}
                                                    title={
                                                        estado.inicial
                                                            ? 'No se puede eliminar: es el estado inicial de las actividades.'
                                                            : estado.totalActividades > 0
                                                              ? `No se puede eliminar: lo usan ${estado.totalActividades} actividad(es).`
                                                              : 'Eliminar estado'
                                                    }
                                                    className={`${botonAccion} border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none`}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 6h18" />
                                                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                        <line x1="10" y1="11" x2="10" y2="17" />
                                                        <line x1="14" y1="11" x2="14" y2="17" />
                                                    </svg>
                                                    Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {estados.data.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No se encontraron estados.</p>}

                <Paginacion datos={estados} />
            </div>

            {/* Crear / editar */}
            <Modal
                abierto={enFormulario !== null}
                titulo={enFormulario === 'nuevo' ? 'Nuevo estado de actividad' : 'Editar estado de actividad'}
                onCerrar={() => setEnFormulario(null)}
                bloqueado={processing}
            >
                <form onSubmit={guardar} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
                        <Campo etiqueta="Nombre" obligatorio error={errors.nombre}>
                            <input
                                value={data.nombre}
                                onChange={(e) => setData('nombre', e.target.value.toUpperCase())}
                                maxLength={100}
                                autoFocus
                                className={inputClass}
                            />
                        </Campo>
                        <Campo etiqueta="Orden" obligatorio error={errors.orden}>
                            <input type="number" min={0} max={999} value={data.orden} onChange={(e) => setData('orden', e.target.value)} className={inputClass} />
                        </Campo>
                    </div>

                    <Campo etiqueta="Color" obligatorio error={errors.color}>
                        <div className="flex items-center gap-2">
                            <select value={data.color} onChange={(e) => setData('color', e.target.value)} className={inputClass}>
                                {colores.map((c) => (
                                    <option key={c} value={c}>
                                        {COLORES_ESTADO[c]?.etiqueta ?? c}
                                    </option>
                                ))}
                            </select>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorEstado(data.color).clase}`}>
                                {data.nombre || 'VISTA'}
                            </span>
                        </div>
                    </Campo>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setEnFormulario(null)}
                            disabled={processing}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {processing ? 'Guardando…' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ModalConfirmar
                abierto={porEliminar !== null}
                titulo="Eliminar estado de actividad"
                procesando={eliminando}
                onConfirmar={confirmarEliminar}
                onCancelar={() => setPorEliminar(null)}
            >
                ¿Seguro que desea eliminar el estado <strong className="text-slate-800">{porEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
            </ModalConfirmar>
        </AppLayout>
    );
}
