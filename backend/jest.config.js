module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/app.js', // Exclude main app file from coverage
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true
};
