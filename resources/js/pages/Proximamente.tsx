import { Head } from '@inertiajs/react';
import AppLayout from '@/layouts/AppLayout';

interface Props {
    titulo: string;
    icono: string;
    /** Título del módulo padre cuando es un submódulo (ej. Configuración) */
    padre?: string;
}

/** Página temporal para módulos que aún no se han construido. */
export default function Proximamente({ titulo, icono, padre }: Props) {
    return (
        <AppLayout titulo={padre ? `${padre} › ${titulo}` : titulo} icono={icono}>
            <Head title={titulo} />

            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-10 text-center">
                <div className="mb-4 text-5xl opacity-30">📋</div>
                <p className="text-sm font-medium text-slate-400">
                    Módulo <span className="text-blue-500">{titulo}</span> — próximamente
                </p>
            </div>
        </AppLayout>
    );
}
