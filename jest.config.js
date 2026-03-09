module.exports = {
  // Transpile TypeScript and JavaScript files using babel-jest
  transform: {
    '^.+\\.[t|j]sx?$': 'babel-jest',
  },

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/src/**/*.test.ts',
  ],

  // Module path aliases (mirrors tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Test environment
  testEnvironment: 'node',

  // Coverage configuration (commented out - enable when needed)
  // collectCoverageFrom: [
  //   'src/**/*.ts',
  //   '!src/generated/**',
  //   '!src/**/*.test.ts',
  // ],
};
