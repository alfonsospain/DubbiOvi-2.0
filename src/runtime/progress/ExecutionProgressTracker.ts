import { ExecutionJob, ExecutionStep, JobStatus } from './ProgressTypes';
import { v4 as uuidv4 } from 'uuid';

export interface CreateTrackerOptions {
  id?: string;
  title: string;
  provider: string;
  steps: Array<{ id: string; label: string }>;
  canCancel?: boolean;
}

/**
 * Controller managing state transitions, live elapsed timer, and updates for an ExecutionJob.
 * Engine-agnostic and 100% decoupled from specific AI runtimes.
 */
export class ExecutionProgressTracker {
  private job: ExecutionJob;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(job: ExecutionJob) => void> = new Set();

  constructor(options: CreateTrackerOptions) {
    const steps: ExecutionStep[] = options.steps.map((s) => ({
      id: s.id,
      label: s.label,
      status: 'pending',
    }));

    this.job = {
      id: options.id || uuidv4(),
      title: options.title,
      provider: options.provider,
      status: 'idle',
      steps,
      elapsedSeconds: 0,
      canCancel: options.canCancel ?? true,
      cancelRequested: false,
    };
  }

  /**
   * Returns a copy of the current ExecutionJob state snapshot.
   */
  public getJob(): ExecutionJob {
    return {
      ...this.job,
      steps: this.job.steps.map((s) => ({ ...s })),
    };
  }

  /**
   * Subscribes a listener callback to job state updates.
   */
  public subscribe(listener: (job: ExecutionJob) => void): () => void {
    this.listeners.add(listener);
    listener(this.getJob());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getJob();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[ExecutionProgressTracker] Listener error:', err);
      }
    }
  }

  /**
   * Starts job execution and live elapsed time tracking.
   */
  public start(): void {
    this.job.status = 'running';
    this.job.startTime = Date.now();
    this.job.elapsedSeconds = 0;

    if (this.job.steps.length > 0) {
      this.setStep(this.job.steps[0].id);
    }

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.job.status === 'running' && this.job.startTime) {
        this.job.elapsedSeconds = Math.floor((Date.now() - this.job.startTime) / 1000);
        this.notify();
      }
    }, 1000);

    this.notify();
  }

  /**
   * Updates active execution step by ID.
   */
  public setStep(stepId: string, detail?: string): void {
    let found = false;
    for (const step of this.job.steps) {
      if (step.id === stepId) {
        step.status = 'active';
        if (detail !== undefined) step.detail = detail;
        found = true;
        this.job.currentStepId = stepId;
      } else if (!found) {
        step.status = 'completed';
      } else {
        step.status = 'pending';
      }
    }
    this.notify();
  }

  /**
   * Updates optional progress percentage (0-100).
   */
  public updateProgress(percent: number): void {
    this.job.progressPercent = Math.min(100, Math.max(0, percent));
    this.notify();
  }

  /**
   * Requests job cancellation.
   * Updates job status to 'cancelled' and sets cancelRequested = true.
   * Does NOT issue process kill calls.
   */
  public requestCancel(): void {
    if (!this.job.canCancel) return;
    this.job.cancelRequested = true;
    this.job.status = 'cancelled';
    this.stopTimer();
    this.notify();
  }

  /**
   * Marks the job as successfully completed.
   */
  public complete(): void {
    for (const step of this.job.steps) {
      step.status = 'completed';
    }
    this.job.status = 'completed';
    this.job.progressPercent = 100;
    this.stopTimer();
    this.notify();
  }

  /**
   * Marks the job as failed with an error message.
   */
  public fail(errorMessage: string): void {
    if (this.job.currentStepId) {
      const activeStep = this.job.steps.find((s) => s.id === this.job.currentStepId);
      if (activeStep) activeStep.status = 'failed';
    }
    this.job.status = 'failed';
    this.job.error = errorMessage;
    this.stopTimer();
    this.notify();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
