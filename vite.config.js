import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin that intercepts requests to /assets/ and /src/data/ and returns
 * a proper 404 when the file doesn't exist on disk.  Without this, Vite's SPA
 * HTML-fallback serves index.html for every unknown path (HTTP 200), which
 * causes Phaser's audio decoder to crash trying to parse HTML as audio data.
 */
function assetNotFoundPlugin() {
    return {
        name: 'asset-not-found',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                const url = req.url?.split('?')[0] ?? '';
                const isAsset = url.startsWith('/assets/') || url.startsWith('/src/data/');
                if (!isAsset) return next();

                const filePath = path.join(process.cwd(), decodeURIComponent(url));
                if (!fs.existsSync(filePath)) {
                    res.statusCode = 404;
                    res.end('Not Found');
                    return;
                }
                next();
            });
        },
    };
}

export default defineConfig({
    plugins: [assetNotFoundPlugin()],

    base: './',

    build: {
        // Suppress the "chunk too large" warning — Phaser is intentionally large.
        chunkSizeWarningLimit: 2500,
    },
});
