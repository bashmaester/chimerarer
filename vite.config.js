import { defineConfig } from 'vite';
export default defineConfig({base: process.env.BASE_PATH || '/', server: { allowedHosts: ['.e2b.app'] }});
