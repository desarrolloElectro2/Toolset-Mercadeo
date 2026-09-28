/**
 * Carpeta base donde está publicada la app ('' en local, '/mercadeo' en el servidor de prueba).
 * La expone Laravel en la meta "base-url" de app.blade.php.
 */
const base = (document.querySelector<HTMLMetaElement>('meta[name="base-url"]')?.content ?? '').replace(/\/+$/, '');

/** Antepone la carpeta base a una ruta de la app: url('/login') → '/mercadeo/login'. */
export function url(ruta: string): string {
    return `${base}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}

/** Ruta actual sin carpeta base ni query string, para comparar con los href de los menús. */
export function rutaSinBase(urlPagina: string): string {
    const ruta = urlPagina.split('?')[0];
    const sinBase = base && ruta.startsWith(base) ? ruta.slice(base.length) : ruta;
    return sinBase || '/';
}
