import { Head, Link } from '@inertiajs/react';
import { IconoAccesoDenegado, IconoPerfiles } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';

export default function AccesoDenegado() {
    return (
        <AppLayout titulo="Acceso denegado" icono={<IconoAccesoDenegado />}>
            <Head title="Acceso denegado" />

            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-10 text-center">
                <div className="mb-4 text-slate-300">
                    <IconoPerfiles tamano={48} />
                </div>
                <p className="text-sm font-medium text-slate-500">Tu rol no tiene permiso para ver esta sección.</p>
                <Link
                    href={url('/')}
                    className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    Volver a Principal
                </Link>
            </div>
        </AppLayout>
    );
}
