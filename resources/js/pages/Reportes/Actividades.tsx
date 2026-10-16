import { Head } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import Campo, { inputClass } from '@/components/Campo';
import { IconoReporteActividades } from '@/components/Iconos';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';

type Tipo = 'general' | 'cumplimiento';
type Filtros = { tipo: Tipo; desde: string; hasta: string; regional: string; agencia: string };

interface Props {
    filtros: Filtros;
    agencias: { codigo: string; nombre: string; regional: string }[];
    errors?: Record<string, string>;
}

const AYUDA: Record<Tipo, string> = {
    general: 'Cada actividad con su responsable, asesores, productos y presupuesto.',
    cumplimiento: 'Programadas vs. cumplidas por regional, agencia y mes. Cumplida = en FIN ACTIVIDAD; las anuladas no cuentan: % = cumplidas ÷ (programadas − anuladas).',
};

// Primer y último día del mes actual ("YYYY-MM-DD"), para empezar con un rango útil
function mesActual(): { desde: string; hasta: string } {
    const hoy = new Date();
    const dos = (n: number) => String(n).padStart(2, '0');
    const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const base = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}`;
    return { desde: `${base}-01`, hasta: `${base}-${dos(ultimo)}` };
}

export default function Actividades({ filtros, agencias, errors = {} }: Props) {
    const [valores, setValores] = useState<Filtros>(filtros.desde || filtros.hasta ? filtros : { ...filtros, ...mesActual() });
    const [errorLocal, setErrorLocal] = useState('');
    const [descargando, setDescargando] = useState(false);

    const regionales = [...new Set(agencias.map((a) => a.regional))];
    const agenciasRegional = agencias.filter((a) => !valores.regional || a.regional === valores.regional);

    // El reporte no se muestra en pantalla: se descarga el Excel (si el servidor rechaza el rango, vuelve aquí con el error)
    const generar = (e: FormEvent) => {
        e.preventDefault();
        if (valores.hasta < valores.desde) {
            setErrorLocal('La fecha hasta debe ser igual o posterior a la fecha desde.');
            return;
        }
        setErrorLocal('');
        setDescargando(true);
        window.location.assign(url(`/reportes/actividades/exportar?${new URLSearchParams({ ...valores })}`));
        setTimeout(() => setDescargando(false), 3000);
    };

    return (
        <AppLayout titulo="Reportes › Actividades" icono={<IconoReporteActividades />}>
            <Head title="Reporte de actividades" />

            <form onSubmit={generar} className="rounded-lg border border-slate-200 bg-white p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[170px_170px_220px_160px_160px_auto] xl:items-end">
                    <Campo etiqueta="Tipo de reporte" obligatorio>
                        <select value={valores.tipo} onChange={(e) => setValores({ ...valores, tipo: e.target.value as Tipo })} className={inputClass}>
                            <option value="general">General</option>
                            <option value="cumplimiento">Cumplimiento</option>
                        </select>
                    </Campo>
                    <Campo etiqueta="Regional">
                        <select value={valores.regional} onChange={(e) => setValores({ ...valores, regional: e.target.value, agencia: '' })} className={inputClass}>
                            <option value="">Todas</option>
                            {regionales.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </Campo>
                    <Campo etiqueta="Agencia">
                        <select value={valores.agencia} onChange={(e) => setValores({ ...valores, agencia: e.target.value })} className={inputClass}>
                            <option value="">Todas</option>
                            {agenciasRegional.map((a) => (
                                <option key={a.codigo} value={a.codigo}>
                                    {a.nombre}
                                </option>
                            ))}
                        </select>
                    </Campo>
                    <Campo etiqueta="Fecha desde" obligatorio error={errors.desde}>
                        <input type="date" value={valores.desde} onChange={(e) => setValores({ ...valores, desde: e.target.value })} className={inputClass} />
                    </Campo>
                    <Campo etiqueta="Fecha hasta" obligatorio error={errorLocal || errors.hasta}>
                        <input
                            type="date"
                            value={valores.hasta}
                            min={valores.desde || undefined}
                            onChange={(e) => setValores({ ...valores, hasta: e.target.value })}
                            className={inputClass}
                        />
                    </Campo>
                    <div>
                        <button
                            type="submit"
                            disabled={descargando || !valores.desde || !valores.hasta}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <path d="m7 10 5 5 5-5" />
                                <path d="M12 15V3" />
                            </svg>
                            {descargando ? 'Generando…' : 'Generar reporte'}
                        </button>
                    </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                    {AYUDA[valores.tipo]} Se toman las actividades cuya fecha programada está en el rango (máximo un año). Se descarga en Excel.
                </p>
            </form>
        </AppLayout>
    );
}
