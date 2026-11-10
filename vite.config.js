import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  worker: { format: 'es' },
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  build: { target: 'es2022', rollupOptions: { input: { main: resolve('index.html'), motion: resolve('motion.html') } } }
});
