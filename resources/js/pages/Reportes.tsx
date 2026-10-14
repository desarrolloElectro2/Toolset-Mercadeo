import { Head } from '@inertiajs/react';
import TarjetasModulos from '@/components/TarjetasModulos';
import { IconoReportes } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';
import { buscarModulo } from '@/modulos';

export default function Reportes() {
    const reportes = buscarModulo('/reportes');

    return (
        <AppLayout titulo="Reportes" icono={<IconoReportes />}>
            <Head title="Reportes" />

            <TarjetasModulos modulos={reportes?.submodulos ?? []} />
        </AppLayout>
    );
}
