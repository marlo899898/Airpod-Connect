import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: 'development-csp',
    transformIndexHtml: { order: 'pre', handler: html => command === 'serve' ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/, '') : html },
  }],
  base: './', server: { port: 5173, strictPort: true },
}));
