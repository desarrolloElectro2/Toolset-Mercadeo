import { Link } from '@inertiajs/react';
import { useCan } from '@/hooks/useCan';
import { ModuloMenu, puedeVer } from '@/modulos';

/** Cuadrícula de tarjetas azules (Principal y páginas de módulos con submódulos). */
export default function TarjetasModulos({ modulos }: { modulos: ModuloMenu[] }) {
    const can = useCan();
    const tarjetas = modulos.filter((m) => m.iconoTarjeta && puedeVer(m, can));

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
            {tarjetas.length === 0 ? (
                <p className="text-center text-sm text-slate-400">Tu perfil todavía no tiene módulos asignados.</p>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                    {tarjetas.map((tarjeta) => (
                        <Link
                            key={tarjeta.href}
                            href={tarjeta.href}
                            className="flex items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 p-5 text-left transition-all duration-150 hover:border-blue-300 hover:bg-blue-100"
                        >
                            <div className="shrink-0">{tarjeta.iconoTarjeta}</div>
                            <span className="text-base font-semibold text-blue-600">{tarjeta.label}</span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
