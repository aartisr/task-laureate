/**
 * Plugin System & Middleware Composition
 * 
 * Allows extending functionality without modifying core code.
 * Supports:
 * - Request/response middleware
 * - Operation decorators
 * - Event listeners
 * - Hooks
 */

import { IRepository, TodoItem, TodoList } from './repository';

// ============================================================================
// Plugin Interfaces
// ============================================================================

/**
 * Plugin lifecycle
 */
export interface IPlugin {
  name: string;
  version: string;
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
}

/**
 * Middleware for intercepting operations
 */
export interface Middleware<T = any, R = any> {
  name: string;
  execute(
    context: OperationContext<T, R>,
    next: () => Promise<R>
  ): Promise<R>;
}

/**
 * Operation context passed through middleware
 */
export interface OperationContext<T = any, R = any> {
  operationName: string;
  args: T;
  result?: R;
  error?: Error;
  metadata: Map<string, any>;
  startTime: number;
  endTime?: number;
}

/**
 * Event emitter for plugin events
 */
export interface IEventBus {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

/**
 * Hook system for lifecycle events
 */
export interface IHookManager {
  register(hookName: string, handler: (...args: any[]) => void): void;
  execute(hookName: string, ...args: any[]): Promise<void>;
}

// ============================================================================
// Event Bus Implementation
// ============================================================================

export class EventBus implements IEventBus {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}

// ============================================================================
// Hook Manager Implementation
// ============================================================================

export class HookManager implements IHookManager {
  private hooks = new Map<string, Function[]>();

  register(hookName: string, handler: (...args: any[]) => void): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }
    this.hooks.get(hookName)!.push(handler);
  }

  async execute(hookName: string, ...args: any[]): Promise<void> {
    const handlers = this.hooks.get(hookName);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await Promise.resolve(handler(...args));
        } catch (error) {
          console.error(`Error in hook ${hookName}:`, error);
        }
      }
    }
  }
}

// ============================================================================
// Middleware Chain
// ============================================================================

export class MiddlewareChain {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute<T, R>(
    operationName: string,
    args: T,
    handler: (context: OperationContext<T, R>) => Promise<R>
  ): Promise<R> {
    const context: OperationContext<T, R> = {
      operationName,
      args,
      metadata: new Map(),
      startTime: Date.now(),
    };

    let index = 0;
    const next = async (): Promise<R> => {
      if (index >= this.middlewares.length) {
        const result = await handler(context);
        context.result = result;
        context.endTime = Date.now();
        return result;
      }

      const middleware = this.middlewares[index++];
      return middleware.execute(context, next);
    };

    try {
      return await next();
    } catch (error) {
      context.error = error instanceof Error ? error : new Error(String(error));
      context.endTime = Date.now();
      throw error;
    }
  }
}

// ============================================================================
// Plugin Manager
// ============================================================================

export class PluginManager {
  private plugins: IPlugin[] = [];
  private middlewares = new MiddlewareChain();
  private eventBus = new EventBus();
  private hookManager = new HookManager();

  /**
   * Register a plugin
   */
  async registerPlugin(plugin: IPlugin): Promise<void> {
    this.plugins.push(plugin);
    this.eventBus.emit('plugin:registered', plugin.name);

    if (plugin.onLoad) {
      await plugin.onLoad();
      this.eventBus.emit('plugin:loaded', plugin.name);
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.find((p) => p.name === pluginName);
    if (!plugin) return;

    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    this.plugins = this.plugins.filter((p) => p.name !== pluginName);
    this.eventBus.emit('plugin:unloaded', pluginName);
  }

  /**
   * Use middleware
   */
  useMiddleware(middleware: Middleware): this {
    this.middlewares.use(middleware);
    return this;
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: any[]) => void): this {
    this.eventBus.on(event, listener);
    return this;
  }

  /**
   * Register hook
   */
  registerHook(hookName: string, handler: (...args: any[]) => void): this {
    this.hookManager.register(hookName, handler);
    return this;
  }

