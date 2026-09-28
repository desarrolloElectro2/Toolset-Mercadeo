import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import ModalConfirmar from '@/components/ModalConfirmar';
import Paginacion from '@/components/Paginacion';
import { useCan } from '@/hooks/useCan';
import { IconoPerfiles } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';
import { Paginado } from '@/types';
import { url } from '@/lib/url';

interface PerfilFila {
    id: number;
    nombre: string;
    totalPermisos: number;
    totalUsuarios: number;
    updatedAt: string | null;
}

interface Props {
    roles: Paginado<PerfilFila>;
    filtros: { buscar: string };
}

const botonAccion =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2';

export default function Index({ roles, filtros }: Props) {
    const can = useCan();
    const [buscar, setBuscar] = useState(filtros.buscar);
    const [porEliminar, setPorEliminar] = useState<PerfilFila | null>(null);
    const [eliminando, setEliminando] = useState(false);

    const buscarPerfiles = (e: FormEvent) => {
        e.preventDefault();
        router.get(url('/configuracion/perfiles'), buscar ? { buscar } : {}, { preserveState: true, replace: true });
    };

    const confirmarEliminar = () => {
        if (!porEliminar) return;

        router.delete(url(`/configuracion/perfiles/${porEliminar.id}`), {
            preserveScroll: true,
            onStart: () => setEliminando(true),
            onFinish: () => {
                setEliminando(false);
                setPorEliminar(null);
            },
        });
    };

    return (
        <AppLayout titulo="Configuración › Perfiles" icono={<IconoPerfiles />}>
            <Head title="Perfiles" />

            <div className="rounded-lg border border-slate-200 bg-white p-6">
                <form onSubmit={buscarPerfiles} className="mb-4 flex gap-2">
                    <input
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        placeholder="Buscar perfil..."
                        className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                        Buscar
                    </button>
                </form>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                <th className="py-2 font-medium">Perfil</th>
                                <th className="py-2 font-medium">Permisos</th>
                                <th className="py-2 font-medium">Usuarios</th>
                                <th className="py-2 font-medium">Última actualización</th>
                                <th className="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.data.map((rol) => {
                                const conUsuarios = rol.totalUsuarios > 0;

                                return (
                                    <tr key={rol.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                        <td className="py-3 font-medium text-slate-800">{rol.nombre}</td>
                                        <td className="py-3 text-slate-600">{rol.totalPermisos}</td>
                                        <td className="py-3 text-slate-600">{rol.totalUsuarios}</td>
                                        <td className="py-3 text-slate-600">{rol.updatedAt ?? '—'}</td>
                                        <td className="py-3">
                                            <div className="flex justify-end gap-2">
                                                {can('rol_edit') && (
                                                    <Link
                                                        href={url(`/configuracion/perfiles/${rol.id}/edit`)}
                                                        className={`${botonAccion} border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 focus-visible:ring-blue-300`}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 20h9" />
                                                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                        </svg>
                                                        Editar
                                                    </Link>
                                                )}

                                                {can('rol_delete') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPorEliminar(rol)}
                                                        disabled={conUsuarios}
                                                        title={
                                                            conUsuarios
                                                                ? `No se puede eliminar: tiene ${rol.totalUsuarios} usuario(s) asignado(s)`
                                                                : 'Eliminar perfil'
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
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {roles.data.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No se encontraron perfiles.</p>}

                <Paginacion datos={roles} />
            </div>

            <ModalConfirmar
                abierto={porEliminar !== null}
                titulo="Eliminar perfil"
                procesando={eliminando}
                onConfirmar={confirmarEliminar}
                onCancelar={() => setPorEliminar(null)}
            >
                ¿Seguro que desea eliminar el perfil <strong className="text-slate-800">{porEliminar?.nombre}</strong>? Esta acción no se puede
                deshacer.
            </ModalConfirmar>
        </AppLayout>
    );
}
