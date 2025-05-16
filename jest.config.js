/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.ts?(x)", "**/?(*.)+(spec|test).ts?(x)"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        isolatedModules: true,
      },
    ],
  },
  testTimeout: 10000, // Increase test timeout to 10 seconds
  setupFilesAfterEnv: ["./src/tests/setup.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/src/tests/"],
};
