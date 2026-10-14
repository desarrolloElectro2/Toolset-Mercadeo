import Seccion from '@/components/Seccion';

export interface ProspectosDelDia {
    prospectos: { id: number; hora: string; nombre: string; identificacion: string | null; celular: string | null; estado: string; asesor: string }[];
    perfilaciones: { codper: number; hora: string; cedula: string; cliente: string; valor: number; estado: string; asesor: string }[];
    error: string | null;
}

const pesos = (valor: number) => `$ ${valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/** Al finalizar la actividad: prospectos y perfilaciones que crearon ese día los asesores asignados (toolset_perf). */
export default function ProspectosActividad({ datos }: { datos: ProspectosDelDia }) {
    return (
        <Seccion
            titulo="Prospectos y perfilaciones del día"
            acciones={
                <span className="text-xs font-medium text-blue-700">
                    {datos.prospectos.length} prospecto(s) · {datos.perfilaciones.length} perfilación(es)
                </span>
            }
        >
            <p className="mb-4 text-xs text-slate-500">Creados el día de la actividad por los asesores asignados a ella.</p>

            {datos.error ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{datos.error}</p>
            ) : (
                <div className="space-y-6">
                    <Tabla
                        titulo="Prospectos"
                        vacio="Los asesores no crearon prospectos ese día."
                        columnas={['Hora', 'Nombre', 'Identificación', 'Celular', 'Estado', 'Asesor']}
                        filas={datos.prospectos.map((p) => [p.hora, p.nombre, p.identificacion || '—', p.celular || '—', p.estado || '—', p.asesor])}
                    />
                    <Tabla
                        titulo="Perfilaciones"
                        vacio="Los asesores no crearon perfilaciones ese día."
                        columnas={['Hora', 'Código', 'Cédula cliente', 'Cliente', 'Valor crédito', 'Estado', 'Asesor']}
                        filas={datos.perfilaciones.map((p) => [
                            p.hora,
                            String(p.codper),
                            p.cedula || '—',
                            p.cliente || '—',
                            p.valor > 0 ? pesos(p.valor) : '—',
                            p.estado || '—',
                            p.asesor,
                        ])}
                    />
                </div>
            )}
        </Seccion>
    );
}

function Tabla({ titulo, vacio, columnas, filas }: { titulo: string; vacio: string; columnas: string[]; filas: string[][] }) {
    return (
        <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">
                {titulo} ({filas.length})
            </p>
            {filas.length === 0 ? (
                <p className="text-sm text-slate-400">{vacio}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                                {columnas.map((c) => (
                                    <th key={c} className="py-1.5 pr-3 font-medium whitespace-nowrap">
                                        {c}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((fila, i) => (
                                <tr key={i} className="border-b border-slate-100 last:border-0">
                                    {fila.map((celda, j) => (
                                        <td key={j} className="py-1.5 pr-3 text-slate-700">
                                            {celda}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
