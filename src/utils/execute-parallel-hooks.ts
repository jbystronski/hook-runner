import type { BaseResponse, Hook, HookContext } from "../types";

export async function executeParallelHooks<
  ResponseType extends BaseResponse,
  Data = unknown,
>(
  hooks: Hook<ResponseType, Data>[],
  ctx: HookContext<ResponseType, Data>
): Promise<{ bailReason?: string; ok: boolean; error: string | undefined }> {
  const settled = await Promise.allSettled(
    hooks.map(async (hook) => {
      console.log("parallel hook ", hook);

      const input = hook.dependencies?.(ctx) ?? ctx._input;
      const res = await hook.fn(input);
      (ctx as any)[hook.options!.key!] = res; // safe if runtime key assignment is intended
      return { key: hook.options!.key!, res };
    })
  );

  for (const result of settled) {
    if (
      result.status === "fulfilled" &&
      !result.value.res.ok &&
      hooks.find((h) => h.options?.key === result.value.key)?.options?.abort
    ) {
      return {
        bailReason: result.value.key,
        ok: false,
        error: result.value.res.error,
      };
    }
  }

  return {};
}
