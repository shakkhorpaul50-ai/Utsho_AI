
/**
 * Augment the existing NodeJS.ProcessEnv to include the API_KEY.
 * This ensures process.env.API_KEY is typed correctly throughout the application.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
