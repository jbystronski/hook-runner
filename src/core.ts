import type {
  BaseResponse,
  HookChain,
  HookData,
  HookContext,
  HookLogger,
} from "./types";

import {
  shouldDeferHook,
  executeBackgroundHook,
  executeParallelHooks,
  shouldSkipHook,
  executeHook,
  validateHookChain,
  defaultLogger,
} from "./utils";

export async function runHookChain<
  ResponseType extends BaseResponse = BaseResponse,
  RawInput extends Record<string, any> = Record<string, any>,
>(
  chain: HookChain<ResponseType, HookContext<ResponseType, RawInput>>,
  props: {
    data: RawInput;
    success?: (res: ResponseType) => void;
    fail?: (res: ResponseType) => void;
    log?: boolean;
    logger?: HookLogger;
  }
): Promise<ResponseType> {
  let logger = undefined;

  if (props.log) {
    logger = props.logger || defaultLogger;
  }

  if (!chain?.length) {
    logger?.("fail", "init", { reason: "Empty chain" });
    return {
      ok: false,
      message: "Empty hook chain",
    } as ResponseType;
  }

  const issues = validateHookChain(chain);
  issues.forEach((iss) => {
    const msg = `${iss.hookKey}: ${iss.message}`;
    if (iss.severity === "warning") logger?.("deferred", iss.hookKey, msg);
    if (iss.severity === "error") {
      logger?.("fail", "init", msg);
      return {
        ok: false,
        error: msg,
      } as ResponseType;
    }
  });

  logger?.("data", "init", props.data);

  const fullContext: HookContext<ResponseType, RawInput> = {
    _input: props.data,
  };

  const res = await _run<ResponseType, typeof fullContext>({
    data: fullContext,
    chain,
    logger,
  });

  if (res.ok) props.success?.(res);
  else props.fail?.(res);

  return res;
}

// async function _run<
//   ResponseType extends BaseResponse = BaseResponse,
//   Data extends Record<string, any> = Record<string, any>,
// >({
//   data,
//   chain = [],
//   results,
//   logger,
// }: {
//   data: HookData<Data>;
//   chain: HookChain<ResponseType, Data>;
//   results?: HookContext<ResponseType, Data>;
//   logger?: HookLogger;
// }): Promise<ResponseType & { bailReason?: string }> {
//   console.log("CHAIN", chain);
//   const pending = [...chain];
//   const backgroundTasks: Promise<void>[] = [];

//   const ctx: HookContext<ResponseType, Data> = {
//     _input: data._input, // required, must be present
//     ...data,
//     ...(results ?? {}),
//   };

//   let iteration = 0;
//   const max = chain.length * 5;

//   while (pending.length) {
//     const hook = pending.shift();

//     if (!hook || !hook.fn) continue;
//     const { parallel, bg, abort, key, onError, onSuccess } = hook.options;

//     if (!key) {
//       throw new Error(`Missing key for hook: ${hook.fn.name}`);
//     }

//     if (key === "_input") {
//       throw new Error(
//         `Reserved key "_input" is forbidden as hook key, found in: ${hook.fn.name}`
//       );
//     }

//     // ✅ NEW: skip hook if condition fails

//     if (shouldDeferHook(hook, ctx)) {
//       logger?.("deferred", key);
//       iteration++;
//       if (iteration > max) {
//         return {
//           ok: false,
//           message: `Unresolved dependencies for hook "${key}"`,
//           bailReason: `Unresolved dependencies for hook "${key}"`,
//         } as ResponseType & { bailReason: string };
//       }
//       pending.push(hook);
//       continue;
//     }

//     if (shouldSkipHook(hook, ctx)) {
//       logger?.("skipped", key, "Skipped due to 'if' condition");
//       continue;
//     }

//     const failIf = hook.options.failIf;
//     if (failIf) {
//       for (const predicate of failIf) {
//         const bailMessage = predicate(ctx);
//         if (bailMessage) {
//           logger?.("fail", key, bailMessage);
//           return {
//             ok: false,
//             message: bailMessage,
//             bailReason: key,
//           } as ResponseType & { bailReason: string };
//         }
//       }
//     }

//     if (bg) {
//       logger?.("background", key);
//       backgroundTasks.push(executeBackgroundHook(hook, ctx));
//       continue;
//     }

//     if (parallel) {
//       logger?.("parallel", key);
//       const parallelHooks = [
//         hook,
//         ...pending.filter((h) => h.options?.parallel),
//       ];

//       const executableHooks = parallelHooks.filter(
//         (h) => !shouldSkipHook(h, ctx)
//       );
//       const { bailReason } = await executeParallelHooks(
//         executableHooks,

//         ctx
//       );

//       for (const {
//         options: { key },
//       } of executableHooks) {
//         const index = pending.findIndex(
//           ({ options: { key: pendingKey } }) => pendingKey === key
//         );
//         if (index !== -1) pending.splice(index, 1);
//       }

//       if (bailReason) {
//         return {
//           ok: false,
//           bailReason,
//         } as ResponseType & { bailReason: string };
//       }
//       continue;
//     }

//     logger?.("start", key);

//     const start = performance.now();
//     const res = await executeHook(hook, hook.dependencies?.(ctx) ?? ctx._input);
//     const duration = performance.now() - start;

//     ctx[key] = res;

