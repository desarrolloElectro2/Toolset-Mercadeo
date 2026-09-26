import { KeyboardEvent, useMemo, useState } from 'react';
import { inputClass } from '@/components/Campo';

export interface Opcion {
    valor: string;
    etiqueta: string;
    /** Texto secundario (ej. "Ref: JLC-384 · Saldo: 3"); también se usa al buscar */
    detalle?: string;
}

interface Props {
    opciones: Opcion[];
    valor: string;
    onChange: (valor: string) => void;
    placeholder?: string;
    disabled?: boolean;
    conError?: boolean;
    /** Máximo de resultados visibles (listas grandes como el inventario) */
    limite?: number;
}

// Minúsculas y sin tildes para comparar
const normalizar = (texto: string) =>
    texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase();

/** Select con buscador para listas largas (agencias, municipios, productos...). */
export default function SelectBuscable({
    opciones,
    valor,
    onChange,
    placeholder = 'SELECCIONE',
    disabled = false,
    conError = false,
    limite = 80,
}: Props) {
    const [abierto, setAbierto] = useState(false);
    const [texto, setTexto] = useState('');
    const [resaltado, setResaltado] = useState(0);

    const seleccionada = opciones.find((o) => o.valor === valor);

    const filtradas = useMemo(() => {
        const buscado = normalizar(texto.trim());
        const lista = buscado ? opciones.filter((o) => normalizar(`${o.etiqueta} ${o.detalle ?? ''}`).includes(buscado)) : opciones;
        return lista.slice(0, limite);
    }, [opciones, texto, limite]);

    const elegir = (opcion: Opcion) => {
        onChange(opcion.valor);
        setAbierto(false);
        setTexto('');
    };

    const alPresionar = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAbierto(true);
            setResaltado((i) => Math.min(i + 1, filtradas.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setResaltado((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && abierto) {
            e.preventDefault();
            if (filtradas[resaltado]) elegir(filtradas[resaltado]);
        } else if (e.key === 'Escape') {
            setAbierto(false);
        }
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={abierto ? texto : (seleccionada?.etiqueta ?? '')}
                placeholder={abierto ? 'Escriba para buscar...' : placeholder}
                onFocus={() => {
                    setAbierto(true);
                    setTexto('');
                    setResaltado(0);
                }}
                onBlur={() => setAbierto(false)}
                onChange={(e) => {
                    setTexto(e.target.value);
                    setResaltado(0);
                }}
                onKeyDown={alPresionar}
                disabled={disabled}
                className={`${inputClass} pr-8 ${conError ? 'border-red-400' : ''}`}
            />
            <svg
                className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>

            {abierto && (
                <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {filtradas.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">Sin resultados</li>}
                    {filtradas.map((opcion, i) => (
                        <li
                            key={opcion.valor}
                            // onMouseDown para elegir antes de que el input pierda el foco
                            onMouseDown={(e) => {
                                e.preventDefault();
                                elegir(opcion);
                            }}
                            onMouseEnter={() => setResaltado(i)}
                            className={`cursor-pointer px-3 py-1.5 text-sm ${
                                i === resaltado ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                            } ${opcion.valor === valor ? 'font-semibold' : ''}`}
                        >
                            {opcion.etiqueta}
                            {opcion.detalle && <span className="block text-xs text-slate-400">{opcion.detalle}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
