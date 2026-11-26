import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// `vite --mode demo` swaps the real chain client for src/contract.demo.ts:
// a simulated wallet + in-browser state, used for the launch video and offline demos.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'demo'
    ? [{
        name: 'sokorescue-demo-contract',
        enforce: 'pre' as const,
        resolveId(source: string, importer?: string) {
          if (source === './contract' && importer && /src[\\/]main\.ts$/.test(importer)) {
            return fileURLToPath(new URL('./src/contract.demo.ts', import.meta.url));
          }
          return null;
        },
      }]
    : [],
  test: {
    environment: 'jsdom',
  },
}));
