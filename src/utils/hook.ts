import type { BaseResponse, Hook, HookContext, HookOptions } from "../types";

function validateOptions(key: string, options?: HookOptions) {
  if (!options) return;

  if (options.parallel && options.bg) {
    throw new Error(
      `Hook "${key}" cannot have both "parallel" and "background" set to true — choose one.`
    );
  }

  // Optionally: warn about pointless combinations
  if (options.bg && options.abort) {
    console.warn(
      `Warning: Hook "${key}" has "background" and "abort". Background hooks cannot abort the chain.`
    );
  }
}

type InferFnInput<T> = T extends (input: infer U) => Promise<any> ? U : never;

export function hook<
  Fn extends (input: any) => Promise<ResponseType>,
  ResponseType extends BaseResponse = BaseResponse,
  ChainInput = unknown,
  FnInput = InferFnInput<Fn>,
>(
  fn: Fn,
  config: {
    dependencies?: (ctx: HookContext<ResponseType, ChainInput>) => FnInput;
    options?: HookOptions;
  } = {}
): Hook<ResponseType, ChainInput, FnInput> {
  const { dependencies, options = {} } = config;

  console.log("hook Deps", dependencies);

  console.log("hookOptions", options);

  const resolvedKey = options.key || fn.name;

  if (!resolvedKey) {
    throw new Error("Hook must have a name or provide a `key` manually.");
  }

  const mergedOptions: HookOptions = {
    abort: true,
    ...options,
    key: resolvedKey,
  };

  validateOptions(resolvedKey, mergedOptions);

  return {
    fn,
    dependencies,
    options: mergedOptions,
  };
}
