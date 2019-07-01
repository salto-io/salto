module.exports = {
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.json',
    },
  },
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testMatch: ['<rootDir>/test/**/*.test.(ts|js)'],
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  testEnvironment: 'node',
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    '**/*.[jt]s',
    '**/*.[jt]sx',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!<rootDir>/*.config.js',
    '!<rootDir>/(test|dist|coverage)/**',
    '!<rootDir>/src/parser/wasm_exec.js', // External source file
  ],
  coverageThreshold: {
    // Slowly start increasing here, never decrease!
    global: {
      branches: 90,
      functions: 90,
      lines: 85,
      statements: 90,
    },
  },
}
