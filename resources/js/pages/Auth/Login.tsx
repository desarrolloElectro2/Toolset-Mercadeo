import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const BG = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&h=900&fit=crop&auto=format';

const inputClass =
    'w-full rounded-lg border-[1.5px] border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-all duration-150 focus:border-red-500 focus:ring-3 focus:ring-red-500/12';

export default function Login() {
    const { flash } = usePage().props;
    const [showPass, setShowPass] = useState(false);
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
        <div className="flex min-h-screen w-full flex-col bg-white">
            <Head title="Iniciar sesión" />

            {/* Banner superior con título */}
            <div className="relative h-[220px] w-full shrink-0">
                <img src={BG} alt="Analítica de mercadeo" className="absolute inset-0 h-full w-full object-cover opacity-55" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,20,60,0.55)_0%,rgba(10,20,60,0.75)_100%)]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="mb-1 text-sm tracking-[0.05em] text-white/85">Bienvenid@ a</p>
                    <h1 className="font-display text-3xl font-bold tracking-wide text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
                        <span className="text-red-400">T</span>oolset <span className="text-blue-300">Mercadeo</span>
                    </h1>
                </div>
            </div>

            {/* Tarjeta */}
            <div className="-mt-8 flex flex-1 items-start justify-center px-4 pb-12">
                <div className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                    <div className="h-1.5 w-full bg-[linear-gradient(90deg,#dc2626_0%,#ef4444_50%,#f87171_100%)]" />

                    <div className="px-10 py-8">
                        <h2 className="mb-7 text-center text-sm font-semibold tracking-[0.18em] text-gray-700 uppercase">
                            Iniciar Sesión
                        </h2>

                        {flash.alerta && (
                            <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {flash.alerta}
                            </p>
                        )}

                        <form onSubmit={submit} className="space-y-5">
                            <div>
                                <label htmlFor="coduser" className="mb-1.5 block text-xs font-medium text-gray-500">
                                    Ingrese su usuario
                                </label>
                                <input
                                    id="coduser"
                                    type="text"
                                    value={data.coduser}
                                    onChange={(e) => setData('coduser', e.target.value)}
                                    placeholder="Usuario"
                                    autoComplete="username"
                                    required
                                    autoFocus
                                    className={inputClass}
                                />
                                {errors.coduser && <p className="mt-1 text-xs text-red-600">{errors.coduser}</p>}
                            </div>

                            <div>
                                <label htmlFor="contrasena" className="mb-1.5 block text-xs font-medium text-gray-500">
                                    Ingrese su contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        id="contrasena"
                                        type={showPass ? 'text' : 'password'}
                                        value={data.contrasena}
                                        onChange={(e) => setData('contrasena', e.target.value)}
                                        placeholder="Contraseña"
                                        autoComplete="current-password"
                                        required
                                        className={`${inputClass} pr-11`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(!showPass)}
                                        className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-500"
                                        aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showPass ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {errors.contrasena && <p className="mt-1 text-xs text-red-600">{errors.contrasena}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="mt-2 w-full cursor-pointer rounded-lg bg-red-600 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_4px_14px_rgba(220,38,38,0.3)] transition-all duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300 disabled:shadow-none"
                            >
                                {processing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Ingresando…
                                    </span>
                                ) : (
                                    'INGRESAR'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
