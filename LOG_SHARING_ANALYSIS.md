# Log Accumulation & Sharing Analysis

## Summary

The codebase has a **critical issue with shared log accumulation**. Logs from multiple red team jobs are being accumulated into the same global callback mechanism and the same shared Map data structure, which can cause logs from one job to leak into another.

---

## 1. Global Log Callback System

### Location: [src/logger.ts](src/logger.ts#L15-L19)

```typescript
type LogCallback = (message: string) => void;
export let globalLogCallback: LogCallback | null = null;

export function setLogCallback(callback: LogCallback | null) {
  globalLogCallback = callback;
}
```

**Issue**: This is a **single global callback**. When a `logCallback` is set for one job, it becomes active for ALL subsequent logs until it's cleared.

### How It's Used in Console Formatter: [src/logger.ts](src/logger.ts#L135-L144)

```typescript
export const consoleFormatter = winston.format.printf(
  (info: winston.Logform.TransformableInfo): string => {
    const message = extractMessage(info);

    // Call the callback if it exists
    if (globalLogCallback) {
      globalLogCallback(message);
    }
    // ... rest of formatting
  },
);
```

**Problem**: Every log message passes through this callback. If multiple jobs are running in parallel, logs from different jobs will all call the same `globalLogCallback`.

---

## 2. Shared evalJobs Map Structure

### Location: [src/server/routes/eval.ts](src/server/routes/eval.ts#L36)

```typescript
export const evalJobs = new Map<string, Job>();
```

### Job Interface Definition

```typescript
type Job = {
  evalId: string | null;
  status: 'in-progress' | 'complete' | 'error';
  progress: number;
  total: number;
  result: null | object;
  logs: string[]; // <-- Shared log accumulation point
};
```

**Issue**: Each job has a `logs: string[]` array, which is populated by the `logCallback`.

---

## 3. Red Team Job Log Callback - THE MAIN ISSUE

### Location: [src/server/routes/redteam.ts](src/server/routes/redteam.ts#L293-L297)

```typescript
logCallback: (message: string) => {
  const job = evalJobs.get(id);
  if (job) {
    job.logs.push(message);
  }
},
```

**Problem**:

1. The `logCallback` is set globally via `setLogCallback(options.logCallback)` in [src/redteam/shared.ts#L24-L25](src/redteam/shared.ts#L24-L25)
2. While the callback closure captures the `id` variable, if the global callback is **overwritten** before being cleaned up, logs could be routed to the wrong job
3. The callback is stored as a function reference in the closure, but there's a timing window where:
   - Job A sets the global callback
   - Job B sets the global callback (overwrites Job A's)
   - Job A logs are now going to Job B's logs array

---

## 4. Red Team Setup in shared.ts

### Location: [src/redteam/shared.ts](src/redteam/shared.ts#L20-L30)

```typescript
export async function doRedteamRun(options: RedteamRunOptions): Promise<Eval | undefined> {
  if (options.verbose) {
    setLogLevel('debug');
  }
  if (options.logCallback) {
    setLogCallback(options.logCallback); // <-- Sets global callback
  }

  // Enable live verbose toggle (press 'v' to toggle debug logs)
  // Only works in interactive TTY mode, not in CI or web UI
  const verboseToggleCleanup = options.logCallback ? null : initVerboseToggle();
  // ...
}
```

### Cleanup: [src/redteam/shared.ts](src/redteam/shared.ts#L100)

```typescript
setLogCallback(null); // <-- Cleanup after error
```

### Final Cleanup: [src/redteam/shared.ts](src/redteam/shared.ts#L160)

```typescript
// Cleanup
setLogCallback(null);
```

**Problem**: The cleanup happens at the END of `doRedteamRun()`. If two jobs are running concurrently:

- Job A starts at T1, sets global callback
- Job B starts at T2 (before Job A finishes), **overwrites** the global callback
- Job A's logs after T2 go into Job B's array
- Job A finishes at T3, clears the callback (setting it to null)
- Job B is still running, so its logs after T3 are LOST (callback is null)

---

## 5. Evaluation Job Callback - SAME PATTERN

### Location: [src/server/routes/eval.ts](src/server/routes/eval.ts#L38-L46)

```typescript
evalJobs.set(id, {
  evalId: null,
  status: 'in-progress',
  progress: 0,
  total: 0,
  result: null,
  logs: [],
});
```

The eval jobs also use the same pattern, though I don't see them setting a logCallback in the provided code. However, they DO accumulate logs in a shared array.

---

## 6. Browser Logger Also Has Global Callback

### Location: [src/logger.browser.ts](src/logger.browser.ts#L92-L95)

```typescript
export let globalLogCallback: ((msg: string) => void) | null = null;

export function setLogCallback(cb: ((msg: string) => void) | null): void {
  globalLogCallback = cb;
}
```

This mirrors the Node logger's global callback pattern.

---

## Summary of Issues

| Issue                               | Location                            | Severity     | Impact                                                                                      |
| ----------------------------------- | ----------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| **Global log callback overwriting** | `src/logger.ts` line 16             | **CRITICAL** | Logs from one job route to another in concurrent scenarios                                  |
| **evalJobs shared Map**             | `src/server/routes/eval.ts` line 36 | **HIGH**     | Jobs share the same Map; no isolation between job log arrays                                |
| **No job-specific logging context** | Multiple files                      | **HIGH**     | Callbacks have no way to know which job they're logging for without closure                 |
| **Race condition in redteam**       | `src/redteam/shared.ts`             | **CRITICAL** | Multiple concurrent `doRedteamRun()` calls overwrite each other's callbacks                 |
| **Cleanup timing**                  | `src/redteam/shared.ts` line 160    | **CRITICAL** | Cleanup happens after doRedteamRun completes, but can happen while other jobs still running |

---

## Recommended Fixes

1. **Use job-specific loggers** instead of a global callback (context-aware logging)
2. **Store logCallback in the Job object** instead of globally
3. **Use a WeakMap or unique callback wrapper** for each job
4. **Pass job ID through the logging context** rather than relying on closure capture
5. **Implement proper cleanup** with AbortController or similar to ensure callbacks are removed only after confirmed completion
