# @task-laureate/db

Generic, plug-and-play database persistence layer for Task-Laureate. Supports multiple database engines with zero setup required.

## Features

✨ **Multiple Adapters**
- In-Memory (default, development)
- PostgreSQL (production, Vercel optimized)
- Extensible to MySQL, MongoDB, SQLite, Firebase

🚀 **Production-Ready**
- Connection pooling for serverless (Vercel, AWS Lambda, Azure Functions)
- Automatic retry with exponential backoff
- Circuit breaker for resilience
- Query timeout protection
- Comprehensive error handling

🔌 **Plug-and-Play**
- Zero configuration required (in-memory by default)
- Swap implementations without code changes
- Environment-driven configuration
- Easy to extend with new adapters

🛡️ **Type-Safe**
- Full TypeScript support
- Strict typing throughout
- Comprehensive error types
- Factory pattern for dependency injection

## Quick Start

### Most Pluggable Way - Builder Pattern

```typescript
import { builders } from '@task-laureate/db';

// Fluent, chainable API - no argument ordering issues
const app = await builders
  .app()
  .withPostgresDatabase(process.env.DATABASE_URL)
  .withLogging('debug')
  .withCaching(30000)
  .withValidation()
  .withErrorRecovery(5)
  .withPerformanceMonitoring()
  .build();

const db = app.getRepository();
```

### Traditional Factory Method

```typescript
import { createRepository } from '@task-laureate/db';

const db = await createRepository({
  type: 'postgres',
  databaseUrl: process.env.DATABASE_URL
});
```

### Repository Builder

```typescript
import { builders } from '@task-laureate/db';

const db = await builders
  .repository()
  .postgres(process.env.DATABASE_URL)
  .withDebug(true)
  .withRetries(5)
  .build();
```

## Quick Start

```typescript
import { createRepository } from '@task-laureate/db';

// Zero configuration - uses in-memory with seed data
const db = await createRepository();

// Use it
const lists = await db.listLists();
const dashboard = await db.getDashboard();
await db.createTask({ listId: 'list_1', title: 'New Task' });
```

Data is cleared on every page refresh. Perfect for development and testing.

### Production (PostgreSQL)

```typescript
const db = await createRepository({
  type: 'postgres',
  databaseUrl: process.env.DATABASE_URL
});

// All operations are identical - same interface
const lists = await db.listLists();
```

## Dependency Injection & Service Management

### DI Container

```typescript
import { DIContainer, ServiceKeys } from '@task-laureate/db';

const container = new DIContainer();

// Register singleton
container.registerInstance(ServiceKeys.Logger, logger);

// Register factory
container.registerFactory(
  ServiceKeys.Repository,
  async () => createRepository(),
  { scope: 'singleton' }
);

// Resolve
const logger = await container.resolve(ServiceKeys.Logger);
const db = await container.resolve(ServiceKeys.Repository);
```

### Service Locator

```typescript
import { ServiceLocator } from '@task-laureate/db';

// Register globally
ServiceLocator.register('userService', async () => new UserService());

// Resolve anywhere
const userService = await ServiceLocator.resolve('userService');
```

## Plugin System & Middleware

### Register Plugins

```typescript
import { builders } from '@task-laureate/db';

class AuditPlugin {
  name = 'audit';
  
  async onLoad() {
    console.log('Audit tracking enabled');
  }
}

const app = await builders
  .app()
  .withPlugin(new AuditPlugin())
  .build();
```

### Add Middleware

```typescript
import {
  builders,
  LoggingMiddleware,
  CachingMiddleware,
  PerformanceMiddleware
} from '@task-laureate/db';

const app = await builders
  .app()
  .withMiddleware(new LoggingMiddleware())
  .withMiddleware(new CachingMiddleware(5000))
  .withMiddleware(new PerformanceMiddleware())
  .build();
```

### Event System

```typescript
const pluginManager = app.getPluginManager();

// Listen to events
pluginManager.on('plugin:loaded', (name) => {
  console.log('Plugin loaded:', name);
});

pluginManager.on('plugin:unloaded', (name) => {
  console.log('Plugin unloaded:', name);
});
```

### Hook System

```typescript
pluginManager.registerHook('beforeShutdown', async () => {
  console.log('Running cleanup');
});

// Execute hook
await pluginManager.executeHook('beforeShutdown');
```

## Configuration

### Environment Variables

