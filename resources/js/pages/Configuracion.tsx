import { Head } from '@inertiajs/react';
import TarjetasModulos from '@/components/TarjetasModulos';
import { IconoConfiguracion } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';
import { buscarModulo } from '@/modulos';

export default function Configuracion() {
    const configuracion = buscarModulo('/configuracion');

    return (
        <AppLayout titulo="Configuración" icono={<IconoConfiguracion />}>
            <Head title="Configuración" />

            <TarjetasModulos modulos={configuracion?.submodulos ?? []} />
        </AppLayout>
    );
}
