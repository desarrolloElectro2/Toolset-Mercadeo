import { ReactNode } from 'react';

export const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500';

/** Etiqueta + control + mensaje de error, con asterisco rojo si es obligatorio. */
export default function Campo({
    etiqueta,
    obligatorio,
    error,
    children,
}: {
    etiqueta: string;
    obligatorio?: boolean;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {etiqueta} {obligatorio && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    );
}
