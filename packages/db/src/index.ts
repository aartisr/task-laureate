/**
 * Task-Laureate Database Layer
 * 
 * Generic, plug-and-play persistence layer supporting multiple databases.
 * Defaults to in-memory with seed data. Swappable to PostgreSQL for production.
 * 
 * @example
 * // Default in-memory (development)
 * const db = await createRepository();
 * 
 * @example
 * // PostgreSQL (production)
 * const db = await createRepository({
 *   type: 'postgres',
 *   databaseUrl: process.env.DATABASE_URL
 * });
 */

// Core domain
export * from './repository';
export * from './errors';
export * from './config';

// Adapters
export { InMemoryRepository, InMemoryRepositoryFactory } from './memory';
export { PostgresRepository, PostgresRepositoryFactory } from './postgres-enhanced';

// Dependency Injection & Service Management
export * from './di';

// Plugin System & Middleware
export * from './plugins';

// Builder Pattern & Fluent API
export * from './builders';

// Composition & Decorators
export * from './composition';

// Integration examples
export * from './integration-examples';

import { IRepository, RepositoryRegistry } from './repository';
import { InMemoryRepositoryFactory } from './memory';
import { PostgresRepositoryFactory } from './postgres-enhanced';
import { RepositoryConfig } from './repository';
import { loadDatabaseConfig, validateDatabaseConfig, DatabaseConfig } from './config';
import { Logger } from './errors';

// ============================================================================
// Initialize Registry with All Adapters
// ============================================================================

function initializeRegistry(): void {
  // In-memory adapter (default)
  RepositoryRegistry.register('memory', new InMemoryRepositoryFactory());

  // PostgreSQL adapter
  RepositoryRegistry.register('postgres', new PostgresRepositoryFactory());

  // TODO: Add more adapters as needed
  // RepositoryRegistry.register('mysql', new MySQLRepositoryFactory());
  // RepositoryRegistry.register('mongodb', new MongoDBRepositoryFactory());
  // RepositoryRegistry.register('firebase', new FirebaseRepositoryFactory());
}

// Initialize on module load
initializeRegistry();

// ============================================================================
// Factory Function (Main Entry Point)
// ============================================================================

let sharedRepository: IRepository | null = null;
let logger: Logger | null = null;

/**
 * Create or get a repository instance
 * 
 * Defaults to in-memory for development/testing.
 * Use environment variables or explicit config for production.
 * 
 * @param config - Repository configuration (optional)
 * @returns Repository instance
 * 
 * @example
 * // Default in-memory
 * const repo = await createRepository();
 * 
 * @example
 * // PostgreSQL with custom config
 * const repo = await createRepository({
 *   type: 'postgres',
 *   databaseUrl: process.env.DATABASE_URL
 * });
 * 
 * @example
 * // Production with Vercel Postgres
 * const repo = await createRepository({
 *   type: 'postgres',
 *   databaseUrl: process.env.DATABASE_URL,
 *   postgres: {
 *     connectionLimit: 1,
 *     statement_timeout: '10s'
 *   }
 * });
 */
export async function createRepository(
  overrideConfig?: Partial<RepositoryConfig>
): Promise<IRepository> {
  // Load configuration from environment + overrides
  const dbConfig = loadDatabaseConfig(overrideConfig);
  validateDatabaseConfig(dbConfig);

  if (!logger) {
    logger = new Logger(dbConfig.logLevel);
  }

  // Create or reuse shared repository
  if (!sharedRepository) {
    logger.info(`Creating ${dbConfig.type} repository`);
    sharedRepository = await RepositoryRegistry.create(dbConfig);

    // Connect for database types that require it
    if (dbConfig.type === 'postgres') {
      try {
        await sharedRepository.connect();
      } catch (error) {
        logger.error(
          'Failed to connect to database',
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    }
  }

  return sharedRepository;
}

/**
 * Get the current repository instance
 * 
 * @returns Repository instance, or null if not initialized
 */
export function getRepository(): IRepository | null {
  return sharedRepository;
}

/**
 * Close the repository connection
 * Call this on application shutdown for database adapters.
 */
export async function closeRepository(): Promise<void> {
  if (sharedRepository && logger) {
    logger.info('Closing repository connection');
    await sharedRepository.disconnect();
    sharedRepository = null;
  }
}

/**
 * Create a new isolated repository (for testing)
 * 
 * Each call creates a fresh instance without shared state.
 * Useful for testing and parallel operations.
 */
export async function createIsolatedRepository(
  config?: Partial<RepositoryConfig>
): Promise<IRepository> {
  const dbConfig = loadDatabaseConfig(config);
  validateDatabaseConfig(dbConfig);

  const repo = await RepositoryRegistry.create(dbConfig);

  if (dbConfig.type === 'postgres') {
    await repo.connect();
  }

  return repo;
}

/**
 * Health check for the repository
 */
export async function checkRepositoryHealth(): Promise<boolean> {
  const repo = sharedRepository;
  if (!repo) {
    return false;
  }

  try {
    return await repo.healthCheck();
  } catch {
    return false;
  }
}

// ============================================================================
// Module Summary
// ============================================================================

/**
 * # Task-Laureate Database Layer
 * 
 * ## Features
 * - **Multiple adapters**: Memory, PostgreSQL (with more coming)
 * - **Plug-and-play**: Switch implementations without code changes
 * - **Production-ready**: Vercel Postgres optimized, connection pooling, retry logic
 * - **Resilient**: Circuit breaker, timeouts, exponential backoff
 * - **Type-safe**: Full TypeScript support with strict typing
 * - **Zero setup**: Defaults to in-memory with seed data
 * 
 * ## Quick Start
 * 
 * ```typescript
 * // Development (in-memory)
 * import { createRepository } from '@task-laureate/db';
 * const db = await createRepository();
 * const lists = await db.listLists();
 * 
 * // Production (PostgreSQL)
 * const db = await createRepository({
 *   type: 'postgres',
 *   databaseUrl: process.env.DATABASE_URL
 * });
 * ```
 * 
 * ## Configuration
 * 
 * Environment variables:
 * - `DB_TYPE`: Repository type (memory|postgres) - default: memory
 * - `DATABASE_URL`: Connection string for postgres
 * - `NODE_ENV`: development|staging|production|vercel
 * 
 * ## Adapters
 * 
 * ### InMemoryRepository
 * - Development/testing
 * - No setup required
 * - Seed data included
 * - Clears on refresh
 * 
 * ### PostgresRepository
 * - Production use
 * - Connection pooling for serverless
 * - Vercel Postgres ready
 * - Automatic retry with exponential backoff
 * - Circuit breaker for resilience
 */
