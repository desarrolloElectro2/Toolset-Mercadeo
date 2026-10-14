// Colores de la matriz de estados de actividad (los mismos nombres de EstadoActividadService::COLORES).
// Las clases van completas para que Tailwind las incluya al compilar.

export interface ColorEstado {
    etiqueta: string; // nombre para el select de la matriz
    clase: string; // etiqueta de estado (badge)
    fondo: string; // calendario
    borde: string;
    texto: string;
}

export const COLORES_ESTADO: Record<string, ColorEstado> = {
    azul: { etiqueta: 'Azul', clase: 'bg-blue-100 text-blue-700', fondo: '#dbeafe', borde: '#3b82f6', texto: '#1e40af' },
    celeste: { etiqueta: 'Celeste', clase: 'bg-cyan-100 text-cyan-800', fondo: '#cffafe', borde: '#06b6d4', texto: '#155e75' },
    morado: { etiqueta: 'Morado', clase: 'bg-violet-100 text-violet-700', fondo: '#ede9fe', borde: '#8b5cf6', texto: '#5b21b6' },
    rosa: { etiqueta: 'Rosa', clase: 'bg-pink-100 text-pink-700', fondo: '#fce7f3', borde: '#ec4899', texto: '#9d174d' },
    ambar: { etiqueta: 'Ámbar', clase: 'bg-amber-100 text-amber-800', fondo: '#fef3c7', borde: '#f59e0b', texto: '#92400e' },
    naranja: { etiqueta: 'Naranja', clase: 'bg-orange-100 text-orange-800', fondo: '#ffedd5', borde: '#f97316', texto: '#9a3412' },
    verde: { etiqueta: 'Verde', clase: 'bg-green-100 text-green-700', fondo: '#dcfce7', borde: '#22c55e', texto: '#166534' },
    rojo: { etiqueta: 'Rojo', clase: 'bg-red-100 text-red-700', fondo: '#fee2e2', borde: '#ef4444', texto: '#991b1b' },
    gris: { etiqueta: 'Gris', clase: 'bg-slate-100 text-slate-600', fondo: '#f1f5f9', borde: '#94a3b8', texto: '#334155' },
};

export const colorEstado = (color: string | undefined): ColorEstado => COLORES_ESTADO[color ?? ''] ?? COLORES_ESTADO.gris;
