import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    open: false,
  },
  build: {
    rollupOptions: {
      output: {
        // SheetJS and dxf-parser are only needed once the user actually imports
        // a spreadsheet or opens a drawing. Splitting them keeps the initial
        // calculation UI small instead of shipping ~500 kB of parsers up front.
        manualChunks: {
          xlsx: ['xlsx'],
          dxf: ['dxf-parser'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
