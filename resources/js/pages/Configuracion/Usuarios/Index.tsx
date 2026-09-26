import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import Paginacion from '@/components/Paginacion';
import { useCan } from '@/hooks/useCan';
import { IconoUsuarios } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';
import { Paginado } from '@/types';

interface UsuarioFila {
    coduser: string;
    cedula: string;
    nombre: string;
    correo: string | null;
    activo: boolean;
    perfil: string | null;
}

interface Props {
    usuarios: Paginado<UsuarioFila>;
    filtros: { buscar: string; perfil: string };
}

export default function Index({ usuarios, filtros }: Props) {
    const can = useCan();
    const [buscar, setBuscar] = useState(filtros.buscar);
    const [perfil, setPerfil] = useState(filtros.perfil);

    const filtrar = (e?: FormEvent, nuevoPerfil = perfil) => {
        e?.preventDefault();
        const params: Record<string, string> = {};
        if (buscar) params.buscar = buscar;
        if (nuevoPerfil) params.perfil = nuevoPerfil;
        router.get('/configuracion/usuarios', params, { preserveState: true, replace: true });
    };

    return (
        <AppLayout titulo="Configuración › Usuarios" icono={<IconoUsuarios />}>
            <Head title="Usuarios" />

            <div className="rounded-lg border border-slate-200 bg-white p-6">
                <form onSubmit={filtrar} className="mb-4 flex flex-wrap gap-2">
                    <input
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        placeholder="Buscar por usuario, cédula o nombre..."
                        className="w-80 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <select
                        value={perfil}
                        onChange={(e) => {
                            setPerfil(e.target.value);
                            filtrar(undefined, e.target.value);
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                        <option value="">Todos los usuarios</option>
                        <option value="con">Con perfil de mercadeo</option>
                        <option value="sin">Sin perfil de mercadeo</option>
                    </select>
                    <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                        Buscar
                    </button>
                </form>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-slate-500">
                                <th className="py-2 font-medium">Usuario</th>
                                <th className="py-2 font-medium">Cédula</th>
                                <th className="py-2 font-medium">Nombre</th>
                                <th className="py-2 font-medium">Correo</th>
                                <th className="py-2 font-medium">Estado</th>
                                <th className="py-2 font-medium">Perfil mercadeo</th>
                                <th className="py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.data.map((u) => (
                                <tr key={u.coduser} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                    <td className="py-3 font-medium text-slate-800">{u.coduser}</td>
                                    <td className="py-3 text-slate-600">{u.cedula}</td>
                                    <td className="py-3 text-slate-700">{u.nombre}</td>
                                    <td className="py-3 text-slate-600">{u.correo || '—'}</td>
                                    <td className="py-3">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                u.activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            {u.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {u.perfil ? (
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{u.perfil}</span>
                                        ) : (
                                            <span className="text-xs text-slate-400">Sin acceso</span>
                                        )}
                                    </td>
                                    <td className="py-3 text-right">
                                        {can('usu_edit') && (
                                            <Link
                                                href={`/configuracion/usuarios/${encodeURIComponent(u.coduser)}/edit`}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-all duration-150 hover:border-blue-300 hover:bg-blue-100"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 20h9" />
                                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                                </svg>
                                                Editar
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {usuarios.data.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No se encontraron usuarios.</p>}

                <Paginacion datos={usuarios} />
            </div>
        </AppLayout>
    );
}
