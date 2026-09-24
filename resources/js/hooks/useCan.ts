import { usePage } from '@inertiajs/react';

/** Devuelve true si el rol del usuario tiene el código de permiso (tabla permisos de toolset_mercadeo). */
export function useCan() {
    const { auth } = usePage().props;

    return (codigo: string) => auth.permisos.includes(codigo);
}
