import { Link } from '@inertiajs/react';
import { Paginado } from '@/types';

/** Paginación para cualquier tabla que reciba un ->paginate() de Laravel. */
export default function Paginacion({ datos }: { datos: Paginado<unknown> }) {
    if (datos.last_page <= 1) return null;

    const ultimo = datos.links.length - 1;

    return (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-500">
                Mostrando {datos.from}–{datos.to} de {datos.total}
            </span>

            <div className="flex gap-1">
                {datos.links.map((link, i) => {
                    // El primero y el último son "anterior" y "siguiente"
                    const texto = i === 0 ? '«' : i === ultimo ? '»' : link.label;

                    return link.url ? (
                        <Link
                            key={i}
                            href={link.url}
                            preserveScroll
                            className={`rounded px-3 py-1 ${
                                link.active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {texto}
                        </Link>
                    ) : (
                        <span key={i} className="px-3 py-1 text-slate-300">
                            {texto}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
