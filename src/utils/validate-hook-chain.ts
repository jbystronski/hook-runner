import type { HookChain, HookChainValidationIssue } from "../types";

export function validateHookChain<R, Aux>(
  chain: HookChain<R, Aux>
): HookChainValidationIssue[] {
  const issues: HookChainValidationIssue[] = [];
  const keys = new Set(chain.map((h) => h.options.key));
  const backgroundKeys = new Set(
    chain.filter((h) => h.options?.bg).map((h) => h.options.key)
  );
  const parallelKeys = new Set(
    chain.filter((h) => h.options?.parallel).map((h) => h.options.key)
  );

  for (const hook of chain) {
    const { options } = hook;

    if (!options.key) {
      issues.push({
        hookKey: "",
        message: "Hook missing key",
        severity: "error",
      });
      continue;
    }

    // Check conflicting options
    if (options?.bg && options?.parallel) {
      issues.push({
        hookKey: options.key,
        message: "Hook cannot be both background and parallel",
        severity: "error",
      });
    }

    // Check waitFor dependencies exist and are valid
    if (options?.wait) {
      for (const depKey of options.wait) {
        if (!keys.has(depKey)) {
          issues.push({
            hookKey: options.key,
            message: `waitFor references unknown hook key "${depKey}"`,
            severity: "error",
          });
        }
        // Hook should not depend on background hook unless it itself is background
        if (backgroundKeys.has(depKey) && !options?.bg) {
          issues.push({
            hookKey: options.key,
            message: `Hook depends on background hook "${depKey}", which may not be resolved in time`,
            severity: "error",
          });
        }
      }
    }

    // Validate parallel hooks dependencies on other parallel hooks
    if (options?.parallel && options?.wait) {
      for (const depKey of options.wait) {
        if (parallelKeys.has(depKey)) {
          issues.push({
            hookKey: options.key,
            message: `Parallel hook "${options.key}" depends on another parallel hook "${depKey}", which may cause race conditions.`,
            severity: "warning",
          });
        }
      }
    }
  }

  return issues;
}
