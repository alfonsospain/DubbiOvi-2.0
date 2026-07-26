export type ExecutionStepStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface ExecutionStep {
  id: string;
  label: string;
  status: ExecutionStepStatus;
  detail?: string;
}

export type JobStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionJob {
  id: string;
  title: string;
  provider: string;
  status: JobStatus;
  steps: ExecutionStep[];
  currentStepId?: string;
  startTime?: number;
  elapsedSeconds: number;
  progressPercent?: number;
  canCancel: boolean;
  cancelRequested?: boolean;
  error?: string;
}
