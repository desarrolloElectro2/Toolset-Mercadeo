import { Link, usePage } from '@inertiajs/react';
import { ReactNode, useState } from 'react';
import { useCan } from '@/hooks/useCan';
import { modulos, puedeVer } from '@/modulos';

const CLAVE_SIDEBAR = 'mercadeo.sidebarAbierto';

function leerSidebarAbierto(): boolean {
    try {
        return localStorage.getItem(CLAVE_SIDEBAR) !== '0';
    } catch {
        return true;
    }
}

interface Props {
    titulo: string;
    icono?: string;
    children: ReactNode;
}

export default function AppLayout({ titulo, icono = '⊞', children }: Props) {
    const { auth, flash } = usePage().props;
    const url = usePage().url;
    const can = useCan();
    const [sidebarAbierto, setSidebarAbierto] = useState(leerSidebarAbierto);

    const items = modulos.filter((m) => puedeVer(m, can));
    const nombre = auth.user?.nombre ?? auth.user?.coduser ?? '';

    const ruta = url.split('?')[0];
    const esActivo = (href: string) => (href === '/' ? ruta === '/' : ruta === href || ruta.startsWith(`${href}/`));

    const alternarSidebar = () => {
        const abierto = !sidebarAbierto;
        setSidebarAbierto(abierto);
        try {
            localStorage.setItem(CLAVE_SIDEBAR, abierto ? '1' : '0');
        } catch {
            // sin almacenamiento disponible: solo dura mientras la página esté abierta
        }
    };

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-slate-100">
            {/* Barra superior */}
            <header className="z-20 flex h-14 shrink-0 items-center justify-between bg-gray-900 px-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={alternarSidebar}
                        className="rounded p-1.5 text-white transition-colors hover:bg-white/10"
                        aria-label="Mostrar u ocultar menú"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <span className="hidden font-display text-sm font-bold tracking-wider text-white sm:block">
                        <span className="text-red-400">T</span>oolset <span className="text-blue-400">Mercadeo</span>
                    </span>
                </div>

                {/* Usuario */}
                <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5">
                    <span className="hidden text-xs tracking-wide text-gray-300 uppercase sm:block">{nombre}</span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                        {nombre.charAt(0).toUpperCase()}
                    </div>
                    <Link
                        href="/logout"
                        method="post"
                        as="button"
                        className="ml-1 cursor-pointer text-gray-400 transition-colors hover:text-red-400"
                        title="Cerrar sesión"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </Link>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Menú lateral */}
                <aside
                    className={`z-10 shrink-0 overflow-y-auto border-r border-gray-200 bg-white transition-all duration-200 [scrollbar-width:none] ${
                        sidebarAbierto ? 'w-[180px]' : 'w-0 border-r-0'
                    }`}
                >
                    <nav className="py-2">
                        {items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] whitespace-nowrap transition-colors ${
                                    esActivo(item.href)
                                        ? 'bg-blue-50 font-semibold text-blue-600'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <span className="shrink-0 text-[15px]">{item.icono}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </aside>

                {/* Contenido */}
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
                        <span className="text-base">{icono}</span>
                        <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>
                    </div>

                    {flash.mensaje && (
                        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            {flash.mensaje}
                        </p>
                    )}

                    {flash.alerta && (
                        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {flash.alerta}
                        </p>
                    )}

                    {children}
                </main>
            </div>
        </div>
    );
}
