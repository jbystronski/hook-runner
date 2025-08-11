import type { BaseResponse, Hook } from "../types";

export async function executeHook<ResponseType extends BaseResponse, Data>(
  hook: Hook<ResponseType, Data>,
  input: any
): Promise<ResponseType> {
  return await hook.fn(input);
}
