export interface Usuario {
    coduser: string;
    nombre: string | null;
}

export interface SharedProps {
    auth: {
        user: Usuario | null;
        permisos: string[];
    };
    flash: {
        alerta: string | null;
        mensaje: string | null;
    };
    [key: string]: unknown;
}

/** Forma en que llega un ->paginate() de Laravel. */
export interface Paginado<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

declare module '@inertiajs/core' {
    interface InertiaConfig {
        sharedPageProps: SharedProps;
    }
}
