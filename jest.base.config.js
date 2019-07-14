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
  transformIgnorePatterns: [
    '[.]d[.]ts',
  ],
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '<rootDir>/dist/'
  ],
  preset: 'ts-jest',
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    '**/*.[jt]s',
    '**/*.[jt]sx',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!*.config.js',
    '!(test|dist|coverage)/**',
  ],
}
