export interface RuntimeExecutionOptions {
  runtimeId: string;
  version?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  inputData?: Buffer | string;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}
