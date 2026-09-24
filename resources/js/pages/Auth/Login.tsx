import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function Login() {
    const { flash } = usePage().props;
    const { data, setData, post, processing, errors } = useForm({
        coduser: '',
        contrasena: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post('/login', {
            onFinish: () => setData('contrasena', ''),
        });
    };

    return (
        <>
            <Head title="Iniciar sesión" />

            <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
                <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
                    <h1 className="text-xl font-semibold text-gray-800">Iniciar sesión</h1>

                    {flash.alerta && (
                        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{flash.alerta}</p>
                    )}

                    <label className="block">
                        <span className="text-sm text-gray-700">Usuario</span>
                        <input
                            type="text"
                            value={data.coduser}
                            onChange={(e) => setData('coduser', e.target.value)}
                            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                            required
                            autoFocus
                        />
                        {errors.coduser && <span className="text-sm text-red-600">{errors.coduser}</span>}
                    </label>

                    <label className="block">
                        <span className="text-sm text-gray-700">Contraseña</span>
                        <input
                            type="password"
                            value={data.contrasena}
                            onChange={(e) => setData('contrasena', e.target.value)}
                            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                            required
                        />
                        {errors.contrasena && <span className="text-sm text-red-600">{errors.contrasena}</span>}
                    </label>

                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full rounded bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        Entrar
                    </button>
                </form>
            </main>
        </>
    );
}
