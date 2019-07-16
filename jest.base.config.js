module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/test/**/*.test.js'],
  collectCoverage: true,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    '**/*.js',
    '**/*.jsx',
    '!**/node_modules/**',
    '!*.config.js',
    '!coverage/**',
    '!dist/test/**',
  ],
}
