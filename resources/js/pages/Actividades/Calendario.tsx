import type { EventContentArg, EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import { Head, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import PestanasActividades from '@/components/actividades/PestanasActividades';
import { inputClass } from '@/components/Campo';
import { IconoActividades } from '@/components/Iconos';
import SelectBuscable from '@/components/SelectBuscable';
import AppLayout from '@/layouts/AppLayout';
import { url } from '@/lib/url';

interface EventoActividad {
    id: number;
    fecha: string;
    regional: string;
    agencia: string;
    municipio: string;
    tipo: string;
    responsable: string;
    horaInicio: string | null;
    horaFin: string | null;
    estado: string;
}

interface Props {
    opciones: {
        regionales: string[];
        agencias: { codigo: string; nombre: string }[];
        estados: { valor: string; etiqueta: string }[];
    };
}

// Mismos colores que la etiqueta de estado de la lista
const COLORES: Record<string, { fondo: string; borde: string; texto: string; etiqueta: string }> = {
    PROGRAMADA: { fondo: '#dbeafe', borde: '#3b82f6', texto: '#1e40af', etiqueta: 'Programada' },
    EN_PROCESO: { fondo: '#fef3c7', borde: '#f59e0b', texto: '#92400e', etiqueta: 'En proceso' },
    FINALIZADA: { fondo: '#dcfce7', borde: '#22c55e', texto: '#166534', etiqueta: 'Finalizada' },
    ANULADA: { fondo: '#fee2e2', borde: '#ef4444', texto: '#991b1b', etiqueta: 'Anulada' },
};

// FullCalendar trabaja con Date; al servidor se envían fechas locales "YYYY-MM-DD"
const aFechaLocal = (fecha: Date) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

export default function Calendario({ opciones }: Props) {
    const calendario = useRef<FullCalendar>(null);
    const [filtros, setFiltros] = useState({ regional: '', agencia: '', estado: '' });
    const filtrosActuales = useRef(filtros); // los lee la función de eventos sin volver a crear el calendario
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cambiarFiltro = (cambios: Partial<typeof filtros>) => {
        const nuevos = { ...filtros, ...cambios };
        setFiltros(nuevos);
        filtrosActuales.current = nuevos;
        calendario.current?.getApi().refetchEvents();
    };

    // Pide al servidor solo las actividades del rango visible
    const cargarEventos = async (rango: EventSourceFuncArg): Promise<EventInput[]> => {
        const params = new URLSearchParams({ inicio: aFechaLocal(rango.start), fin: aFechaLocal(rango.end) });
        Object.entries(filtrosActuales.current).forEach(([clave, valor]) => valor && params.set(clave, valor));

        setError(null);
        try {
            const respuesta = await fetch(url(`/actividades/calendario/eventos?${params}`), {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            const actividades: EventoActividad[] = await respuesta.json();

            return actividades.map((a) => {
                const color = COLORES[a.estado] ?? COLORES.PROGRAMADA;
                return {
                    id: String(a.id),
                    title: `${a.agencia} :: ${a.municipio}`,
                    start: a.fecha,
                    allDay: true,
                    backgroundColor: color.fondo,
                    borderColor: color.borde,
                    textColor: color.texto,
                    extendedProps: a,
                };
            });
        } catch {
            setError('No se pudieron cargar las actividades del calendario. Intente de nuevo.');
            return [];
        }
    };

    return (
        <AppLayout titulo="Actividades › Calendario" icono={<IconoActividades />}>
            <Head title="Calendario actividades" />

            <PestanasActividades />

            <div className="rounded-lg border border-slate-200 bg-white p-6">
                {/* Filtros */}
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Regional</label>
                        <select value={filtros.regional} onChange={(e) => cambiarFiltro({ regional: e.target.value })} className={inputClass}>
                            <option value="">TODAS</option>
                            {opciones.regionales.map((r) => (
                                <option key={r} value={r}>
                                    {r}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Agencia</label>
                        <SelectBuscable
                            opciones={[{ valor: '', etiqueta: 'TODAS' }, ...opciones.agencias.map((a) => ({ valor: a.codigo, etiqueta: a.nombre }))]}
                            valor={filtros.agencia}
                            onChange={(v) => cambiarFiltro({ agencia: v })}
                            placeholder="TODAS"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
                        <select value={filtros.estado} onChange={(e) => cambiarFiltro({ estado: e.target.value })} className={inputClass}>
                            <option value="">TODOS</option>
                            {opciones.estados.map((e) => (
                                <option key={e.valor} value={e.valor}>
                                    {e.etiqueta}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Convenciones */}
                <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    {Object.entries(COLORES).map(([estado, c]) => (
                        <span key={estado} className="inline-flex items-center gap-1.5">
                            <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: c.fondo, borderColor: c.borde }} />
                            {c.etiqueta}
                        </span>
                    ))}
                    {cargando && <span className="text-slate-400">Cargando…</span>}
                </div>

                {error && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}

                <div className="calendario-actividades">
                    <FullCalendar
                        ref={calendario}
                        plugins={[dayGridPlugin, listPlugin]}
                        locale={esLocale}
                        initialView="dayGridMonth"
                        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,dayGridDay,listMonth' }}
                        buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Agenda' }}
                        height="auto"
                        dayMaxEvents={4}
                        moreLinkText={(n) => `+${n} más`}
                        events={cargarEventos}
                        loading={setCargando}
                        eventContent={contenidoEvento}
                        eventClick={(info) => {
                            info.jsEvent.preventDefault();
                            router.visit(url(`/actividades/${info.event.id}/editar`));
                        }}
                    />
                </div>
            </div>
        </AppLayout>
    );
}

// Cómo se ve cada actividad: AGENCIA :: MUNICIPIO, tipo, responsable y horas (como en Correrías)
function contenidoEvento(arg: EventContentArg) {
    const a = arg.event.extendedProps as EventoActividad;
    const horas = a.horaInicio ? `${a.horaInicio}${a.horaFin ? ` - ${a.horaFin}` : ''}` : null;

    return (
        <div className="w-full cursor-pointer overflow-hidden px-1 py-0.5 text-[11px] leading-tight whitespace-normal">
            <p className="font-semibold">
                #{a.id} {a.agencia} :: {a.municipio}
            </p>
            <p>» {a.tipo}</p>
            <p>» {a.responsable}</p>
            {horas && <p>» {horas}</p>}
        </div>
    );
}
