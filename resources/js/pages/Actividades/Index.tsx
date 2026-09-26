import { Head } from '@inertiajs/react';
import { IconoActividades } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';

// Página base del módulo: la tabla y el formulario se agregan cuando se defina la tabla de actividades
export default function Index() {
    return (
        <AppLayout titulo="Actividades" icono={<IconoActividades />}>
            <Head title="Actividades" />

            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-10 text-center">
                <div className="mb-4 text-slate-300">
                    <IconoActividades tamano={48} />
                </div>
                <p className="text-sm font-medium text-slate-400">Aún no hay actividades registradas.</p>
            </div>
        </AppLayout>
    );
}
