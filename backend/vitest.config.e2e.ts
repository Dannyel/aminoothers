import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/support/load-test-env.ts'],
    // Las pruebas e2e comparten una base de datos real: se ejecutan en serie.
    fileParallelism: false,
  },
});
