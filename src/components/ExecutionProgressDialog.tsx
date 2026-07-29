'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ExecutionJob, ExecutionStep } from '@/runtime/progress/ProgressTypes';
import { Loader2, CheckCircle2, AlertCircle, Clock, Circle, XCircle } from 'lucide-react';

interface ExecutionProgressDialogProps {
  open: boolean;
  job: ExecutionJob | null;
  onCancelRequested?: () => void;
  onClose?: () => void;
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const ExecutionProgressDialog: React.FC<ExecutionProgressDialogProps> = ({
  open,
  job,
  onCancelRequested,
  onClose,
}) => {
  if (!job) return null;

  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';

  return (
    <Dialog open={open} onOpenChange={(val) => !isRunning && !val && onClose && onClose()}>
      <DialogContent className="max-w-md text-xs">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              {job.title}
            </DialogTitle>
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-mono">
              {job.provider}
            </span>
          </div>
          <DialogDescription className="text-[11px] pt-1">
            Tracking execution phases and task status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Step Timeline */}
          <div className="space-y-2 p-3 rounded-lg border border-border bg-secondary/10">
            {job.steps.map((step) => {
              return (
                <div key={step.id} className="flex items-start gap-2.5 text-[11px]">
                  <div className="mt-0.5 shrink-0">
                    {step.status === 'completed' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    {step.status === 'active' && (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    )}
                    {step.status === 'failed' && (
                      <AlertCircle className="h-4 w-4 text-red-400" />
                    )}
                    {step.status === 'pending' && (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-grow">
                    <span
                      className={
                        step.status === 'active'
                          ? 'font-bold text-foreground'
                          : step.status === 'completed'
                          ? 'text-foreground/90 font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {step.label}
                    </span>
                    {step.detail && (
                      <p className="text-[10px] text-muted-foreground leading-tight">{step.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar (if percent available) */}
          {typeof job.progressPercent === 'number' && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                <span>Progress</span>
                <span>{job.progressPercent}%</span>
              </div>
              <Progress value={job.progressPercent} className="h-1.5" />
            </div>
          )}

          {/* Error Banner */}
          {isFailed && job.error && (
            <div className="p-2.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-[10.5px] flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="leading-tight">{job.error}</div>
            </div>
          )}

          {/* Cancelled Banner */}
          {isCancelled && (
            <div className="p-2.5 rounded border border-amber-500/30 bg-amber-500/10 text-slate-900 dark:text-amber-400 text-[10.5px] flex items-center gap-2 font-medium">
              <XCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-slate-800 dark:text-amber-400 font-semibold">Execution cancellation requested.</div>
            </div>
          )}

          {/* Timer footer indicator */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Elapsed Time:
            </span>
            <span className="font-mono font-bold text-foreground">
              {formatElapsed(job.elapsedSeconds)}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isRunning && job.canCancel && onCancelRequested && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelRequested}
              disabled={job.cancelRequested}
              className="text-xs h-8 text-red-400 border-red-500/30 hover:bg-red-500/10"
            >
              {job.cancelRequested ? 'Cancelling...' : 'Cancel Task'}
            </Button>
          )}

          {(!isRunning || isCompleted || isFailed || isCancelled) && onClose && (
            <Button size="sm" onClick={onClose} className="text-xs font-bold h-8">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
