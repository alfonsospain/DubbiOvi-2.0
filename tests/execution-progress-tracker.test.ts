import { ExecutionProgressTracker } from '../src/runtime/progress/ExecutionProgressTracker';

async function runExecutionProgressTrackerTests() {
  console.log('=====================================================');
  console.log(' STARTING EXECUTION PROGRESS TRACKER TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Job Creation & Initial State
  console.log('\n[Test 1] Initializing ExecutionProgressTracker...');
  const tracker = new ExecutionProgressTracker({
    title: 'Test Batch Job',
    provider: 'Generic Engine',
    canCancel: true,
    steps: [
      { id: 'step-1', label: 'Initialization' },
      { id: 'step-2', label: 'Processing' },
      { id: 'step-3', label: 'Finalization' },
    ],
  });

  let job = tracker.getJob();
  if (job.status !== 'idle') throw new Error('FAILED: Expected initial status "idle"');
  if (job.steps.length !== 3) throw new Error('FAILED: Expected 3 steps');
  console.log('  ✓ ExecutionProgressTracker initialized cleanly in "idle" status.');

  // 2. Start Execution & Step Transitions
  console.log('\n[Test 2] Testing job execution & step transitions...');
  tracker.start();
  job = tracker.getJob();
  if (job.status !== 'running') throw new Error('FAILED: Expected status "running"');
  if (job.currentStepId !== 'step-1') throw new Error('FAILED: Expected current step "step-1"');
  console.log('  ✓ Job started successfully in "running" status.');

  tracker.setStep('step-2', 'Processing item 1 of 10');
  job = tracker.getJob();
  if (job.currentStepId !== 'step-2') throw new Error('FAILED: Expected current step "step-2"');
  if (job.steps[0].status !== 'completed') throw new Error('FAILED: Expected step-1 to be "completed"');
  if (job.steps[1].status !== 'active') throw new Error('FAILED: Expected step-2 to be "active"');
  console.log('  ✓ Step transition step-1 -> step-2 verified.');

  // 3. Testing Cancellation Request State
  console.log('\n[Test 3] Testing cancellation request handling...');
  tracker.requestCancel();
  job = tracker.getJob();
  if (!job.cancelRequested) throw new Error('FAILED: cancelRequested should be true');
  if (job.status !== 'cancelled') throw new Error('FAILED: Job status should be "cancelled"');
  console.log('  ✓ Cancellation request set cancelRequested = true and status = "cancelled".');

  // 4. Testing Completion & Failure Transitions
  console.log('\n[Test 4] Testing complete() and fail() transitions...');
  const tracker2 = new ExecutionProgressTracker({
    title: 'Test Job 2',
    provider: 'Test Provider',
    steps: [{ id: 's1', label: 'S1' }],
  });

  tracker2.start();
  tracker2.complete();
  let job2 = tracker2.getJob();
  if (job2.status !== 'completed' || job2.progressPercent !== 100) {
    throw new Error('FAILED: complete() did not set status="completed" and progressPercent=100');
  }
  console.log('  ✓ tracker.complete() verified.');

  tracker2.fail('Resource error');
  job2 = tracker2.getJob();
  if (job2.status !== 'failed' || job2.error !== 'Resource error') {
    throw new Error('FAILED: fail() did not set status="failed" and error message');
  }
  console.log('  ✓ tracker.fail() verified.');

  console.log('\n=====================================================');
  console.log(' EXECUTION PROGRESS TRACKER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runExecutionProgressTrackerTests().catch((err) => {
  console.error('\n❌ ExecutionProgressTracker Test Error:', err);
  process.exit(1);
});
