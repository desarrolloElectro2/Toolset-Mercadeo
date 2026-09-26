// Tipos compartidos del módulo Actividades

export interface Item {
    id: number;
    nombre: string;
}

export interface Persona {
    coduser: string;
    nombre: string;
}

export interface ProductoInventario {
    producto: string;
    nombre: string;
    referencia: string | null;
    saldo: number;
}

export interface ProductoDia {
    producto: string;
    nombre: string;
    referencia: string | null;
    cantidad: string;
}

/** Lo que se planea para un día además del tipo y el municipio */
export interface DetalleDia {
    productos: ProductoDia[];
    asesores: string[];
    checklist: number[];
}

export type EstadoActividad = 'PROGRAMADA' | 'EN_PROCESO' | 'FINALIZADA' | 'ANULADA';
