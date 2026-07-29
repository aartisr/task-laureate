/**
 * Composition & Decorator Utilities
 * 
 * Functional programming patterns for:
 * - Function composition
 * - Higher-order functions
 * - Decorators
 * - Middleware chaining
 */

/**
 * Compose multiple functions into a single function
 */
export function compose<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduceRight((acc, fn) => fn(acc), arg);
}

/**
 * Compose async functions
 */
export function composeAsync<T>(
  ...fns: Array<(arg: T) => Promise<T>>
): (arg: T) => Promise<T> {
  return async (arg: T) => {
    let result = arg;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };
}

/**
 * Pipe multiple functions (left-to-right)
 */
export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((acc, fn) => fn(acc), arg);
}

/**
 * Pipe async functions
 */
export function pipeAsync<T>(
  ...fns: Array<(arg: T) => Promise<T>>
): (arg: T) => Promise<T> {
  return async (arg: T) => {
    let result = arg;
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };
}

/**
 * Memoize function results
 */
export function memoize<Args extends any[], R>(
  fn: (...args: Args) => R
): (...args: Args) => R {
  const cache = new Map<string, R>();

  return (...args: Args): R => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Memoize async function results
 */
export function memoizeAsync<Args extends any[], R>(
  fn: (...args: Args) => Promise<R>,
  ttlMs: number = 5000
): (...args: Args) => Promise<R> {
  const cache = new Map<string, { result: R; expiresAt: number }>();

  return async (...args: Args): Promise<R> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const result = await fn(...args);
    cache.set(key, { result, expiresAt: Date.now() + ttlMs });
    return result;
  };
}

/**
 * Retry function with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 100
): Promise<T> {
  let lastError: Error | null = null;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      }
    }
  }

  throw lastError;
}

/**
 * Debounce function
 */
export function debounce<Args extends any[]>(
  fn: (...args: Args) => void,
  delayMs: number
): (...args: Args) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Debounce async function
 */
export function debounceAsync<Args extends any[], R>(
  fn: (...args: Args) => Promise<R>,
  delayMs: number
): (...args: Args) => Promise<R> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastPromise: Promise<R> | null = null;

  return (...args: Args) => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          lastPromise = Promise.resolve(result);
          resolve(result);
        } catch (error) {
          lastPromise = Promise.reject(error);
          reject(error);
        }
        timeoutId = null;
      }, delayMs);
    });
  };
}

/**
 * Throttle function
 */
export function throttle<Args extends any[]>(
  fn: (...args: Args) => void,
  intervalMs: number
): (...args: Args) => void {
  let lastCallTime = 0;

  return (...args: Args) => {
    const now = Date.now();
    if (now - lastCallTime >= intervalMs) {
      fn(...args);
      lastCallTime = now;
    }
  };
}

/**
 * Throttle async function
 */
export function throttleAsync<Args extends any[], R>(
  fn: (...args: Args) => Promise<R>,
  intervalMs: number
): (...args: Args) => Promise<R> {
  let lastCallTime = 0;
  let lastPromise: Promise<R> | null = null;

  return async (...args: Args): Promise<R> => {
    const now = Date.now();
    if (now - lastCallTime >= intervalMs) {
      lastCallTime = now;
      lastPromise = fn(...args);
    }
    return lastPromise || Promise.reject(new Error('Throttled'));
  };
}

/**
 * Create a function with timeout
 */
export function withTimeout<Args extends any[], R>(
  fn: (...args: Args) => Promise<R>,
  timeoutMs: number
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    return Promise.race([
      fn(...args),
      new Promise<R>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  };
}

/**
 * Create a function with default fallback
 */
export function withFallback<Args extends any[], R>(
  fn: (...args: Args) => Promise<R>,
  fallback: R | ((error: Error) => R)
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return typeof fallback === 'function' ? fallback(err) : fallback;
    }
  };
}

/**
 * Create a function with conditional execution
 */
export function when<Args extends any[], R>(
  condition: (...args: Args) => boolean,
  ifTrue: (...args: Args) => R,
  ifFalse?: (...args: Args) => R
): (...args: Args) => R | undefined {
  return (...args: Args) => {
    if (condition(...args)) {
      return ifTrue(...args);
    }
    return ifFalse?.(...args);
  };
}

/**
 * Create a function with async conditional execution
 */
export function whenAsync<Args extends any[], R>(
  condition: (...args: Args) => Promise<boolean>,
  ifTrue: (...args: Args) => Promise<R>,
  ifFalse?: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R | undefined> {
  return async (...args: Args) => {
    if (await condition(...args)) {
      return ifTrue(...args);
    }
    return ifFalse?.(...args);
  };
}

/**
 * Chain promises with error handling
 */
export function chainAsync<T>(
  promises: Array<() => Promise<T>>,
  options?: {
    stopOnError?: boolean;
    transform?: (result: T) => T;
  }
): Promise<T[]> {
  const results: T[] = [];

  return (async () => {
    for (const promiseFn of promises) {
      try {
        let result = await promiseFn();
        if (options?.transform) {
          result = options.transform(result);
        }
        results.push(result);
      } catch (error) {
        if (options?.stopOnError) {
          throw error;
        }
      }
    }
    return results;
  })();
}

/**
 * Batch async operations
 */
export async function batchAsync<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Decorator: Memoize method results
 */
export function Memoize(): MethodDecorator {
  const cache = new WeakMap<object, Map<string, any>>();

  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      if (!cache.has(this)) {
        cache.set(this, new Map());
      }

      const methodCache = cache.get(this)!;
      const key = `${String(propertyKey)}:${JSON.stringify(args)}`;

      if (methodCache.has(key)) {
        return methodCache.get(key);
      }

      const result = originalMethod.apply(this, args);
      methodCache.set(key, result);
      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator: Add retry logic
 */
export function Retry(maxAttempts: number = 3): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          if (attempt === maxAttempts) {
            throw error;
          }
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          );
        }
      }
    };

    return descriptor;
  };
}

/**
 * Decorator: Add timeout
 */
export function Timeout(timeoutMs: number): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Method timeout after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);
    };

    return descriptor;
  };
}

/**
 * Decorator: Add logging
 */
export function Log(logger: (msg: string) => void = console.log): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      logger(`[${String(propertyKey)}] Called`);
      try {
        const result = await originalMethod.apply(this, args);
        logger(`[${String(propertyKey)}] Completed`);
        return result;
      } catch (error) {
        logger(
          `[${String(propertyKey)}] Failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        throw error;
      }
    };

    return descriptor;
  };
}
