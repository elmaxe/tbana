import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The site root is the working directory, so the Pages workflow can build a pull request's
// checkout with this (main's) config: see .github/scripts/assemble-site.sh.
const root = process.cwd();

export default defineConfig({
  root,
  // relative URLs: the same build is served at the site root and under pr/<number>/
  base: './',
  // an inline PostCSS config stops Vite from loading (and running) one from the checkout
  css: { postcss: {} },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: { main: resolve(root, 'index.html'), trains: resolve(root, 'trains.html') },
      // three and the train models are shared by both pages
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules\/three\// },
            { name: 'rolling-stock', test: /src\/rolling-stock\// },
          ],
        },
      },
    },
  },
});
