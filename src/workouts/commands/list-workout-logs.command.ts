import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { WorkoutLog, WorkoutLogDocument } from '../schemas/workout-log.schema';
import { PlansService } from '../../plans/plans.service';

/**
 * CLI command to list all workout logs with details
 * 
 * Usage:
 *   yarn list:workout-logs
 *   OR
 *   ts-node src/workouts/commands/list-workout-logs.command.ts
 */
async function listWorkoutLogs() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Listing all workout logs...');
  console.log('═══════════════════════════════════════════════════════════');

  let app;
  try {
    // Create NestJS application context (doesn't start HTTP server)
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });

    // Get workout log model from DI container
    const workoutLogModel = app.get(
      getModelToken(WorkoutLog.name),
    ) as Model<WorkoutLogDocument>;

    // Get plans service to enrich workout names
    const plansService = app.get(PlansService);

    // Fetch all workout logs, sorted by date
    const allLogs = await workoutLogModel
      .find({})
      .sort({ workoutDate: 1, createdAt: 1 })
      .lean()
      .exec();

    console.log(`\nTotal workout logs found: ${allLogs.length}\n`);

    // Group by date to find duplicates
    const logsByDate = new Map<string, any[]>();
    for (const log of allLogs) {
      const dateKey = log.workoutDate.toISOString().split('T')[0];
      if (!logsByDate.has(dateKey)) {
        logsByDate.set(dateKey, []);
      }
      logsByDate.get(dateKey)!.push(log);
    }

    // Find dates with multiple logs (potential duplicates)
    const duplicateDates: string[] = [];
    for (const [date, logs] of logsByDate.entries()) {
      if (logs.length > 1) {
        duplicateDates.push(date);
      }
    }

    if (duplicateDates.length > 0) {
      console.log('⚠️  WARNING: Found dates with multiple workout logs:');
      duplicateDates.forEach((date) => {
        console.log(`   - ${date}: ${logsByDate.get(date)!.length} logs`);
      });
      console.log('');
    }

    // Print all logs with details
    for (let i = 0; i < allLogs.length; i++) {
      const log = allLogs[i] as any;
      const dateKey = log.workoutDate.toISOString().split('T')[0];
      const isDuplicate = duplicateDates.includes(dateKey);

      // Try to get workout name from plan
      let workoutName = 'Unknown';
      let isRestDay = false;
      try {
        const planId = log.weeklyPlanId?.toString();
        if (planId) {
          // CLI command uses ADMIN role to bypass ownership checks
          const plan = await plansService.getPlanById(planId, '', 'ADMIN');
          if (plan && (plan as any).workouts) {
            const planWorkout = ((plan as any).workouts as any[]).find(
              (w: any) => w.dayOfWeek === log.dayOfWeek,
            );
            if (planWorkout) {
              workoutName = planWorkout.name || 'Unknown';
              isRestDay = planWorkout.isRestDay || false;
            }
          }
        }
      } catch (error) {
        // Plan might not exist, use default
      }

      console.log('─────────────────────────────────────────────────────────');
      console.log(`Workout Log #${i + 1}${isDuplicate ? ' ⚠️ DUPLICATE DATE' : ''}`);
      console.log('─────────────────────────────────────────────────────────');
      console.log(`ID:                    ${log._id}`);
      console.log(`Client ID:             ${log.clientId}`);
      console.log(`Trainer ID:            ${log.trainerId}`);
      console.log(`Plan ID:               ${log.weeklyPlanId}`);
      console.log(`Workout Date:          ${dateKey} (${log.workoutDate.toISOString()})`);
      console.log(`Day of Week (Plan):    ${log.dayOfWeek}`);
      console.log(`Workout Name:          ${workoutName}${isRestDay ? ' (Rest Day)' : ''}`);
      console.log(`Is Completed:          ${log.isCompleted}`);
      console.log(`Is Missed:             ${log.isMissed}`);
      console.log(`Completed Exercises:   ${log.completedExercises?.length || 0}`);
      console.log(`Created At:            ${log.createdAt?.toISOString() || 'N/A'}`);
      console.log(`Updated At:            ${log.updatedAt?.toISOString() || 'N/A'}`);
      
      if (log.completedExercises && log.completedExercises.length > 0) {
        console.log(`\nCompleted Exercises:`);
        log.completedExercises.forEach((ex: any, idx: number) => {
          console.log(`  ${idx + 1}. ${ex.exerciseName}`);
          console.log(`     Sets: ${ex.actualSets}, Reps: ${ex.actualReps?.join(', ') || 'N/A'}, Weight: ${ex.weightUsed || 'N/A'}kg`);
        });
      }
      
      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Summary:');
    console.log(`- Total logs: ${allLogs.length}`);
    console.log(`- Unique dates: ${logsByDate.size}`);
    console.log(`- Dates with duplicates: ${duplicateDates.length}`);
    if (duplicateDates.length > 0) {
      console.log('\nDuplicate dates breakdown:');
      for (const date of duplicateDates) {
        const logs = logsByDate.get(date)!;
        console.log(`\n  ${date} (${logs.length} logs):`);
        logs.forEach((log, idx) => {
          console.log(`    ${idx + 1}. ID: ${log._id}, DayOfWeek: ${log.dayOfWeek}, Plan: ${log.weeklyPlanId}`);
        });
      }
    }
    console.log('═══════════════════════════════════════════════════════════');

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Failed to list workout logs:', error);
    console.error('═══════════════════════════════════════════════════════════');
    
    if (app) {
      await app.close();
    }
    process.exit(1);
  }
}

// Run command
listWorkoutLogs();

