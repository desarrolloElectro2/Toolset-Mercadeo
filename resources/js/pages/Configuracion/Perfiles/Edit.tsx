import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { IconoPerfiles } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';

interface Permiso {
    id: number;
    codigo: string;
    nombre: string;
}

interface Modulo {
    id: number;
    nombre: string;
    permisos: Permiso[];
}

interface Props {
    rol: { id: number; nombre: string; permisos: string[] };
    modulos: Modulo[];
}

export default function Edit({ rol, modulos }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        nombre: rol.nombre,
        permisos: rol.permisos,
    });
    const [moduloAbierto, setModuloAbierto] = useState<number | null>(modulos[0]?.id ?? null);

    const modulo = modulos.find((m) => m.id === moduloAbierto);
    const marcado = (codigo: string) => data.permisos.includes(codigo);
    const marcadosEn = (m: Modulo) => m.permisos.filter((p) => marcado(p.codigo)).length;

    const alternar = (codigo: string) => {
        setData('permisos', marcado(codigo) ? data.permisos.filter((c) => c !== codigo) : [...data.permisos, codigo]);
    };

    // Marca o desmarca todos los permisos de un módulo
    const alternarModulo = (m: Modulo) => {
        const codigos = m.permisos.map((p) => p.codigo);
        const todos = codigos.every(marcado);

        setData('permisos', todos ? data.permisos.filter((c) => !codigos.includes(c)) : [...new Set([...data.permisos, ...codigos])]);
    };

    const guardar = (e: FormEvent) => {
        e.preventDefault();
        put(url(`/configuracion/perfiles/${rol.id}`));
    };

    return (
        <AppLayout titulo="Configuración › Perfiles › Actualizar perfil" icono={<IconoPerfiles />}>
            <Head title={`Editar ${rol.nombre}`} />

            <form onSubmit={guardar} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
                {/* Nombre del perfil */}
                <div>
                    <label htmlFor="nombre" className="mb-1.5 block text-xs font-medium text-slate-500">
                        Perfil
                    </label>
                    <input
                        id="nombre"
                        value={data.nombre}
                        onChange={(e) => setData('nombre', e.target.value.toUpperCase())}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                    />
                    {errors.nombre && <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>}
                </div>

                {/* Módulos */}
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white">Módulos</div>

                    <div className="flex flex-wrap gap-2 p-4">
                        {modulos.map((m) => {
                            const activo = m.id === moduloAbierto;
                            const cantidad = marcadosEn(m);

                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setModuloAbierto(activo ? null : m.id)}
                                    aria-expanded={activo}
                                    className={`flex items-center gap-2 rounded-md px-5 py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                                        activo ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {m.nombre}
                                    {cantidad > 0 && (
                                        <span
                                            className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                                                activo ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                                            }`}
                                        >
                                            {cantidad}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Permisos del módulo seleccionado */}
                    {modulo && (
                        <div className="border-t border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-slate-700">Permisos de {modulo.nombre}</h3>
                                {modulo.permisos.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => alternarModulo(modulo)}
                                        className="text-xs font-medium text-blue-600 hover:underline"
                                    >
                                        {modulo.permisos.every((p) => marcado(p.codigo)) ? 'Quitar todos' : 'Marcar todos'}
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
                                {modulo.permisos.map((permiso) => (
                                    <label
                                        key={permiso.id}
                                        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-300"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={marcado(permiso.codigo)}
                                            onChange={() => alternar(permiso.codigo)}
                                            className="h-4 w-4 accent-blue-600"
                                        />
                                        {permiso.nombre}
                                    </label>
                                ))}
                            </div>

                            {modulo.permisos.length === 0 && <p className="text-sm text-slate-400">Este módulo no tiene permisos.</p>}
                        </div>
                    )}
                </div>

                {errors.permisos && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors.permisos}</p>
                )}

                <div className="flex justify-end gap-2">
                    <Link
                        href={url('/configuracion/perfiles')}
                        className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                    >
                        Cancelar
                    </Link>
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {processing ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </form>
        </AppLayout>
    );
}
