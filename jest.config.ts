import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  preset: "ts-jest",
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  globalSetup: "<rootDir>/jest.globalSetup.ts",
  globalTeardown: "<rootDir>/jest.globalTeardown.ts",
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    "^@opencause/(.*)$": "<rootDir>/packages/$1/src",
  },
  collectCoverageFrom: [
    "apps/**/*.ts",
    "packages/**/*.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/dist/**",
    "!**/*.test.ts",
    "!**/*.spec.ts",
  ],
};

export default config;






