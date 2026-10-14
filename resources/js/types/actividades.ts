// Tipos compartidos del módulo Actividades

export interface Item {
    id: number;
    nombre: string;
}

export interface Persona {
    coduser: string;
    nombre: string;
    /** Código de vendedor en Manager (asesores de planta / externos) */
    vendedor?: string | null;
}

/** Asesores de Manager por grupo; null si Manager no respondió */
export type AsesoresManager = Record<string, Persona[] | null>;

/** Título de la lista de asesores según su fuente */
export const TITULOS_ASESORES: Record<string, string> = { planta: 'Asesores de planta', externos: 'Asesores externos' };

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

/** Elemento del checklist mercadeo de un día: fijo (checklist_item_id) o agregado con nombre libre (id null) */
export interface ItemChecklist {
    checklist_item_id: number | null;
    nombre: string;
    presupuesto_asignado: string;
    /** Lo pone la autorización del presupuesto; no se digita */
    presupuesto_autorizado: number | null;
}

/** Lo que se planea para un día además del tipo y el municipio */
export interface DetalleDia {
    productos: ProductoDia[];
    asesores: string[];
    checklist: ItemChecklist[];
}

/** Estado de la matriz parametrizable (Configuración › Estados actividad) */
export interface EstadoCatalogo {
    codigo: string;
    nombre: string;
    color: string;
    activo: boolean;
    requiereInicio: boolean; // hora + foto de inicio
    requiereFin: boolean; // hora fin + archivo de finalización
    requiereObservacion: boolean; // motivo obligatorio al pasar a este estado
    permiso: string; // permiso para asignarlo
}

/** Empleado de la nómina de Manager (responsable evento); se identifica por cédula */
export interface EmpleadoManager {
    cedula: string;
    nombre: string;
}
