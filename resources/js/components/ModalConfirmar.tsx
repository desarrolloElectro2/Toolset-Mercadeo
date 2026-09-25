import { ReactNode, useEffect } from 'react';

interface Props {
    abierto: boolean;
    titulo: string;
    children: ReactNode;
    textoConfirmar?: string;
    procesando?: boolean;
    onConfirmar: () => void;
    onCancelar: () => void;
}

/** Ventana de confirmación para acciones peligrosas (eliminar, anular...). */
export default function ModalConfirmar({
    abierto,
    titulo,
    children,
    textoConfirmar = 'Eliminar',
    procesando = false,
    onConfirmar,
    onCancelar,
}: Props) {
    // Cerrar con Escape
    useEffect(() => {
        if (!abierto) return;
        const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && !procesando && onCancelar();
        window.addEventListener('keydown', alPresionar);
        return () => window.removeEventListener('keydown', alPresionar);
    }, [abierto, procesando, onCancelar]);

    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => !procesando && onCancelar()} />

            <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
                <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
                        <div className="mt-1 text-sm text-slate-600">{children}</div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancelar}
                        disabled={procesando}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmar}
                        disabled={procesando}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                    >
                        {procesando ? 'Eliminando…' : textoConfirmar}
                    </button>
                </div>
            </div>
        </div>
    );
}
