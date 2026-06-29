import { defineConfig } from 'vitest/config';

/**
 * Configuración de Vitest — tests unitarios de las funciones PURAS de la app
 * (sin BD, sin red, sin DOM). Genera salidas que consume el pipeline de CI:
 *   - test-results/junit.xml          → pestaña "Tests" (PublishTestResults@2)
 *   - coverage/cobertura-coverage.xml → pestaña "Code Coverage" (PublishCodeCoverageResults@2)
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default', ['junit', { suiteName: 'Focus unit tests' }]],
    outputFile: { junit: './test-results/junit.xml' },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'cobertura', 'json-summary', 'json', 'html'],
      // Acotado a propósito a las utilidades puras que SÍ tienen tests. Amplía
      // este `include` a medida que añadas cobertura (queries, componentes…).
      include: [
        'src/lib/csv.ts',
        'src/lib/sql.ts',
        'src/lib/username.ts',
        'src/lib/spain.ts',
      ],
    },
  },
});
