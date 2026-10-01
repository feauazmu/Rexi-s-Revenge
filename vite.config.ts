import { defineConfig } from 'vite';

// GitHub Pages serves the project at https://feauazmu.github.io/Rexi-s-Revenge/.
// The same base is used by `vite dev` and `vite preview` so every mode matches production.
export default defineConfig({
  base: '/Rexi-s-Revenge/',
  build: {
    target: 'es2022',
  },
});
