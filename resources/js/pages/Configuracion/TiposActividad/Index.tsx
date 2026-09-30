import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import { IconoTiposActividad } from '@/components/Iconos';
import Modal from '@/components/Modal';
import ModalConfirmar from '@/components/ModalConfirmar';
import Paginacion from '@/components/Paginacion';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';
import { Paginado } from '@/types';

interface TipoFila {
    id: number;
    nombre: string;
    activo: boolean;
    totalActividades: number;
}

interface Props {
    tipos: Paginado<TipoFila>;
    filtros: { buscar: string };
}

const botonAccion =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2';

export default function Index({ tipos, filtros }: Props) {
    const [buscar, setBuscar] = useState(filtros.buscar);

    // Modal de crear/editar: null = cerrado, 'nuevo' = crear, TipoFila = editar
    const [enFormulario, setEnFormulario] = useState<TipoFila | 'nuevo' | null>(null);
    const { data, setData, post, put, processing, errors, clearErrors } = useForm({ nombre: '', activo: true });

    const [porEliminar, setPorEliminar] = useState<TipoFila | null>(null);
    const [eliminando, setEliminando] = useState(false);

    const buscarTipos = (e: FormEvent) => {
        e.preventDefault();
        router.get(url('/configuracion/tipos-actividad'), buscar ? { buscar } : {}, { preserveState: true, replace: true });
    };

    const abrirFormulario = (tipo: TipoFila | 'nuevo') => {
        clearErrors();
        setData(tipo === 'nuevo' ? { nombre: '', activo: true } : { nombre: tipo.nombre, activo: tipo.activo });
        setEnFormulario(tipo);
    };

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        const opciones = { preserveScroll: true, onSuccess: () => setEnFormulario(null) };

        if (enFormulario === 'nuevo') {
            post(url('/configuracion/tipos-actividad'), opciones);
        } else if (enFormulario) {
            put(url(`/configuracion/tipos-actividad/${enFormulario.id}`), opciones);
        }
    };

    const confirmarEliminar = () => {
        if (!porEliminar) return;

        router.delete(url(`/configuracion/tipos-actividad/${porEliminar.id}`), {
            preserveScroll: true,
            onStart: () => setEliminando(true),
            onFinish: () => {
                setEliminando(false);
                setPorEliminar(null);
            },
        });
    };

    return (
        <AppLayout titulo="Configuración › Tipos actividad" icono={<IconoTiposActividad />}>
            <Head title="Tipos actividad" />

            <div className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <form onSubmit={buscarTipos} className="flex gap-2">
                        <input
                            value={buscar}
                            onChange={(e) => setBuscar(e.target.value)}
                            placeholder="Buscar tipo de actividad..."
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
                        Nuevo tipo
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                <th className="py-2 font-medium">Tipo de actividad</th>
                                <th className="py-2 font-medium">Estado</th>
                                <th className="py-2 font-medium">Actividades</th>
                                <th className="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {tipos.data.map((tipo) => {
                                const enUso = tipo.totalActividades > 0;

                                return (
                                    <tr key={tipo.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                        <td className="py-3 font-medium text-slate-800">{tipo.nombre}</td>
                                        <td className="py-3">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    tipo.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                {tipo.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="py-3 text-slate-600">{tipo.totalActividades}</td>
                                        <td className="py-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => abrirFormulario(tipo)}
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
                                                    onClick={() => setPorEliminar(tipo)}
                                                    disabled={enUso}
                                                    title={
                                                        enUso
                                                            ? `No se puede eliminar: lo usan ${tipo.totalActividades} actividad(es). Puede inactivarlo.`
                                                            : 'Eliminar tipo de actividad'
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

                {tipos.data.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No se encontraron tipos de actividad.</p>}

                <Paginacion datos={tipos} />
            </div>

            {/* Crear / editar */}
            <Modal
                abierto={enFormulario !== null}
                titulo={enFormulario === 'nuevo' ? 'Nuevo tipo de actividad' : 'Editar tipo de actividad'}
                onCerrar={() => setEnFormulario(null)}
                bloqueado={processing}
            >
                <form onSubmit={guardar} className="space-y-4">
                    <Campo etiqueta="Nombre" obligatorio error={errors.nombre}>
                        <input
                            value={data.nombre}
                            onChange={(e) => setData('nombre', e.target.value.toUpperCase())}
                            maxLength={100}
                            autoFocus
                            className={inputClass}
                        />
                    </Campo>

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={data.activo}
                            onChange={(e) => setData('activo', e.target.checked)}
                            className="h-4 w-4 accent-blue-600"
                        />
                        Activo <span className="text-xs text-slate-400">(los inactivos no aparecen al programar actividades)</span>
                    </label>

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
                titulo="Eliminar tipo de actividad"
                procesando={eliminando}
                onConfirmar={confirmarEliminar}
                onCancelar={() => setPorEliminar(null)}
            >
                ¿Seguro que desea eliminar el tipo <strong className="text-slate-800">{porEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
            </ModalConfirmar>
        </AppLayout>
    );
}
