import type { Hook } from "../types";

export function shouldDeferHook<ResponseType, Data>(
  hook: Hook<ResponseType, Data>,
  results: Record<string, ResponseType>
): boolean {
  const waitFor = hook.options?.wait;
  if (!waitFor || waitFor.length === 0) return false;
  return waitFor.some((dep) => !(dep in results));
}