```bash
# Repository type (default: memory)
DB_TYPE=postgres

# PostgreSQL connection string (required for postgres type)
DATABASE_URL=postgresql://user:password@host:5432/database

# Optional: Environment preset (development|staging|production|vercel)
NODE_ENV=production
```

### Programmatic Configuration

```typescript
const db = await createRepository({
  type: 'postgres',
  databaseUrl: process.env.DATABASE_URL,
  debug: false,
  logLevel: 'warn',
  retryAttempts: 5,
  retryDelayMs: 500,
  postgres: {
    connectionLimit: 1, // Vercel serverless
    statement_timeout: '10s',
    connect_timeout: '5s'
  }
});
```

## API Reference

### Core Operations

#### Lists

```typescript
// Get all lists
const lists = await db.listLists();
const activeLists = await db.listLists({ excludeArchived: true });

// Get single list
const list = await db.getList('list_id');

// Create list
const newList = await db.createList({
  title: 'My Project',
  description: 'Description',
  templateId: 'template_id'
});

// Update list
await db.updateList('list_id', { title: 'Updated Title' });

// Delete list (soft delete by default)
await db.deleteList('list_id');
await db.deleteList('list_id', true); // hard delete
```

#### Tasks

```typescript
// List tasks in a list
const tasks = await db.listTasks('list_id');
const doneTasks = await db.listTasks('list_id', { status: 'DONE' });

// Get single task
const task = await db.getTask('task_id');

// Create task
const newTask = await db.createTask({
  listId: 'list_id',
  title: 'Task Title',
  notes: 'Details',
  priority: 'HIGH',
  dueDate: new Date('2024-02-01'),
  tags: ['urgent', 'review']
});

// Update task
await db.updateTask('task_id', { status: 'DOING' });

// Mark as complete
await db.completeTask('task_id');

// Delete task
await db.deleteTask('task_id');

// Reorder tasks
await db.reorderTasks('list_id', [
  { id: 'task_1', order: 0 },
  { id: 'task_2', order: 1 }
]);
```

#### Dashboard

```typescript
// Get complete dashboard data
const dashboard = await db.getDashboard();
// Returns: {
//   summary: { totalLists, totalTasks, completedTasks, overdueTasks },
//   lists: [{ ...list, tasks: [...] }]
// }
```

#### Search

```typescript
// Full-text search across tasks
const results = await db.searchTasks('keyword', { listId: 'list_id' });
```

#### Activity Log

```typescript
// Get activity events
const events = await db.getActivity();
const listEvents = await db.getActivity({ entityId: 'list_id' });

// Record activity
await db.recordActivity({
  entityType: 'task',
  entityId: 'task_id',
  action: 'completed',
  metadata: { status: 'DONE' }
});
```

#### Templates

```typescript
// List templates
const templates = await db.listTemplates();

// Get single template
const template = await db.getTemplate('template_id');

// Create template
const newTemplate = await db.createTemplate({
  title: 'Project Template',
  description: 'Standard project setup',
  listDefaults: { status: 'ACTIVE' },
  taskDefaults: [
    { title: 'Planning', priority: 'HIGH' },
    { title: 'Execution', priority: 'MEDIUM' }
  ]
});
```

#### Transactions

```typescript
// Execute multiple operations atomically
await db.transaction(async (trx) => {
  await trx.createList({ title: 'List 1' });
  await trx.createList({ title: 'List 2' });
  // All-or-nothing: both succeed or both fail
});
```

## Error Handling

```typescript
import {
  createRepository,
  RepositoryError,
  ConnectionError,
  QueryError,
  NotFoundError,
  ValidationError,
  TimeoutError
} from '@task-laureate/db';

try {
  const db = await createRepository();
  await db.createList({ title: 'New List' });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Database connection failed:', error.message);
  } else if (error instanceof QueryError) {
    console.error('Query failed:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
  }
}
```

## Resilience Features

### Automatic Retry

Operations are retried up to 3 times (configurable) with exponential backoff:
- Delay: 100ms → 200ms → 400ms (default)
- Customizable via `retryAttempts` and `retryDelayMs`

### Circuit Breaker

Prevents cascading failures:
- Opens after 5 consecutive failures
- Auto-resets after 60 seconds
- Configurable thresholds

### Query Timeout

Prevents hanging queries:
- Default: 30 seconds
- Vercel: 10 seconds
- Customizable via `queryTimeout`

### Connection Health

```typescript
const isHealthy = await db.healthCheck();
```

## Vercel Deployment

### Setup

