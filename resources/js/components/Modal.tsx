import { ReactNode, useEffect } from 'react';

interface Props {
    abierto: boolean;
    titulo: string;
    children: ReactNode;
    onCerrar: () => void;
    /** Mientras se guarda no se cierra con Escape ni clic afuera */
    bloqueado?: boolean;
}

/** Ventana modal genérica (formularios cortos de crear/editar). */
export default function Modal({ abierto, titulo, children, onCerrar, bloqueado = false }: Props) {
    useEffect(() => {
        if (!abierto) return;
        const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && !bloqueado && onCerrar();
        window.addEventListener('keydown', alPresionar);
        return () => window.removeEventListener('keydown', alPresionar);
    }, [abierto, bloqueado, onCerrar]);

    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => !bloqueado && onCerrar()} />

            <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-xl bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
                    <button
                        type="button"
                        onClick={onCerrar}
                        disabled={bloqueado}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Cerrar"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}
