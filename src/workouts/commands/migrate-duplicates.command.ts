import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { MigrateWorkoutLogDuplicatesService } from '../migrations/migrate-workout-log-duplicates';

/**
 * CLI command to run migration script for workout log duplicates
 * 
 * Usage:
 *   yarn migrate:duplicates
 *   OR
 *   ts-node src/workouts/commands/migrate-duplicates.command.ts
 */
async function migrateDuplicates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Starting workout log duplicates migration...');
  console.log('═══════════════════════════════════════════════════════════');

  let app;
  try {
    // Create NestJS application context (doesn't start HTTP server)
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get migration service from DI container
    const migrationService = app.get(MigrateWorkoutLogDuplicatesService);

    // Run migration
    const result = await migrationService.migrateDuplicates();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('Migration completed successfully!');
    console.log(`- Merged duplicates: ${result.merged}`);
    console.log(`- Normalized dates: ${result.normalized}`);
    console.log(`- Errors: ${result.errors}`);
    console.log('═══════════════════════════════════════════════════════════');

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Migration failed:', error);
    console.error('═══════════════════════════════════════════════════════════');
    
    if (app) {
      await app.close();
    }
    process.exit(1);
  }
}

// Run migration
migrateDuplicates();

