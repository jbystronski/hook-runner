import { hook } from "./hook";
import type {
  BaseResponse,
  Hook,
  HookContext,
  HookOptions,
  HookResolver,
} from "../types";

type FluentHook<Ctx, Input, Result> = Hook<Result, Ctx> & {
  as<Key extends string>(key: Key): FluentHook<Ctx, Input, Result>;
  bg(value?: boolean): FluentHook<Ctx, Input, Result>;
  parallel(value?: boolean): FluentHook<Ctx, Input, Result>;
  wait(deps: string[]): FluentHook<Ctx, Input, Result>;
  abort(value?: boolean): FluentHook<Ctx, Input, Result>;
  error(
    fn: (res: BaseResponse, ctx: HookContext<BaseResponse>) => string
  ): FluentHook<Ctx, Input, Result>;

  if(
    condition: (ctx: HookContext<Result>) => boolean
  ): FluentHook<Ctx, Input, Result>;
  failIf(
    predicate: (ctx: HookContext<Result>) => string | false | undefined
  ): FluentHook<Ctx, Input, Result>;
};

// export function createHook<
//   Fn extends (input: any) => Promise<any>,
//   OuterCtx = {},
// >(fn: Fn, baseOptions = {}) {
//   return function <
//     Input extends Parameters<Fn>[0] = Parameters<Fn>[0],
//     Result extends BaseResponse<any> = Awaited<ReturnType<Fn>>,
//     ChainInput = unknown,
//     Ctx = HookContext<Result, ChainInput> & OuterCtx,
//   >(...resolver: HookResolver<Ctx, Input>): FluentHook<Ctx, Input, Result> {
//     const from = resolver[0];
//     const options = resolver[1] || {};

//     const base = hook<Fn, Result, ChainInput, Input>(fn, {
//       dependencies: from as unknown as (
//         ctx: HookContext<Result, ChainInput>
//       ) => Input,
//       options: { ...baseOptions, ...options },
//     });

//     const fluent = base as FluentHook<Ctx, Input, Result>;

//     fluent.as = function <Key extends string>(key: Key) {
//       fluent.options.key = key;
//       // return createHook<Fn, OuterCtx>(fn, { ...baseOptions, key })(resolver);

//       return fluent;
//     };

//     fluent.bg = function (value = true) {
//       fluent.options.bg = value;
//       return fluent;
//     };

//     fluent.parallel = function (value = true) {
//       fluent.options.parallel = value;
//       return fluent;
//     };

//     fluent.wait = function (deps: string[]) {
//       fluent.options.wait = deps;
//       return fluent;
//     };

//     fluent.abort = function (value = true) {
//       fluent.options.abort = value;
//       return fluent;
//     };

//     fluent.error = function (
//       fn: (res: BaseResponse, ctx: HookContext<Result, ChainInput>) => void
//     ) {
//       fluent.options.onError = fn;
//       return fluent;
//     };

//     fluent.if = function (
//       condition: (ctx: HookContext<Result, ChainInput>) => boolean
//     ) {
//       if (!Array.isArray(fluent.options.if)) {
//         fluent.options.if = [];
//       }
//       fluent.options.if.push(condition);
//       return fluent;
//     };

//     fluent.failIf = function (
//       predicate: (
//         ctx: HookContext<Result, ChainInput>
//       ) => string | false | undefined
//     ) {
//       if (!Array.isArray(fluent.options.failIf)) {
//         fluent.options.failIf = [];
//       }
//       fluent.options.failIf.push(predicate);
//       return fluent;
//     };

//     return fluent;
//   };
// }

export function createHook<
  Fn extends (input: any) => Promise<any>,
  OuterCtx = {},
>(fn: Fn, baseOptions = {}) {
  return function <
    Input extends Parameters<Fn>[0] = Parameters<Fn>[0],
    Result extends BaseResponse<any> = Awaited<ReturnType<Fn>>,
    ChainInput = unknown,
    Ctx = HookContext<Result, ChainInput> & OuterCtx,
  >(...resolver: HookResolver<Ctx, Input>): FluentHook<Ctx, Input, Result> {
    const [from, initialOptions = { key: "" }] = resolver;
    const mergedOptions: HookOptions = { ...baseOptions, ...initialOptions };

    let realHook: Hook<Result, Ctx> | null = null;

    const ensureHook = () => {
      if (!realHook) {
        realHook = hook<Fn, Result, ChainInput, Input>(fn, {
          dependencies: from as unknown as (
            ctx: HookContext<Result, ChainInput>
          ) => Input,
          options: mergedOptions,
        });
      }
      return realHook;
    };

    const fluentMethods: Partial<FluentHook<Ctx, Input, Result>> = {
      as(key) {
        mergedOptions.key = key;
        return proxy;
      },
      bg(value = true) {
        mergedOptions.bg = value;
        return proxy;
      },
      parallel(value = true) {
        mergedOptions.parallel = value;
        return proxy;
      },
      wait(deps) {
        mergedOptions.wait = deps;
        return proxy;
      },
      abort(value = true) {
        mergedOptions.abort = value;
        return proxy;
      },
      error(fn) {
        mergedOptions.onError = fn;
        return proxy;
      },
      if(condition) {
        mergedOptions.if ??= [];
        mergedOptions.if.push(condition);
        return proxy;
      },
      failIf(predicate) {
        mergedOptions.failIf ??= [];
        mergedOptions.failIf.push(predicate);
        return proxy;
      },
    };

    // Proxy: acts like a function, but also exposes fluent API
    const proxy = new Proxy(
      // function behavior: delegate to hook call
      function (ctx: any) {
        return ensureHook()(ctx); // hook is a function
      },
      {
        get(_, prop) {
          // Access to fluent methods (e.g., .as, .bg)
          if (prop in fluentMethods) {
            return (fluentMethods as any)[prop];
          }
          // Fall back to real hook fields (after it's created)
          const real = ensureHook();
          return (real as any)[prop];
        },
        apply(_, __, args) {
          // Called like a function
          const real = ensureHook();
          return (real as any)(...args);
        },
      }
    ) as FluentHook<Ctx, Input, Result>;

    return proxy;
  };
}

export const _hook: typeof createHook = createHook;

// TESTING
