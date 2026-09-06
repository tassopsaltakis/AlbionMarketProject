import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base =
  process.env.PAGES_BASE_PATH ||
  (repository && !repository.endsWith('.github.io') ? `/${repository}/` : '/');
export default defineConfig({
  root: 'static',
  base,
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [
    react(),
    {
      name: 'market-catalog',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'items.json',
          source: fs.readFileSync(
            new URL('./data/items.json', import.meta.url),
            'utf8',
          ),
        });
        this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
        this.emitFile({
          type: 'asset',
          fileName: 'recipes.json',
          source: fs.readFileSync(
            new URL('./data/recipes.json', import.meta.url),
            'utf8',
          ),
        });
      },
    },
  ],
  build: {
    outDir: '../dist-pages',
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'charts',
              test: /node_modules.*(recharts|d3-|victory-vendor)/,
            },
            {
              name: 'interface',
              test: /node_modules.*(@base-ui|@floating-ui|cmdk)/,
            },
          ],
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
