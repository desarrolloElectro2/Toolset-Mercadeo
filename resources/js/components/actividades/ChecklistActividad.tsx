import { inputClass } from '@/components/Campo';
import { Item, ItemChecklist } from '@/types/actividades';

interface Props {
    /** Ítems fijos del checklist (Decoración, Obsequios, Animador, Parlante, Micrófono, Carpa) */
    items: Item[];
    valor: ItemChecklist[];
    onChange: (checklist: ItemChecklist[]) => void;
    error: (campo: string) => string | undefined;
    soloLectura?: boolean;
}

const pesos = (valor: number) => `$ ${valor.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`;

/**
 * Checklist mercadeo de una actividad: los ítems fijos que se marcan, los que se agregan con nombre libre,
 * y por cada uno el presupuesto asignado (se digita) y el autorizado (lo pone la autorización del presupuesto).
 */
export default function ChecklistActividad({ items, valor, onChange, error, soloLectura = false }: Props) {
    const posicion = (fila: ItemChecklist) => valor.indexOf(fila);
    const deItem = (id: number) => valor.find((c) => c.checklist_item_id === id);
    const agregados = valor.filter((c) => c.checklist_item_id === null);

    const marcar = (item: Item, marcado: boolean) =>
        onChange(
            marcado
                ? [...valor, { checklist_item_id: item.id, nombre: item.nombre, presupuesto_asignado: '', presupuesto_autorizado: null }]
                : valor.filter((c) => c.checklist_item_id !== item.id),
        );
    const cambiar = (fila: ItemChecklist, cambios: Partial<ItemChecklist>) => onChange(valor.map((c) => (c === fila ? { ...c, ...cambios } : c)));
    const agregar = () => onChange([...valor, { checklist_item_id: null, nombre: '', presupuesto_asignado: '', presupuesto_autorizado: null }]);
    const quitar = (fila: ItemChecklist) => onChange(valor.filter((c) => c !== fila));

    const totalAsignado = valor.reduce((suma, c) => suma + (Number(c.presupuesto_asignado) || 0), 0);
    const totalAutorizado = valor.reduce((suma, c) => suma + (c.presupuesto_autorizado ?? 0), 0);

    // En consulta solo se muestran los ítems que lleva la actividad
    const fijos = soloLectura ? items.filter((i) => deItem(i.id)) : items;

    const celdaPresupuesto = (fila: ItemChecklist | undefined) => {
        const i = fila ? posicion(fila) : -1;
        return (
            <>
                <td className="py-1.5 pr-3">
                    {soloLectura || !fila ? (
                        <span className="text-slate-700">{fila?.presupuesto_asignado ? pesos(Number(fila.presupuesto_asignado)) : '—'}</span>
                    ) : (
                        <>
                            <input
                                type="number"
                                min={0}
                                step="any"
                                value={fila.presupuesto_asignado}
                                onChange={(e) => cambiar(fila, { presupuesto_asignado: e.target.value })}
                                placeholder="$ 0"
                                className={`${inputClass} py-1`}
                            />
                            {error(`checklist.${i}.presupuesto_asignado`) && (
                                <p className="mt-1 text-xs text-red-600">{error(`checklist.${i}.presupuesto_asignado`)}</p>
                            )}
                        </>
                    )}
                </td>
                <td className="py-1.5 pr-3 text-slate-700">
                    {fila?.presupuesto_autorizado != null ? pesos(fila.presupuesto_autorizado) : <span className="text-slate-400">—</span>}
                </td>
            </>
        );
    };

    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Checklist mercadeo</p>
                {!soloLectura && (
                    <button
                        type="button"
                        onClick={agregar}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Agregar elemento
                    </button>
                )}
            </div>

            {soloLectura && valor.length === 0 ? (
                <p className="text-sm text-slate-400">Sin elementos.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-500">
                                <th className="py-1 pr-3 font-medium">Elemento</th>
                                <th className="w-44 py-1 pr-3 font-medium">Presupuesto asignado</th>
                                <th className="w-40 py-1 pr-3 font-medium">Presupuesto autorizado</th>
                                {!soloLectura && <th className="w-8"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {fijos.map((item) => {
                                const fila = deItem(item.id);
                                return (
                                    <tr key={`fijo-${item.id}`} className="border-t border-slate-100 align-top">
                                        <td className="py-1.5 pr-3">
                                            <label className={`flex items-center gap-2 pt-1 text-slate-700 ${soloLectura ? '' : 'cursor-pointer'}`}>
                                                {!soloLectura && (
                                                    <input
                                                        type="checkbox"
                                                        checked={!!fila}
                                                        onChange={(e) => marcar(item, e.target.checked)}
                                                        className="h-4 w-4 accent-blue-600"
                                                    />
                                                )}
                                                {item.nombre}
                                            </label>
                                        </td>
                                        {celdaPresupuesto(fila)}
                                        {!soloLectura && <td></td>}
                                    </tr>
                                );
                            })}

                            {agregados.map((fila) => {
                                const i = posicion(fila);
                                return (
                                    <tr key={`agregado-${i}`} className="border-t border-slate-100 align-top">
                                        <td className="py-1.5 pr-3">
                                            {soloLectura ? (
                                                <span className="text-slate-700">{fila.nombre}</span>
                                            ) : (
                                                <>
                                                    <input
                                                        value={fila.nombre}
                                                        onChange={(e) => cambiar(fila, { nombre: e.target.value.toUpperCase() })}
                                                        maxLength={100}
                                                        placeholder="NOMBRE DEL ELEMENTO"
                                                        className={`${inputClass} py-1`}
                                                    />
                                                    {error(`checklist.${i}.nombre`) && <p className="mt-1 text-xs text-red-600">{error(`checklist.${i}.nombre`)}</p>}
                                                </>
                                            )}
                                        </td>
                                        {celdaPresupuesto(fila)}
                                        {!soloLectura && (
                                            <td className="py-1.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => quitar(fila)}
                                                    title="Quitar elemento"
                                                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                                        <path d="M18 6 6 18M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-slate-200 text-sm font-semibold text-slate-700">
                                <td className="py-2 pr-3">Total</td>
                                <td className="py-2 pr-3">{pesos(totalAsignado)}</td>
                                <td className="py-2 pr-3">{totalAutorizado > 0 ? pesos(totalAutorizado) : '—'}</td>
                                {!soloLectura && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
            {error('checklist') && <p className="mt-1 text-xs text-red-600">{error('checklist')}</p>}
        </div>
    );
}
