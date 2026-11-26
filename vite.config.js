import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the same build works on the Docker server and on GitHub Pages (/nirhast/).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8080' } },
  test: { environment: 'node' },
});
