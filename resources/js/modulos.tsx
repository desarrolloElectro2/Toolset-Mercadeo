import { ReactNode } from 'react';
import {
    IconoActividades,
    IconoConfiguracion,
    IconoEstadosActividad,
    IconoPerfiles,
    IconoPrincipal,
    IconoPromotoria,
    IconoReporteActividades,
    IconoReportes,
    IconoTiposActividad,
    IconoUsuarios,
} from '@/components/Iconos';

export interface ModuloMenu {
    label: string;
    href: string;
    /** Ícono de línea (monocromático) del menú lateral y del título de la página */
    icono: ReactNode;
    /** Ícono grande de la tarjeta (si no tiene, no aparece como tarjeta) */
    iconoTarjeta?: ReactNode;
    /**
     * Código(s) de la tabla permisos que dan acceso (si son varios, se exigen todos); sin permiso = visible para todos.
     * En un módulo con submódulos se exige además el permiso de al menos un submódulo.
     */
    permiso?: string | string[];
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

const iconoTiposActividad = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <path d="M21 5H9a4 4 0 0 0-4 4v12l15 15a3 3 0 0 0 4.2 0L35.2 25a3 3 0 0 0 0-4.2z" fill="#3b82f6" opacity="0.5" />
        <circle cx="13" cy="13" r="3" fill="#3b82f6" />
    </svg>
);

const iconoEstadosActividad = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="16" y="7" width="19" height="6" rx="3" fill="#3b82f6" opacity="0.5" />
        <rect x="16" y="17" width="19" height="6" rx="3" fill="#3b82f6" opacity="0.5" />
        <rect x="16" y="27" width="19" height="6" rx="3" fill="#3b82f6" opacity="0.5" />
        <circle cx="8" cy="10" r="3" fill="#3b82f6" />
        <circle cx="8" cy="30" r="3" fill="#3b82f6" />
        <path d="M8 13v14" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

const iconoReportes = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <rect x="9" y="20" width="6" height="12" rx="1.5" fill="#3b82f6" opacity="0.5" />
        <rect x="18" y="10" width="6" height="22" rx="1.5" fill="#3b82f6" opacity="0.5" />
        <rect x="27" y="15" width="6" height="17" rx="1.5" fill="#3b82f6" opacity="0.5" />
        <path d="M6 6v29h29" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const iconoReporteActividades = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <path d="M24 4H11a3 3 0 0 0-3 3v26a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3V12z" fill="#3b82f6" opacity="0.5" />
        <path d="M14 30v-4M20 30v-8M26 30v-11" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

const iconoPromotoria = (
    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
        <path d="M20 4c-6.6 0-12 5.2-12 11.7C8 24.5 20 36 20 36s12-11.5 12-20.3C32 9.2 26.6 4 20 4z" fill="#3b82f6" opacity="0.5" />
        <circle cx="20" cy="15.5" r="4.5" fill="#3b82f6" />
    </svg>
);

// Registro único de módulos: menú lateral y tarjetas salen de aquí.
// Para agregar un módulo (o submódulo) nuevo basta con añadirlo a esta lista.
export const modulos: ModuloMenu[] = [
    { label: 'Principal', href: '/', icono: <IconoPrincipal /> },
    { label: 'Actividades', href: '/actividades', icono: <IconoActividades />, permiso: 'act_list', iconoTarjeta: iconoActividades },
    {
        label: 'Promotoría',
        href: '/promotoria',
        icono: <IconoPromotoria />,
        permiso: ['acc_promotoria', 'vis_show'], // entrar al módulo y ver las visitas
        iconoTarjeta: iconoPromotoria,
    },
    {
        label: 'Reportes',
        href: '/reportes',
        icono: <IconoReportes />,
        permiso: 'acc_reportes', // entrar al módulo; cada reporte pide además el suyo
        iconoTarjeta: iconoReportes,
        submodulos: [
            {
                label: 'Actividades',
                href: '/reportes/actividades',
                icono: <IconoReporteActividades />,
                permiso: 'rep_actividades',
                iconoTarjeta: iconoReporteActividades,
            },
        ],
    },
    {
        label: 'Configuración',
        href: '/configuracion',
        icono: <IconoConfiguracion />,
        iconoTarjeta: iconoConfiguracion,
        submodulos: [
            { label: 'Usuarios', href: '/configuracion/usuarios', icono: <IconoUsuarios />, permiso: 'usu_list', iconoTarjeta: iconoUsuarios },
            { label: 'Perfiles', href: '/configuracion/perfiles', icono: <IconoPerfiles />, permiso: 'rol_list', iconoTarjeta: iconoPerfiles },
            {
                label: 'Tipos actividad',
                href: '/configuracion/tipos-actividad',
                icono: <IconoTiposActividad />,
                permiso: 'tip_actividad',
                iconoTarjeta: iconoTiposActividad,
            },
            {
                label: 'Estados actividad',
                href: '/configuracion/estados-actividad',
                icono: <IconoEstadosActividad />,
                permiso: 'est_actividad',
                iconoTarjeta: iconoEstadosActividad,
            },
        ],
    },
];

export function puedeVer(modulo: ModuloMenu, can: (codigo: string) => boolean): boolean {
    // Un módulo con permiso propio (ej. Reportes: acc_reportes) exige ese permiso además del de algún submódulo
    const permisos = modulo.permiso === undefined ? [] : ([] as string[]).concat(modulo.permiso);
    if (!permisos.every((p) => can(p))) {
        return false;
    }

    return modulo.submodulos ? modulo.submodulos.some((sub) => puedeVer(sub, can)) : true;
}

export function buscarModulo(href: string): ModuloMenu | undefined {
    for (const modulo of modulos) {
        if (modulo.href === href) return modulo;
        const sub = modulo.submodulos?.find((s) => s.href === href);
        if (sub) return sub;
    }

    return undefined;
}
