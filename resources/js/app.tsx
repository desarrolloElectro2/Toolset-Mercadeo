import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Mercadeo';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    // Cada página se descarga al abrirla (no todas al inicio): librerías pesadas como el calendario
    // solo se cargan en la pantalla que las usa
    resolve: (name) => {
        const pages = import.meta.glob('./pages/**/*.tsx');
        return pages[`./pages/${name}.tsx`]() as never;
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
    progress: {
        color: '#2563eb',
    },
});
