import { useEffect } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import SelectBuscable from '@/components/SelectBuscable';
import { EmpleadoManager } from '@/types/actividades';

interface Props {
    tipos: { valor: string; nombre: string }[];
    /** Empleados activos de la agencia en Manager por tipo; null mientras no se puedan mostrar (sin agencia, cargando o error) */
    responsables: Record<string, EmpleadoManager[]> | null;
    /** Texto en lugar del select cuando responsables es null */
    mensaje?: string | null;
    tipo: string;
    responsable: string; // cédula
    onChange: (cambios: { tipo_responsable?: string; responsable_evento_id?: string }) => void;
    error: (campo: string) => string | undefined;
    soloLectura?: boolean;
}

/** Tipo de responsable + responsable evento (empleado de Manager) de una actividad. Se usa al crear y al editar. */
export default function ResponsableEvento({ tipos, responsables, mensaje, tipo, responsable, onChange, error, soloLectura = false }: Props) {
    const opciones = (tipo && responsables?.[tipo]) || [];
    const nombreTipo = tipos.find((t) => t.valor === tipo)?.nombre;

    // Si el tipo tiene un solo responsable evento en la agencia, se selecciona solo
    const unico = !soloLectura && !responsable && opciones.length === 1 ? opciones[0].cedula : '';
    useEffect(() => {
        if (unico) onChange({ responsable_evento_id: unico });
    }, [unico]); // eslint-disable-line react-hooks/exhaustive-deps

    if (soloLectura) {
        const nombre = opciones.find((p) => p.cedula === responsable)?.nombre;
        return (
            <>
                <Campo etiqueta="Tipo de responsable">
                    <input value={nombreTipo ?? (tipo || '—')} disabled className={inputClass} />
                </Campo>
                <Campo etiqueta="Responsable evento">
                    <input value={nombre ? `${nombre} (${responsable})` : responsable || '—'} disabled className={inputClass} />
                </Campo>
            </>
        );
    }

    return (
        <>
            <Campo etiqueta="Tipo de responsable" obligatorio error={error('tipo_responsable')}>
                <select
                    value={tipo}
                    onChange={(e) => onChange({ tipo_responsable: e.target.value, responsable_evento_id: '' })}
                    className={`${inputClass} ${error('tipo_responsable') ? 'border-red-400' : ''}`}
                >
                    <option value="">SELECCIONE</option>
                    {tipos.map((t) => (
                        <option key={t.valor} value={t.valor}>
                            {t.nombre}
                        </option>
                    ))}
                </select>
            </Campo>

            <Campo etiqueta="Responsable evento" obligatorio error={error('responsable_evento_id')}>
                <SelectBuscable
                    opciones={opciones.map((p) => ({ valor: p.cedula, etiqueta: `${p.nombre} (${p.cedula})` }))}
                    valor={responsable}
                    onChange={(v) => onChange({ responsable_evento_id: v })}
                    placeholder={responsables === null ? (mensaje ? '—' : 'Cargando...') : !tipo ? 'Seleccione el tipo' : 'SELECCIONE'}
                    disabled={responsables === null || !tipo}
                    conError={!!error('responsable_evento_id')}
                />
                {responsables === null && mensaje && <p className="mt-1 text-xs text-amber-700">{mensaje}</p>}
                {responsables !== null && tipo && opciones.length === 0 && (
                    <p className="mt-1 text-xs text-amber-700">La agencia no tiene empleados activos en Manager para {nombreTipo}.</p>
                )}
            </Campo>
        </>
    );
}
