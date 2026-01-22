/**
 * Validation constants for string field lengths
 */
export const MAX_LENGTHS = {
  NAME: 255,
  DESCRIPTION: 1000,
  URL: 2048,
  FLOW_ID: 255,
  BASE_PATH: 2048,
  TOKEN: 10000,
  PASSWORD: 128,
  EMAIL: 320,
  QUESTION: 5000,
  ANSWER: 10000,
  SECRET: 512,
  HEADER_KEY: 255,
  HEADER_VALUE: 4096,
  ERROR_MESSAGE: 5000,
  CRON_EXPRESSION: 100,
  COLOR: 7, // #RRGGBB format
} as const;
