import type { BaseResponse, Hook, HookContext } from "../types";

export async function executeBackgroundHook<
  ResponseType extends BaseResponse,
  Data = unknown,
>(
  hook: Hook<ResponseType, Data>,
  ctx: HookContext<ResponseType, Data>
): Promise<void> {
  try {
    const input = hook.dependencies?.(ctx) ?? ctx._input;
    const res = await hook.fn(input);
    (ctx as any)[hook.options.key!] = res; // safe cast for runtime key assignment
  } catch (err) {
    console.warn(`Background hook "${hook.options.key}" failed`, err);
    (ctx as any)[hook.options.key!] = {
      ok: false,
      error: err ?? "Unknown error",
      status: 500,
    } as ResponseType;
  }
}