1. Create PostgreSQL database (Vercel Postgres recommended)
2. Set `DATABASE_URL` environment variable
3. No code changes needed - uses production config automatically

```bash
# Vercel environment
vercel env add DATABASE_URL postgresql://...
```

### Configuration

The library auto-configures for Vercel:
- Single connection limit (serverless requirement)
- 5-second statement timeout
- 30-second idle timeout
- Automatic retry with backoff

```typescript
// NODE_ENV=production auto-enables Vercel optimizations
const db = await createRepository();
```

## Testing

### Isolated Repositories

```typescript
import { createIsolatedRepository } from '@task-laureate/db';

// Each test gets a fresh in-memory instance
const testDb = await createIsolatedRepository({ type: 'memory' });
```

### Mock Data

In-memory adapter includes seed data:
- 2 lists (Launch, Operations)
- 4 tasks with full properties
- Activity events
- Templates

Customize seed data by extending `InMemoryRepository`.

## Extending with New Adapters

### Create a New Adapter

```typescript
import { IRepository, IRepositoryFactory, RepositoryConfig } from '@task-laureate/db';

class MyDatabaseFactory implements IRepositoryFactory {
  async createRepository(config: RepositoryConfig): Promise<IRepository> {
    return new MyDatabaseRepository(config);
  }
}

class MyDatabaseRepository implements IRepository {
  async connect(): Promise<void> { /* ... */ }
  async disconnect(): Promise<void> { /* ... */ }
  async healthCheck(): Promise<boolean> { /* ... */ }
  
  // Implement all IRepository methods...
}
```

### Register the Adapter

```typescript
import { RepositoryRegistry } from '@task-laureate/db';

RepositoryRegistry.register('mydb', new MyDatabaseFactory());

// Now usable
const db = await createRepository({ type: 'mydb' });
```

## Performance Tips

1. **Use in-memory for development** - No database overhead
2. **Enable connection pooling** - Critical for serverless
3. **Set appropriate timeouts** - Prevent hanging queries
4. **Batch operations** - Use transactions for multiple changes
5. **Monitor activity log** - Track slow operations

## Troubleshooting

### Connection Refused

```
Error: DATABASE_URL not provided and not set in environment
```

**Solution**: Set `DATABASE_URL` environment variable for PostgreSQL

### Connection Timeout

```
Error: Connection timeout after 10000ms
```

**Solution**: Increase `connectTimeoutMs` or check database availability

### Query Timeout

```
Error: Query timeout after 30000ms
```

**Solution**: Increase `queryTimeout` or optimize slow queries

### Circuit Breaker Open

```
Error: Circuit breaker is OPEN - service unavailable
```

**Solution**: Wait 60 seconds or check database health

## Functional Composition Utilities

### Function Composition

```typescript
import {
  compose,
  pipe,
  memoizeAsync,
  retryAsync,
  debounceAsync,
  throttleAsync,
  withTimeout,
  withFallback
} from '@task-laureate/db';

// Compose functions (right-to-left)
const process = compose(transform, validate, parse);

// Pipe functions (left-to-right)
const process = pipe(parse, validate, transform);

// Memoize with TTL
const cachedLoad = memoizeAsync(loadData, 5000);

// Retry with exponential backoff
const result = await retryAsync(unstableOp, 3, 100);

// Timeout protection
const safe = withTimeout(slowOp, 5000);

// Fallback value
const safe = withFallback(risky, 'defaultValue');
```

## Decorators

### Method Decorators

```typescript
import { Memoize, Retry, Timeout, Log } from '@task-laureate/db';

class UserService {
  @Memoize()
  @Timeout(5000)
  @Retry(3)
  @Log()
  async getUser(id: string) {
    // Implementation
  }
}
```

## Troubleshooting

## Architecture & Design Patterns

