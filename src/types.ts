export type HookContext<Res = unknown, ChainInput = any> = {
  _input: ChainInput;
} & {
  [key: string]: any; // for resolved hooks (e.g. `sanitized`, `insert`)
};

export interface BaseResponse<T = any> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
  status?: number;
  code?: string | number;
  [key: string]: any;
}

export type HookData<T = unknown> = T;

// export type HookOptions = {
//   key?: string;
//   abort?: boolean;
//   wait?: string[];
//   bg?: boolean;
//   parallel?: boolean;
//   if?: Array<(ctx: HookContext<BaseResponse>) => boolean>;

//   onSuccess?: (res: BaseResponse, ctx: HookContext<BaseResponse>) => void;
//   onError?: (res: BaseResponse, ctx: HookContext<BaseResponse>) => void;
// };

export type HookOptions<Result extends BaseResponse = BaseResponse> = {
  key: string;
  abort?: boolean;
  wait?: string[];
  bg?: boolean;
  parallel?: boolean;
  if?: Array<(ctx: HookContext<Result>) => boolean>;
  failIf?: Array<(ctx: HookContext<Result>) => string | false | undefined>;

  onSuccess?: (res: Result, ctx: HookContext<Result>) => void;
  onError?: (res: Result, ctx: HookContext<Result>) => string;
};

export type HookKey = string;

export type HookName = string;

export type HookChain<ResponseType = BaseResponse, Data = unknown> = Hook<
  ResponseType,
  Data
>[];

// export type HookChainProps<ResponseType = BaseResponse, RawInput = unknown> = {
//   data: RawInput;
//   success?: (res: ResponseType) => void;
//   fail?: (res: ResponseType) => void;
//   log?: boolean;
//   logger?: HookLogger;
// };

export type RunHookParams<ResponseType = BaseResponse, Data = unknown> = {
  data: HookData<Data>;
  chain: HookChain<ResponseType, Data>;
  next: number;
  results: Record<HookName, ResponseType>;
  bail: boolean;
  bailReason?: string;
};

export type Hook<
  ResponseType = BaseResponse,
  ChainInput = unknown,
  FnInput = unknown,
> = {
  fn: (input: FnInput) => Promise<ResponseType>;

  dependencies?: (ctx: HookContext<ResponseType, ChainInput>) => FnInput;
  options: HookOptions;
};

export type HookChainValidationIssue = {
  hookKey: string;
  message: string;
  severity: "error" | "warning";
};

export type HookResolver<Ctx, Input> = [
  from?: (ctx: Ctx) => Input,
  options?: HookOptions,
];

export type HookEvent =
  | "start"
  | "data"
  | "deferred"
  | "skipped"
  | "background"
  | "parallel"
  | "success"
  | "fail";

export type HookLogger = (event: HookEvent, key: string, meta?: any) => void;
