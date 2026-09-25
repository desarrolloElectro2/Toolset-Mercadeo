import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent, ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';

interface Props {
    usuario: {
        coduser: string;
        cedula: string;
        nombre: string;
        correo: string | null;
        telefono: string | null;
        nivel_mercadeo: number;
    };
    perfiles: { id: number; nombre: string }[];
}

const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500';

function Campo({ etiqueta, obligatorio, error, children }: { etiqueta: string; obligatorio?: boolean; error?: string; children: ReactNode }) {
    return (
        <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {etiqueta} {obligatorio && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}

export default function Edit({ usuario, perfiles }: Props) {
    const { auth } = usePage().props;
    const esElMismo = auth.user?.coduser === usuario.coduser;

    const { data, setData, put, processing, errors } = useForm({
        cedula: usuario.cedula,
        nombre: usuario.nombre,
        correo: usuario.correo ?? '',
        telefono: usuario.telefono ?? '',
        contrasena: '',
        nivel_mercadeo: usuario.nivel_mercadeo,
    });

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        put(`/configuracion/usuarios/${encodeURIComponent(usuario.coduser)}`);
    };

    return (
        <AppLayout titulo="Configuración › Usuarios › Actualizar usuario" icono="👥">
            <Head title={`Editar ${usuario.coduser}`} />

            <form onSubmit={guardar} className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Campo etiqueta="Usuario" obligatorio>
                        <input value={usuario.coduser} disabled className={inputClass} />
                    </Campo>

                    <Campo etiqueta="Cédula" obligatorio error={errors.cedula}>
                        <input value={data.cedula} onChange={(e) => setData('cedula', e.target.value)} maxLength={15} className={inputClass} />
                    </Campo>

                    <Campo etiqueta="Nombre" obligatorio error={errors.nombre}>
                        <input value={data.nombre} onChange={(e) => setData('nombre', e.target.value)} maxLength={50} className={inputClass} />
                    </Campo>

                    <Campo etiqueta="Correo" error={errors.correo}>
                        <input type="email" value={data.correo} onChange={(e) => setData('correo', e.target.value)} maxLength={50} className={inputClass} />
                    </Campo>

                    <Campo etiqueta="Teléfono" error={errors.telefono}>
                        <input value={data.telefono} onChange={(e) => setData('telefono', e.target.value)} maxLength={30} className={inputClass} />
                    </Campo>

                    <Campo etiqueta="Contraseña" error={errors.contrasena}>
                        <input
                            type="password"
                            value={data.contrasena}
                            onChange={(e) => setData('contrasena', e.target.value)}
                            placeholder="Dejar vacía para no cambiarla"
                            autoComplete="new-password"
                            className={inputClass}
                        />
                    </Campo>

                    <Campo etiqueta="Perfil Mercadeo" obligatorio error={errors.nivel_mercadeo}>
                        <select
                            value={data.nivel_mercadeo}
                            onChange={(e) => setData('nivel_mercadeo', Number(e.target.value))}
                            disabled={esElMismo}
                            title={esElMismo ? 'No puedes cambiar tu propio perfil' : undefined}
                            className={inputClass}
                        >
                            <option value={0}>INACTIVO</option>
                            {perfiles.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre}
                                </option>
                            ))}
                        </select>
                    </Campo>
                </div>

                <p className="mt-4 text-xs text-slate-400">
                    Los datos del usuario son compartidos con los demás sistemas Toolset; los cambios de cédula, nombre, correo, teléfono o
                    contraseña se verán en todos.
                </p>

                <div className="mt-6 flex gap-2">
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {processing ? 'Actualizando…' : 'Actualizar'}
                    </button>
                    <Link
                        href="/configuracion/usuarios"
                        className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                    >
                        Regresar
                    </Link>
                </div>
            </form>
        </AppLayout>
    );
}
