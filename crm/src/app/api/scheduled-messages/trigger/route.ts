import { NextResponse } from 'next/server';
import { checkAndTriggerDueMessages, startSchedulerWorker } from '@/lib/scheduler-worker';

export async function POST() {
  try {
    // Ensure the background singleton worker is running
    startSchedulerWorker();

    // Run an immediate check & trigger of any due messages
    const result = await checkAndTriggerDueMessages();

    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error('Trigger scheduled messages error:', err);
    return NextResponse.json(
      { error: err.message || 'Error triggering scheduled messages' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Allow GET as well for simple polling or manual health-check / cron pings
  return POST();
}
