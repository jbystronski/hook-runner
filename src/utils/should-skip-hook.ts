import type { HookContext, Hook } from "../types";

export function shouldSkipHook<ResponseType, ChainInput = unknown>(
  hook: Hook<ResponseType, ChainInput, unknown>,
  ctx: HookContext<ResponseType, ChainInput>
): boolean {
  const conditions = hook.options?.if;
  if (!conditions?.length) return false;
  return !conditions.every((fn) => fn(ctx));
}
