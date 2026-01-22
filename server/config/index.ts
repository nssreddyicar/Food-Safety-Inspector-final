/**
 * =============================================================================
 * FILE: server/config/index.ts
 * LAYER: CONFIGURATION & INFRASTRUCTURE (Layer 6)
 * =============================================================================
 * 
 * PURPOSE:
 * Centralizes application configuration and environment settings.
 * Provides type-safe access to configuration values.
 * 
 * WHAT THIS FILE MUST DO:
 * - Load and validate environment variables
 * - Provide sensible defaults for development
 * - Export typed configuration objects
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Contain domain rules or business logic
 * - Perform database operations
 * - Handle HTTP requests
 * 
 * DEPENDENT SYSTEMS:
 * - server/index.ts uses this for app bootstrap
 * - All layers may import configuration values
 * =============================================================================
 */

/**
 * Server configuration.
 */
export const serverConfig = {
  /**
   * Port number for the Express server.
   * 
   * WHY: Configurable for different environments.
   * DEFAULT: 5000 for Replit compatibility.
   */
  port: parseInt(process.env.PORT || "5000", 10),

  /**
   * Node environment.
   * 
   * WHY: Enables environment-specific behavior.
   * DEFAULT: "development".
   */
  nodeEnv: process.env.NODE_ENV || "development",

  /**
   * Whether the app is in production mode.
   */
  isProduction: process.env.NODE_ENV === "production",

  /**
   * Whether the app is in development mode.
   */
  isDevelopment: process.env.NODE_ENV !== "production",
};

/**
 * Admin panel configuration.
 * 
 * WHY: Configurable admin credentials.
 * RULES: Should use environment variables in production.
 */
export const adminConfig = {
  /**
   * Admin username.
   * DEFAULT: "superadmin" (change in production).
   */
  username: process.env.ADMIN_USERNAME || "superadmin",

  /**
   * Admin password.
   * DEFAULT: "Admin@123" (change in production).
   */
  password: process.env.ADMIN_PASSWORD || "Admin@123",

  /**
   * Session expiry in milliseconds.
   * DEFAULT: 24 hours.
   */
  sessionExpiryMs: parseInt(process.env.ADMIN_SESSION_EXPIRY_MS || String(24 * 60 * 60 * 1000), 10),
};

/**
 * Database configuration.
 */
export const databaseConfig = {
  /**
   * Database connection URL.
   * REQUIRED: Must be set in environment.
   */
  url: process.env.DATABASE_URL || "",

  /**
   * Whether database URL is configured.
   */
  isConfigured: !!process.env.DATABASE_URL,
};

/**
 * Sample workflow configuration.
 * 
 * WHY: Configurable workflow settings.
 * RULES: These should eventually come from system_settings table.
 */
export const sampleConfig = {
  /**
   * Lab report deadline in days from dispatch.
   * DEFAULT: 14 days per FSSAI regulations.
   */
  labReportDeadlineDays: parseInt(process.env.LAB_REPORT_DEADLINE_DAYS || "14", 10),

  /**
   * Hours after which sample editing is frozen.
   * DEFAULT: 48 hours.
   */
  editFreezeHours: parseInt(process.env.SAMPLE_EDIT_FREEZE_HOURS || "48", 10),
};

/**
 * Validates required configuration.
 * 
 * WHY: Fail fast if critical config is missing.
 * WHO: Called during app bootstrap.
 * RESULT: Throws if validation fails.
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!databaseConfig.isConfigured) {
    errors.push("DATABASE_URL environment variable is required");
  }

  if (serverConfig.isProduction) {
    if (adminConfig.password === "Admin@123") {
      console.warn("WARNING: Using default admin password in production!");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join("\n")}`);
  }
}

/**
 * Full application configuration.
 */
export const config = {
  server: serverConfig,
  admin: adminConfig,
  database: databaseConfig,
  sample: sampleConfig,
  validate: validateConfig,
};

export default config;
