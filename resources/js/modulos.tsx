import { ReactNode } from 'react';
import { IconoActividades, IconoConfiguracion, IconoPerfiles, IconoPrincipal, IconoUsuarios } from '@/components/Iconos';

export interface ModuloMenu {
    label: string;
    href: string;
    /** Ícono de línea (monocromático) del menú lateral y del título de la página */
    icono: ReactNode;
    /** Ícono grande de la tarjeta (si no tiene, no aparece como tarjeta) */
    iconoTarjeta?: ReactNode;
    /** Código de la tabla permisos que da acceso; sin permiso = visible para todos */
    permiso?: string;
    /** Un módulo con submódulos es visible si el usuario puede ver al menos uno de ellos */
    submodulos?: ModuloMenu[];
}

const iconoUsuarios = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <circle cx="15" cy="13" r="5" fill="#3b82f6" opacity="0.8" />
        <circle cx="25" cy="13" r="5" fill="#3b82f6" opacity="0.6" />
        <path d="M5 32c0-6 4-10 10-10h10c6 0 10 4 10 10" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
);

const iconoPerfiles = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="10" y="18" width="20" height="15" rx="2" fill="#3b82f6" opacity="0.6" />
        <path d="M14 18v-4a6 6 0 0 1 12 0v4" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="20" cy="25.5" r="2.5" fill="#3b82f6" />
    </svg>
);

const iconoConfiguracion = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <circle cx="20" cy="20" r="5" fill="#3b82f6" opacity="0.8" />
        <path
            d="M20 8v4M20 28v4M8 20h4M28 20h4M11.5 11.5l2.8 2.8M25.7 25.7l2.8 2.8M11.5 28.5l2.8-2.8M25.7 14.3l2.8-2.8"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
        />
    </svg>
);

const iconoActividades = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="7" y="10" width="26" height="23" rx="3" fill="#3b82f6" opacity="0.5" />
        <path d="M13 7v6M27 7v6M7 17h26" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M14 25l3.5 3.5L26 21" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Registro único de módulos: menú lateral y tarjetas salen de aquí.
// Para agregar un módulo (o submódulo) nuevo basta con añadirlo a esta lista.
export const modulos: ModuloMenu[] = [
    { label: 'Principal', href: '/', icono: <IconoPrincipal /> },
    { label: 'Actividades', href: '/actividades', icono: <IconoActividades />, permiso: 'act_list', iconoTarjeta: iconoActividades },
    {
        label: 'Configuración',
        href: '/configuracion',
        icono: <IconoConfiguracion />,
        iconoTarjeta: iconoConfiguracion,
        submodulos: [
            { label: 'Usuarios', href: '/configuracion/usuarios', icono: <IconoUsuarios />, permiso: 'usu_list', iconoTarjeta: iconoUsuarios },
            { label: 'Perfiles', href: '/configuracion/perfiles', icono: <IconoPerfiles />, permiso: 'rol_list', iconoTarjeta: iconoPerfiles },
        ],
    },
];

export function puedeVer(modulo: ModuloMenu, can: (codigo: string) => boolean): boolean {
    if (modulo.submodulos) {
        return modulo.submodulos.some((sub) => puedeVer(sub, can));
    }

    return !modulo.permiso || can(modulo.permiso);
}

export function buscarModulo(href: string): ModuloMenu | undefined {
    for (const modulo of modulos) {
        if (modulo.href === href) return modulo;
        const sub = modulo.submodulos?.find((s) => s.href === href);
        if (sub) return sub;
    }

    return undefined;
}
