module.exports = {
  transform: {
    '^.+\\.[t|j]sx?$': 'babel-jest',
  },
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/src/**/*.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/generated/**',
    '!src/**/*.test.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
  },
};
