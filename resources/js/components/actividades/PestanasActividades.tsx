import { Link, usePage } from '@inertiajs/react';
import { useCan } from '@/hooks/useCan';
import { rutaSinBase, url } from '@/lib/url';

const pestanas = [
    { label: 'Programación', href: '/actividades/programacion/crear', permiso: 'act_create' },
    { label: 'Lista actividades', href: '/actividades', permiso: 'act_list' },
    { label: 'Calendario', href: '/actividades/calendario', permiso: 'act_list' },
];

/** Pestañas del módulo Actividades (Programación / Lista / Calendario). */
export default function PestanasActividades() {
    const can = useCan();
    const ruta = rutaSinBase(usePage().url);

    return (
        <nav className="mb-4 flex flex-wrap gap-2">
            {pestanas
                .filter((p) => can(p.permiso))
                .map((p) => (
                    <Link
                        key={p.href}
                        href={url(p.href)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                            ruta === p.href
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
                        }`}
                    >
                        {p.label}
                    </Link>
                ))}
        </nav>
    );
}