  /**
   * Execute operation through middleware chain
   */
  async executeOperation<T, R>(
    operationName: string,
    args: T,
    handler: (context: OperationContext<T, R>) => Promise<R>
  ): Promise<R> {
    return this.middlewares.execute(operationName, args, handler);
  }

  /**
   * Execute hook
   */
  async executeHook(hookName: string, ...args: any[]): Promise<void> {
    return this.hookManager.execute(hookName, ...args);
  }

  /**
   * Get all plugins
   */
  getPlugins(): IPlugin[] {
    return [...this.plugins];
  }

  /**
   * Clear all plugins and middleware
   */
  clear(): void {
    this.plugins = [];
    this.middlewares = new MiddlewareChain();
  }
}

// ============================================================================
// Common Middleware Examples
// ============================================================================

/**
 * Logging middleware
 */
export class LoggingMiddleware implements Middleware {
  name = 'logging';

  constructor(private logger: (msg: string) => void = console.log) {}

  async execute<T, R>(
    context: OperationContext<T, R>,
    next: () => Promise<R>
  ): Promise<R> {
    this.logger(`[${context.operationName}] Starting`);
    const start = Date.now();

    try {
      const result = await next();
      const duration = Date.now() - start;
      this.logger(`[${context.operationName}] Completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger(
        `[${context.operationName}] Failed after ${duration}ms: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }
}

/**
 * Caching middleware
 */
export class CachingMiddleware implements Middleware {
  name = 'caching';
  private cache = new Map<string, { data: any; ttl: number }>();

  constructor(private defaultTTL: number = 5000) {}

  async execute<T, R>(
    context: OperationContext<T, R>,
    next: () => Promise<R>
  ): Promise<R> {
    // Only cache read operations
    if (!['list', 'get', 'search', 'getDashboard'].some((op) =>
      context.operationName.startsWith(op)
    )) {
      return next();
    }

    const cacheKey = `${context.operationName}:${JSON.stringify(context.args)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.ttl > Date.now()) {
      context.metadata.set('cacheHit', true);
      return cached.data;
    }

    const result = await next();

    this.cache.set(cacheKey, {
      data: result,
      ttl: Date.now() + this.defaultTTL,
    });

    context.metadata.set('cacheMiss', true);
    return result;
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Validation middleware
 */
export class ValidationMiddleware implements Middleware {
  name = 'validation';

  async execute<T, R>(
    context: OperationContext<T, R>,
    next: () => Promise<R>
  ): Promise<R> {
    // Validate based on operation
    if (context.operationName.includes('create')) {
      const args = context.args as any;
      if (!args.title || typeof args.title !== 'string') {
        throw new Error('Title is required and must be a string');
      }
    }

    return next();
  }
}

/**
 * Error recovery middleware
 */
export class ErrorRecoveryMiddleware implements Middleware {
  name = 'errorRecovery';

  constructor(private maxRetries: number = 3) {}

  async execute<T, R>(
    context: OperationContext<T, R>,
    next: () => Promise<R>
  ): Promise<R> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await next();
        if (attempt > 1) {
          context.metadata.set('retriesUsed', attempt - 1);
        }
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt - 1) * 100)
          );
        }
      }
    }

    throw lastError;
  }
}

/**
 * Performance monitoring middleware
 */
export class PerformanceMiddleware implements Middleware {
  name = 'performance';
  private metrics = new Map<string, { count: number; totalTime: number }>();

  async execute<T, R>(
    context: OperationContext<T, R>,
    next: () => Promise<R>
  ): Promise<R> {
    const result = await next();

    const duration = context.endTime! - context.startTime;
    const key = context.operationName;
    const existing = this.metrics.get(key) || { count: 0, totalTime: 0 };

    this.metrics.set(key, {
      count: existing.count + 1,
      totalTime: existing.totalTime + duration,
    });

    context.metadata.set('duration', duration);
    return result;
  }

  getMetrics(): Record<string, { count: number; avgTime: number }> {
    const result: Record<string, { count: number; avgTime: number }> = {};
    for (const [key, { count, totalTime }] of this.metrics) {
      result[key] = { count, avgTime: totalTime / count };
    }
    return result;
  }

  clear(): void {
    this.metrics.clear();
  }
}
