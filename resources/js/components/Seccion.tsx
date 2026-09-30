import { ReactNode } from 'react';

/** Bloque de formulario con encabezado (ej. "INFORMACIÓN GENERAL"). */
export default function Seccion({ titulo, children, acciones }: { titulo: string; children: ReactNode; acciones?: ReactNode }) {
    return (
        // Sin overflow-hidden: recortaría las listas desplegables (SelectBuscable) que salen de la sección.
        // Las esquinas del encabezado se redondean directamente con rounded-t-lg.
        <section className="rounded-lg border border-slate-200 bg-white">
            <header className="flex items-center justify-between rounded-t-lg border-b border-blue-100 bg-blue-50 px-5 py-2.5">
                <h3 className="text-xs font-semibold tracking-wider text-blue-800 uppercase">{titulo}</h3>
                {acciones}
            </header>
            <div className="p-5">{children}</div>
        </section>
    );
}
