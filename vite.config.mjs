import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/',
  publicDir: 'public',
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('\\react\\') ||
              id.includes('/react-dom/') ||
              id.includes('\\react-dom\\') ||
              id.includes('/react-router-dom/') ||
              id.includes('\\react-router-dom\\') ||
              id.includes('/scheduler/') ||
              id.includes('\\scheduler\\')
            ) {
              return 'react-vendor';
            }
            if (
              id.includes('/@supabase/') ||
              id.includes('\\@supabase\\')
            ) {
              return 'supabase-vendor';
            }
            return 'vendor';
          }

          if (
            id.includes('/src/programs/') ||
            id.includes('\\src\\programs\\')
          ) {
            return 'programs';
          }

          return undefined;
        },
      },
    },
  },
});
