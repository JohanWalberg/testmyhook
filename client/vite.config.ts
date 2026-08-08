import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      // Webhook slugs (e.g. /tiny-snow-27/orders) go straight to the receiver.
      '^/[a-z]+-[a-z]+-[0-9]{2}(/.*)?$': 'http://localhost:8787'
    }
  }
});
