import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({command, mode}) => {
    const env = loadEnv(mode, process.cwd())
    return {
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'resources/js'),
            },
        },
        define: {
            SHOPIFY_API_KEY: JSON.stringify(env.VITE_SHOPIFY_API_KEY),
        },
        server: {
            host: "0.0.0.0",
            hmr: {
                protocol: "ws",
                host: "localhost"
            }
        },
        optimizeDeps: {
            include: ['some-lib'],
            esbuildOptions: { target: 'esnext' },
        },
        build: {
            target: 'esnext'
        },
        plugins: [
            laravel({
                input: [
                    'resources/js/app.js',
                    'resources/css/app.css',
                ],
                refresh: true,
            }),
            react(),
        ],
    }
});