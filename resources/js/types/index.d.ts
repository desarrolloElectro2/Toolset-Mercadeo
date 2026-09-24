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
    };
    [key: string]: unknown;
}

declare module '@inertiajs/core' {
    interface InertiaConfig {
        sharedPageProps: SharedProps;
    }
}
