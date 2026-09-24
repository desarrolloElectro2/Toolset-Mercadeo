import { Head, Link, usePage } from '@inertiajs/react';

export default function Home() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Inicio" />

            <main className="p-6">
                <h1 className="text-2xl font-semibold text-gray-800">
                    Bienvenido, {auth.user?.nombre ?? auth.user?.coduser}
                </h1>

                <Link
                    href="/logout"
                    method="post"
                    as="button"
                    className="mt-4 rounded bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
                >
                    Cerrar sesión
                </Link>
            </main>
        </>
    );
}