```
┌─────────────────────────────────────────────────────────────┐
│         Application Code                                    │
├─────────────────────────────────────────────────────────────┤
│  Builder Pattern (ApplicationBuilder, RepositoryBuilder)    │
├─────────────────────────────────────────────────────────────┤
│  Plugin System (PluginManager, Middleware Chain)            │
│  ├─ EventBus (Observer Pattern)                             │
│  ├─ HookManager (Strategy Pattern)                          │
│  └─ MiddlewareChain (Pipeline Pattern)                      │
├─────────────────────────────────────────────────────────────┤
│  DI Container & Service Locator                             │
│  ├─ Singleton services                                      │
│  ├─ Factory functions                                       │
│  └─ Lazy initialization                                     │
├─────────────────────────────────────────────────────────────┤
│  IRepository Interface (Adapter Pattern)                    │
├─────────────────────────────────────────────────────────────┤
│  Concrete Adapters (pluggable implementations)              │
│  ├─ InMemoryRepository (dev/test)                           │
│  ├─ PostgresRepository (production, Vercel-ready)           │
│  ├─ MySQLRepository (future)                                │
│  └─ ...more adapters                                        │
├─────────────────────────────────────────────────────────────┤
│  Middleware Stack (Composition Pattern)                     │
│  ├─ Logging (cross-cutting concern)                         │
│  ├─ Caching (memoization)                                   │
│  ├─ Validation (input sanitization)                         │
│  ├─ Error Recovery (retry logic)                            │
│  └─ Performance Monitoring (metrics)                        │
├─────────────────────────────────────────────────────────────┤
│  Database Engines                                           │
│  ├─ JavaScript Maps (memory)                                │
│  ├─ PostgreSQL (Vercel Postgres, connection pooling)        │
│  └─ ...more engines                                         │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Patterns

#### 1. **Builder Pattern** (Most Pluggable)
Fluent, chainable API for configuration:

```typescript
// Readable, flexible, no argument order issues
const app = await builders
  .app()
  .withPostgresDatabase(process.env.DATABASE_URL)
  .withLogging('debug')
  .withCaching(30000)
  .withErrorRecovery(5)
  .withPlugin(customPlugin)
  .build();
```

#### 2. **Dependency Injection Container**
Centralized service management with lifetimes:

```typescript
const container = new DIContainer();

// Register singleton
container.registerInstance('logger', logger);

// Register factory (transient)
container.registerFactory('repo', () => createRepository());

// Resolve
const logger = await container.resolve('logger');
```

#### 3. **Plugin System**
Extend functionality without code changes:

```typescript
class MyPlugin implements IPlugin {
  name = 'my-plugin';
  
  async onLoad() {
    console.log('Plugin loaded');
  }
}

const app = await builders.app()
  .withPlugin(new MyPlugin())
  .build();
```

#### 4. **Middleware Chain**
Compose cross-cutting concerns:

```typescript
pluginManager
  .useMiddleware(new LoggingMiddleware())
  .useMiddleware(new CachingMiddleware())
  .useMiddleware(new ValidationMiddleware());
```

#### 5. **Repository Pattern**
Swappable data access abstraction:

```typescript
// Same interface, different implementations
const db = await builders.repository()
  .postgres(databaseUrl)
  .build();

// Use it the same way
const lists = await db.listLists();
```

#### 6. **Adapter Pattern**
Runtime implementation switching:

```typescript
// Switch via environment variable
const repo = await createRepository({
  type: process.env.DB_TYPE // 'memory' or 'postgres'
});
```

#### 7. **Factory Pattern**
Deferred object creation:

```typescript
// Factory creates instances on demand
container.registerFactory('database', async () => {
  return createRepository({ type: 'postgres' });
}, { scope: 'singleton' });

// Lazy initialization
const db = await container.resolve('database');
```

#### 8. **Observer Pattern**
Event-driven architecture:

```typescript
const eventBus = new EventBus();
eventBus.on('list:created', (list) => console.log('List created:', list));
eventBus.emit('list:created', myList);
```

#### 9. **Decorator Pattern**
Add functionality via decorators:

```typescript
class UserService {
  @Memoize()
  @Timeout(5000)
  @Log()
  async getUser(id: string) {
    // Implementation
  }
}
```

#### 10. **Strategy Pattern**
Interchangeable algorithm implementations:

```typescript
// Different strategies for the same operation
class CacheStrategy { /* ... */ }
class LoggingStrategy { /* ... */ }
class ValidationStrategy { /* ... */ }

// Plug them in
pluginManager.useMiddleware(new CacheStrategy());
```

#### 11. **Composition Pattern**
Functional programming utilities:

```typescript
// Compose operations
const pipeline = pipeAsync(
  (user) => loadUser(user),
  (user) => loadLists(user),
  (data) => enrichData(data)
);

const result = await pipeline(userId);
```

#### 12. **Singleton Pattern**
Single instance per application:

```typescript
const container = new DIContainer();
container.registerInstance(ServiceKeys.Repository, repo, { scope: 'singleton' });
```

## License

MIT - Part of Task-Laureate project
