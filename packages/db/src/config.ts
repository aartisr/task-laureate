/**
 * Configuration Management for Database Layer
 * 
 * Handles environment variables, connection pooling, and runtime configuration.
 * Supports multiple environments: development, staging, production, vercel.
 */

export type RepositoryType = 'memory' | 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'firebase';

export interface DatabaseConfig {
  // Repository type to use
  type: RepositoryType;

  // Connection settings
  databaseUrl?: string;

  // PostgreSQL specific
  postgres?: {
    // Connection pooling for serverless (PgBouncer or Vercel Postgres)
    // @see https://vercel.com/docs/storage/postgres/features/connection-pooling
    connectionLimit?: number;
    idleTimeout?: string | number;
    maxLifetime?: string | number;
    statement_timeout?: string; // e.g., "30s"
    connect_timeout?: string; // e.g., "10s"
  };

  // Logging
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';

  // Performance
  queryTimeout?: number; // ms
  batchSize?: number; // for bulk operations

  // Resilience
  retryAttempts?: number;
  retryDelayMs?: number;
  connectTimeoutMs?: number;
}

export interface DatabaseConfigOptions extends DatabaseConfig {
  environment?: 'development' | 'staging' | 'production' | 'vercel' | 'test';
}

/**
 * Load configuration from environment variables with defaults
 */
export function loadDatabaseConfig(
  overrides?: Partial<DatabaseConfigOptions>
): DatabaseConfig {
  const env = process.env.NODE_ENV || 'development';
  const repoType = (process.env.DB_TYPE || 'memory') as RepositoryType;
  const databaseUrl = process.env.DATABASE_URL;

  const defaults: Record<string, Partial<DatabaseConfig>> = {
    development: {
      type: 'memory',
      debug: true,
      logLevel: 'debug',
      retryAttempts: 3,
      retryDelayMs: 100,
      connectTimeoutMs: 5000,
    },
    test: {
      type: 'memory',
      debug: false,
      logLevel: 'error',
      retryAttempts: 1,
      retryDelayMs: 0,
      connectTimeoutMs: 1000,
    },
    staging: {
      type: 'postgres',
      debug: false,
      logLevel: 'warn',
      retryAttempts: 5,
      retryDelayMs: 500,
      connectTimeoutMs: 10000,
      postgres: {
        connectionLimit: 20,
        idleTimeout: '30m',
        maxLifetime: '1h',
        statement_timeout: '30s',
        connect_timeout: '10s',
      },
    },
    production: {
      type: 'postgres',
      debug: false,
      logLevel: 'warn',
      retryAttempts: 5,
      retryDelayMs: 1000,
      connectTimeoutMs: 15000,
      postgres: {
        connectionLimit: 15,
        idleTimeout: '30m',
        maxLifetime: '1h',
        statement_timeout: '30s',
        connect_timeout: '10s',
      },
    },
    vercel: {
      type: 'postgres',
      debug: false,
      logLevel: 'warn',
      retryAttempts: 3,
      retryDelayMs: 200,
      connectTimeoutMs: 10000,
      queryTimeout: 5000,
      postgres: {
        // Vercel Postgres connection pooling settings
        connectionLimit: 1, // Vercel serverless = 1 connection per function
        idleTimeout: '30s',
        maxLifetime: '5m',
        statement_timeout: '10s',
        connect_timeout: '5s',
      },
    },
  };

  const environment = overrides?.environment || env;
  const baseConfig = defaults[environment] || defaults.development;

  return {
    type: repoType || baseConfig.type || 'memory',
    databaseUrl: databaseUrl || overrides?.databaseUrl,
    debug: overrides?.debug ?? baseConfig.debug ?? false,
    logLevel: overrides?.logLevel ?? baseConfig.logLevel ?? 'warn',
    retryAttempts: overrides?.retryAttempts ?? baseConfig.retryAttempts ?? 3,
    retryDelayMs: overrides?.retryDelayMs ?? baseConfig.retryDelayMs ?? 100,
    connectTimeoutMs: overrides?.connectTimeoutMs ?? baseConfig.connectTimeoutMs ?? 10000,
    queryTimeout: overrides?.queryTimeout ?? baseConfig.queryTimeout ?? 30000,
    batchSize: overrides?.batchSize ?? 100,
    postgres: {
      connectionLimit: overrides?.postgres?.connectionLimit ?? baseConfig.postgres?.connectionLimit ?? 10,
      idleTimeout: overrides?.postgres?.idleTimeout ?? baseConfig.postgres?.idleTimeout ?? '30m',
      maxLifetime: overrides?.postgres?.maxLifetime ?? baseConfig.postgres?.maxLifetime ?? '1h',
      statement_timeout:
        overrides?.postgres?.statement_timeout ?? baseConfig.postgres?.statement_timeout ?? '30s',
      connect_timeout:
        overrides?.postgres?.connect_timeout ?? baseConfig.postgres?.connect_timeout ?? '10s',
    },
  };
}

/**
 * Validate database configuration
 * @throws Error if configuration is invalid
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.type) {
    throw new Error('Database type is required');
  }

  if (config.type === 'postgres' && !config.databaseUrl) {
    throw new Error(
      'DATABASE_URL is required for PostgreSQL. Set it in environment variables.'
    );
  }

  if (config.retryAttempts! < 0) {
    throw new Error('retryAttempts must be >= 0');
  }

  if (config.retryDelayMs! < 0) {
    throw new Error('retryDelayMs must be >= 0');
  }

  if (config.connectTimeoutMs! < 1000) {
    console.warn('connectTimeoutMs is very low (<1000ms), may cause connection timeouts');
  }
}
