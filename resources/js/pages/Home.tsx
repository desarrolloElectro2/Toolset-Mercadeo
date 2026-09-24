import { Head } from '@inertiajs/react';
import TarjetasModulos from '@/components/TarjetasModulos';
import AppLayout from '@/layouts/AppLayout';
import { modulos } from '@/modulos';

export default function Home() {
    return (
        <AppLayout titulo="Principal">
            <Head title="Principal" />

            <TarjetasModulos modulos={modulos} />
        </AppLayout>
    );
}
