module.exports = {
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.json'
    }
  },
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testMatch: ['<rootDir>/test/**/*.test.(ts|js)'],
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  testEnvironment: 'node',
  preset: 'ts-jest'
}
