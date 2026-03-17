import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function copyLegacyRuntime() {
  const files = ['app.js', 'manifest.json', 'sw.js', 'icon-180.png', 'icon-512.png'];
  const directories = ['core', 'programs'];

  return {
    name: 'copy-legacy-runtime',
    closeBundle() {
      const rootDir = process.cwd();
      const distDir = path.resolve(rootDir, 'dist');

      directories.forEach((directory) => {
        fs.cpSync(path.resolve(rootDir, directory), path.resolve(distDir, directory), {
          recursive: true,
        });
      });

      files.forEach((file) => {
        fs.copyFileSync(path.resolve(rootDir, file), path.resolve(distDir, file));
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves this project from /ironforge/, so built asset URLs
  // need that prefix in production while local dev still runs from /.
  base: '/ironforge/',
  plugins: [react(), copyLegacyRuntime()],
  build: {
    // The vanilla shell remains the app entry. Vite only bundles module assets
    // that the existing index.html scripts into the page.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
