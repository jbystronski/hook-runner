import type { HookLogger } from "../types";

export const defaultLogger: HookLogger = (event, key, meta = {}) => {
  console.debug(`[${event.toUpperCase()}] ${key}`, meta);
};
