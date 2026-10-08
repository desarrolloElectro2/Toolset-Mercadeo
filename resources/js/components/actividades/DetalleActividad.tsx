import { inputClass } from '@/components/Campo';
import SelectBuscable from '@/components/SelectBuscable';
import SelectMultiple from '@/components/SelectMultiple';
import { DetalleDia, Item, Persona, ProductoInventario } from '@/types/actividades';

interface Props {
    valor: DetalleDia;
    onChange: (cambios: Partial<DetalleDia>) => void;
    /** Inventario de la agencia; null mientras no se pueda buscar (sin agencia, cargando o error) */
    inventario: ProductoInventario[] | null;
    /** Texto que se muestra cuando no hay inventario para buscar */
    mensajeInventario?: string | null;
    /** Asesores (perfil ASESOR de toolset_perf) de la agencia */
    asesores: Persona[];
    /** Texto que se muestra en lugar del selector de asesores (ej. sin agencia) */
    mensajeAsesores?: string;
    checklist: Item[];
    error: (campo: string) => string | undefined;
    soloLectura?: boolean;
}

const IconoQuitar = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
    </svg>
);

/** Productos (inventario Manager), asesores y checklist de una actividad. Se usa al crear y al editar. */
export default function DetalleActividad({
    valor,
    onChange,
    inventario,
    mensajeInventario,
    asesores,
    mensajeAsesores,
    checklist,
    error,
    soloLectura = false,
}: Props) {
    const agregados = valor.productos.map((p) => p.producto);

    const agregarProducto = (codigo: string) => {
        const producto = inventario?.find((p) => p.producto === codigo);
        if (!producto) return;
        onChange({
            productos: [...valor.productos, { producto: producto.producto, nombre: producto.nombre, referencia: producto.referencia, cantidad: '1' }],
        });
    };

    return (
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr_auto]">
            {/* Productos del inventario de la agencia */}
            <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Productos</p>
                {!soloLectura &&
                    (inventario === null ? (
                        <p className="text-xs text-amber-700">{mensajeInventario ?? 'Cargando inventario...'}</p>
                    ) : (
                        <SelectBuscable
                            opciones={inventario
                                .filter((p) => !agregados.includes(p.producto))
                                .map((p) => ({ valor: p.producto, etiqueta: p.nombre, detalle: `Ref: ${p.referencia ?? '—'} · Saldo: ${p.saldo}` }))}
                            valor=""
                            onChange={agregarProducto}
                            placeholder={`Buscar en el inventario (${inventario.length} productos)...`}
                        />
                    ))}
                {error('productos') && <p className="mt-1 text-xs text-red-600">{error('productos')}</p>}

                {valor.productos.length === 0 && soloLectura && <p className="text-sm text-slate-400">Sin productos.</p>}

                {valor.productos.length > 0 && (
                    <table className="mt-2 w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-500">
                                <th className="py-1 font-medium">Nombre</th>
                                <th className="py-1 font-medium">Referencia</th>
                                <th className="w-24 py-1 font-medium">Cantidad</th>
                                {!soloLectura && <th className="w-8"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {valor.productos.map((p, j) => {
                                const errorProducto = error(`productos.${j}.producto`) ?? error(`productos.${j}.cantidad`);
                                return (
                                    <tr key={p.producto} className="border-t border-slate-100 align-top">
                                        <td className="py-1.5 pr-2 text-slate-700">
                                            {p.nombre}
                                            {errorProducto && <p className="text-xs text-red-600">{errorProducto}</p>}
                                        </td>
                                        <td className="py-1.5 pr-2 text-slate-500">{p.referencia ?? '—'}</td>
                                        <td className="py-1">
                                            {soloLectura ? (
                                                <span className="text-slate-700">{p.cantidad}</span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={p.cantidad}
                                                    onChange={(e) =>
                                                        onChange({ productos: valor.productos.map((x, k) => (k === j ? { ...x, cantidad: e.target.value } : x)) })
                                                    }
                                                    className={`${inputClass} py-1`}
                                                />
                                            )}
                                        </td>
                                        {!soloLectura && (
                                            <td className="py-1 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => onChange({ productos: valor.productos.filter((_, k) => k !== j) })}
                                                    title="Quitar producto"
                                                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <IconoQuitar />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Asesores de la agencia (perfil ASESOR en toolset_perf) */}
            <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Asesores</p>
                {soloLectura ? (
                    <div className="flex flex-wrap gap-1.5">
                        {valor.asesores.length === 0 && <p className="text-sm text-slate-400">Sin asesores.</p>}
                        {valor.asesores.map((coduser) => (
                            <span key={coduser} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700">
                                {asesores.find((a) => a.coduser === coduser)?.nombre ?? coduser}
                            </span>
                        ))}
                    </div>
                ) : mensajeAsesores ? (
                    <p className="text-xs text-slate-400">{mensajeAsesores}</p>
                ) : (
                    <>
                        <SelectMultiple
                            opciones={asesores.map((a) => ({ valor: a.coduser, etiqueta: a.nombre }))}
                            valores={valor.asesores}
                            onChange={(valores) => onChange({ asesores: valores })}
                            placeholder="Agregar asesor..."
                        />
                        {asesores.length === 0 && <p className="mt-1 text-xs text-amber-700">La agencia no tiene asesores asignados.</p>}
                    </>
                )}
                {error('asesores') && <p className="mt-1 text-xs text-red-600">{error('asesores')}</p>}
            </div>

            {/* Checklist de implementos */}
            <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Checklist mercadeo</p>
                <div className="space-y-1">
                    {checklist.map((item) => (
                        <label key={item.id} className={`flex items-center gap-2 text-sm text-slate-700 ${soloLectura ? '' : 'cursor-pointer'}`}>
                            <input
                                type="checkbox"
                                checked={valor.checklist.includes(item.id)}
                                disabled={soloLectura}
                                onChange={() =>
                                    onChange({
                                        checklist: valor.checklist.includes(item.id)
                                            ? valor.checklist.filter((c) => c !== item.id)
                                            : [...valor.checklist, item.id],
                                    })
                                }
                                className="h-4 w-4 accent-blue-600"
                            />
                            {item.nombre}
                        </label>
                    ))}
                </div>
                {error('checklist') && <p className="mt-1 text-xs text-red-600">{error('checklist')}</p>}
            </div>
        </div>
    );
}
