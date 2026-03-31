import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const BUILD_STAMP = Date.now().toString(36);

function withCacheBust(scriptTag, buildStamp) {
  return scriptTag.replace(/src=(["'])([^"']+)\1/, (_match, quote, src) => {
    const separator = src.includes('?') ? '&' : '?';
    return `src=${quote}${src}${separator}v=${buildStamp}${quote}`;
  });
}

function preserveClassicScripts(buildStamp) {
  const marker = '<!--ironforge-legacy-scripts-->';
  const scriptPattern =
    /[ \t]*<script\b(?:(?!type=["']module["'])[^>])*\ssrc=["'][^"']+["'][^>]*><\/script>\s*/g;
  let isBuild = false;

  return {
    name: 'preserve-classic-scripts',
    apply: 'build',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!isBuild) return html;
        const withoutClassicScripts = html.replace(scriptPattern, '');
        if (withoutClassicScripts === html) return html;
        return withoutClassicScripts.replace(
          '</body>',
          `    ${marker}\n  </body>`
        );
      },
    },
    closeBundle() {
      if (!isBuild) return;
      const distIndexPath = path.resolve(process.cwd(), 'dist', 'index.html');
      const sourceIndexPath = path.resolve(process.cwd(), 'index.html');
      if (!fs.existsSync(distIndexPath)) return;
      if (!fs.existsSync(sourceIndexPath)) return;
      // Re-read the source HTML here so the built file always gets the current
      // classic script list instead of whatever Vite kept from a prior pass.
      const sourceHtml = fs.readFileSync(sourceIndexPath, 'utf8');
      const matches = sourceHtml.match(scriptPattern) || [];
      if (!matches.length) return;
      const preservedScripts = matches
        .map((script) => withCacheBust(script.trim(), buildStamp))
        .join('\n    ');
      const builtHtml = fs.readFileSync(distIndexPath, 'utf8');
      fs.writeFileSync(
        distIndexPath,
        builtHtml.replace(marker, preservedScripts),
        'utf8'
      );
    },
  };
}

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
  base: '/',
  plugins: [
    preserveClassicScripts(BUILD_STAMP),
    tailwindcss(),
    react(),
    copyLegacyRuntime(),
  ],
  build: {
    // The vanilla shell remains the app entry. Vite only bundles module assets
    // that the existing index.html scripts into the page.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router-vendor';
          if (id.includes('react-dom') || id.includes('react')) {
            return 'react-vendor';
          }
          return 'vendor';
        },
      },
    },
  },
});
