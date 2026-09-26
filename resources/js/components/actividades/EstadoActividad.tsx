const estilos: Record<string, { etiqueta: string; clase: string }> = {
    PROGRAMADA: { etiqueta: 'Programada', clase: 'bg-blue-100 text-blue-700' },
    EN_PROCESO: { etiqueta: 'En proceso', clase: 'bg-amber-100 text-amber-800' },
    FINALIZADA: { etiqueta: 'Finalizada', clase: 'bg-green-100 text-green-700' },
    ANULADA: { etiqueta: 'Anulada', clase: 'bg-red-100 text-red-700' },
};

/** Etiqueta de color según el estado de la actividad. */
export default function EstadoActividad({ estado }: { estado: string }) {
    const estilo = estilos[estado] ?? { etiqueta: estado, clase: 'bg-slate-100 text-slate-600' };

    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${estilo.clase}`}>{estilo.etiqueta}</span>;
}
