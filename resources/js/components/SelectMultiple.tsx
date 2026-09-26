import SelectBuscable, { Opcion } from '@/components/SelectBuscable';

interface Props {
    opciones: Opcion[];
    valores: string[];
    onChange: (valores: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

/** Selección de varios elementos: buscador para agregar + etiquetas con ✕ para quitar. */
export default function SelectMultiple({ opciones, valores, onChange, placeholder = 'Agregar...', disabled }: Props) {
    const disponibles = opciones.filter((o) => !valores.includes(o.valor));

    return (
        <div className="space-y-2">
            <SelectBuscable
                opciones={disponibles}
                valor=""
                onChange={(valor) => onChange([...valores, valor])}
                placeholder={placeholder}
                disabled={disabled}
            />

            {valores.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {valores.map((valor) => (
                        <span
                            key={valor}
                            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pr-1 pl-2.5 text-xs font-medium text-blue-700"
                        >
                            {opciones.find((o) => o.valor === valor)?.etiqueta ?? valor}
                            <button
                                type="button"
                                onClick={() => onChange(valores.filter((v) => v !== valor))}
                                className="rounded-full p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
                                aria-label="Quitar"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
