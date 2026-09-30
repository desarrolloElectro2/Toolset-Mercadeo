import { ReactNode } from 'react';

// Íconos de línea monocromáticos: toman el color del texto (currentColor)
function Icono({ children, tamano = 16 }: { children: ReactNode; tamano?: number }) {
    return (
        <svg
            width={tamano}
            height={tamano}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {children}
        </svg>
    );
}

export const IconoPrincipal = ({ tamano }: { tamano?: number }) => (
    <Icono tamano={tamano}>
        <path d="m12 14 4-4" />
        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </Icono>
);

export const IconoActividades = ({ tamano }: { tamano?: number }) => (
    <Icono tamano={tamano}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m9 16 2 2 4-4" />
    </Icono>
);

export const IconoConfiguracion = ({ tamano }: { tamano?: number }) => (
    <Icono tamano={tamano}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </Icono>
);

export const IconoUsuarios = ({ tamano }: { tamano?: number }) => (
    <Icono tamano={tamano}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icono>
);

export const IconoPerfiles = ({ tamano }: { tamano?: number }) => (
    <Icono tamano={tamano}>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icono>
);

export const IconoTiposActividad = ({ tamano }: { tamano?: number }) => (
    <Icono tamano={tamano}>
        <path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r="1.5" />
    </Icono>
);

export const IconoAccesoDenegado =({ tamano }: { tamano?: number }) => (
    <Icono tamano={tamano}>
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" />
    </Icono>
);
