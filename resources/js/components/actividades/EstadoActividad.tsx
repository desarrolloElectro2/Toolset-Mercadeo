import { colorEstado } from '@/lib/coloresEstado';
import { EstadoCatalogo } from '@/types/actividades';

/** Etiqueta de color según el estado de la actividad (nombre y color salen de la matriz de estados). */
export default function EstadoActividad({ estado, estados }: { estado: string; estados: EstadoCatalogo[] }) {
    const definicion = estados.find((e) => e.codigo === estado);

    return (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${colorEstado(definicion?.color).clase}`}>
            {definicion?.nombre ?? estado}
        </span>
    );
}
