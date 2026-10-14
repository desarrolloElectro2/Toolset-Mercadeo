import { useEffect, useState } from 'react';

export interface Ubicacion {
    estado: 'buscando' | 'ok' | 'denegada' | 'no-disponible';
    latitud: number | null;
    longitud: number | null;
    precision: number | null;
}

/** Campos que se envían con las fotos para escribir la ubicación sobre ellas */
export const camposUbicacion = (u: Ubicacion) =>
    u.estado === 'ok' ? { latitud: String(u.latitud), longitud: String(u.longitud), precision: String(Math.round(u.precision ?? 0)) } : {};

export const textoUbicacion = (u: Ubicacion) =>
    ({
        buscando: 'Obteniendo la ubicación…',
        ok: `Ubicación: ${u.latitud?.toFixed(5)}, ${u.longitud?.toFixed(5)} (±${Math.round(u.precision ?? 0)} m)`,
        denegada: 'No se dio permiso de ubicación: las fotos se marcarán con el GPS de la foto si lo tiene.',
        'no-disponible': 'El navegador no pudo dar la ubicación: las fotos se marcarán con el GPS de la foto si lo tiene.',
    })[u.estado];

/**
 * Pide la ubicación del dispositivo (requiere https) cuando `activo` es true y la mantiene actualizada.
 * Se usa para escribir la ubicación sobre las fotos que se cargan.
 */
export function useUbicacion(activo = true): Ubicacion {
    const [ubicacion, setUbicacion] = useState<Ubicacion>({ estado: 'buscando', latitud: null, longitud: null, precision: null });

    useEffect(() => {
        if (!activo) return;
        if (!('geolocation' in navigator)) {
            setUbicacion((u) => ({ ...u, estado: 'no-disponible' }));
            return;
        }

        const id = navigator.geolocation.watchPosition(
            (p) => setUbicacion({ estado: 'ok', latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy }),
            (e) => setUbicacion((u) => (u.estado === 'ok' ? u : { ...u, estado: e.code === e.PERMISSION_DENIED ? 'denegada' : 'no-disponible' })),
            { enableHighAccuracy: true, maximumAge: 60000, timeout: 20000 },
        );

        return () => navigator.geolocation.clearWatch(id);
    }, [activo]);

    return ubicacion;
}