//     if (!res.ok) {
//       logger?.("fail", key, res);
//     }

//     if (!res.ok && abort) {
//       onError?.(res, ctx);
//       return {
//         ...toResponse(ctx),
//         ok: false,
//         bailReason: key,
//       } as ResponseType & { bailReason: string };
//     }

//     if (res.ok) {
//       logger?.("success", key, { result: res, duration });
//       onSuccess?.(res, ctx);
//     }

//     console.log("Final context at _run end:", ctx);
//   }

//   if (backgroundTasks.length) {
//     await Promise.allSettled(backgroundTasks);
//   }

//   return {
//     ...toResponse(ctx),
//     ok: true,
//   } as ResponseType & { bailReason: string };
// }

// function toResponse<T extends BaseResponse>(results: HookContext<T>): T {
//   const { _input, ...cleaned } = results;
//   return cleaned as T;
// }

async function _run<
  ResponseType extends BaseResponse = BaseResponse,
  Data extends Record<string, any> = Record<string, any>,
>({
  data,
  chain = [],
  results,
  logger,
}: {
  data: HookData<Data>;
  chain: HookChain<ResponseType, Data>;
  results?: HookContext<ResponseType, Data>;
  logger?: HookLogger;
}): Promise<ResponseType & { bailReason?: string }> {
  const pending = [...chain];
  const backgroundTasks: Promise<void>[] = [];

  const ctx: HookContext<ResponseType, Data> = {
    _input: data._input,
    ...data,
    ...(results ?? {}),
  };

  const maxRetries = chain.length * 5;
  let iteration = 0;

  while (pending.length) {
    const hook = pending.shift();
    if (!hook?.fn) continue;

    validateHookKey(hook.options.key, hook.fn.name);

    if (shouldDeferHook(hook, ctx)) {
      if (++iteration > maxRetries) {
        return fail(
          `Unresolved dependencies for hook "${hook.options.key}"`,
          hook.options.key as string
        );
      }
      logger?.("deferred", hook.options.key);
      pending.push(hook);
      continue;
    }

    if (shouldSkipHook(hook, ctx)) {
      logger?.("skipped", hook.options.key, "Skipped due to 'if' condition");
      continue;
    }

    const failReason = runFailIf(hook, ctx, logger);
    if (failReason) return fail(failReason, hook.options.key);

    if (hook.options.bg) {
      logger?.("background", hook.options.key);
      backgroundTasks.push(executeBackgroundHook(hook, ctx));
      continue;
    }

    if (hook.options.parallel) {
      const result = await runParallelHooks(hook, pending, ctx, logger);
      if (result?.ok === false) {
        return result as ResponseType & { bailReason: string };
      }

      continue;
    }

    logger?.("start", hook.options.key);
    const start = performance.now();
    const res = await executeHook(hook, hook.dependencies?.(ctx) ?? ctx._input);
    const duration = performance.now() - start;
    ctx[hook.options.key] = res;
    if (!res.ok) {
      logger?.("fail", hook.options.key, res);
    }
    if (!res.ok && hook.options.abort) {
      return {
        ...toResponse(ctx),
        ok: false,
        errors: res?.errors || {},
        error: hook.options.onError?.(res, ctx) || res?.error || "",
        status: res?.status || 500,
        code: res?.code || "",
        bailReason: hook.options.key,
      } as ResponseType & { bailReason: string };
    }

    if (res.ok) {
      logger?.("success", hook.options.key, { result: res, duration });
      hook.options?.onSuccess?.(res, ctx);
    }
  }

  if (backgroundTasks.length) await Promise.allSettled(backgroundTasks);

  return { ...toResponse(ctx), ok: true };
}

function validateHookKey(key?: string, fnName?: string) {
  if (!key) throw new Error(`Missing key for hook: ${fnName}`);
  if (key === "_input")
    throw new Error(`Reserved key "_input" is forbidden: ${fnName}`);
}

function runFailIf(hook, ctx, logger): string | null {
  const { key, failIf = [] } = hook.options;
  for (const predicate of failIf) {
    const msg = predicate(ctx);
    if (msg) {
      logger?.("fail", key, msg);
      return msg;
    }
  }
  return null;
}

async function runParallelHooks(
  hook,
  pending,
  ctx,
  logger
): Promise<BaseResponse | void> {
  const { key } = hook.options;
  logger?.("parallel", key);

  const parallelHooks = [hook, ...pending.filter((h) => h.options?.parallel)];
  const executableHooks = parallelHooks.filter((h) => !shouldSkipHook(h, ctx));

  const result = await executeParallelHooks(executableHooks, ctx);

  // Remove executed parallel hooks from pending list
  for (const h of executableHooks) {
    const i = pending.findIndex((p) => p.options?.key === h.options.key);
    if (i !== -1) pending.splice(i, 1);
  }

  if (result?.bailReason || result?.ok === false) {
    return {
      ...toResponse(ctx),
      ...result,
      error: hook.options.onError?.(result, ctx) || result.error || "",
      ok: false,
    };
  }
}

function fail(message: string, key: string): any {
  return {
    ok: false,
    message,
    bailReason: key,
  };
}

function toResponse<T extends BaseResponse>(results: HookContext<T>): T {
  const { _input, ...cleaned } = results;
  return cleaned as T;
}
