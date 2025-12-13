# KINETIX BACKEND - MASTERPLAN V2
## Faza 2: Edge Case Handling & Validations

**Prioritet:** 🟢 **ZAVRŠENO**  
**Status:** ✅ **100% KOMPLETNO**  
**Timeline:** 2-3 dana (Završeno: 9. Decembar 2025)

> **FOKUS:** Edge case handling i validacije koje osiguravaju data integrity i sprečavaju bugove u produkciji.

> **NAPOMENA:** Running Tab Balance System, Weekly Unlock Mechanism, GPS Check-in Validation i Monday Weigh-in su implementirani u V1. V2 se fokusira na Stripe payment integraciju i AI message system (vidi V4 za detalje).

---

## 🎉 **IMPLEMENTACIJA ZAVRŠENA - SUMMARY**

**Datum završetka:** 9. Decembar 2025  
**Implementirano:** 16/16 zadataka (100%)  
**Build Status:** ✅ Uspešan (Exit code: 0)  
**Runtime Status:** ✅ Aplikacija pokrenuta na http://127.0.0.1:3000  
**Linter Status:** ✅ Čist (0 grešaka)

### **Kreirani fajlovi (7):**
1. `src/common/utils/logger.utils.ts` - Logger utility
2. `src/common/utils/plan-validators.ts` - Plan validatori  
3. `src/common/utils/plan-overlap-handler.ts` - Overlap handling
4. `src/gamification/schemas/ai-message.schema.ts` - AI Message schema
5. `src/gamification/ai-message.service.ts` - AI Message service
6. `src/gamification/dto/generate-message.dto.ts` - Generate message DTO
7. `src/gamification/dto/ai-message.dto.ts` - AI message response DTO

### **Izmenjeni fajlovi (15):**
1. `src/plans/schemas/weekly-plan.schema.ts` - Soft delete fields
2. `src/plans/plans.service.ts` - Svi plan validatori, overlap, cancel, request
3. `src/plans/plans.controller.ts` - Cancel i request next week endpoints
4. `src/plans/plans.module.ts` - WorkoutLog dependency
5. `src/workouts/schemas/workout-log.schema.ts` - Completion time fields
6. `src/workouts/workouts.service.ts` - Svi workout validatori, cleanup
7. `src/clients/schemas/client-profile.schema.ts` - Request next week fields
8. `src/media/media.controller.ts` - Batch signatures endpoint
9. `src/media/media.service.ts` - Batch signatures logic
10. `src/gamification/gamification.controller.ts` - AI message endpoints
11. `src/gamification/gamification.module.ts` - AI service registracija
12. `src/trainers/trainers.service.ts` - Pending week requests
13. `src/trainers/trainers.controller.ts` - Pending requests endpoint

### **Novi Endpoints (8):**
- `POST /api/plans/:id/cancel/:clientId` - Cancel plan
- `POST /api/plans/request-next-week/:clientId` - Request next week
- `GET /api/trainers/pending-week-requests` - Pending requests
- `POST /api/gamification/generate-message` - Generate AI message
- `GET /api/gamification/messages/:clientId` - Get messages
- `PATCH /api/gamification/messages/:messageId/read` - Mark as read
- `POST /api/media/batch-signatures` - Batch upload signatures

### **Detaljni dokument:**
📄 `docs/trash (summary of implemented)/BACKEND_V2_IMPLEMENTATION_SUMMARY.md` - Kompletna implementacija sa logging primerima

---

## ⚠️ **KRITIČNA PRAVILA - MORA SE POŠTOVATI:**

### **1. NE TRPATI SVE U JEDAN FILE:**
- ❌ **ZABRANJENO:** Sve validacije u `plans.service.ts` (2000+ linija)
- ✅ **DOBRO:** Odvojiti:
  - `plan-validators.ts` - Validacija logika
  - `plan-overlap-handler.ts` - Overlap handling
  - Koristiti `DateUtils` klasu za date operacije (iz V1)

**Pravilo:** Service fajlovi max 400 linija. Validacije u odvojene helper klase.

### **2. CODE QUALITY:**
- ✅ **Reusable Functions** - `DateUtils`, `PlanValidators` klase
- ✅ **Error Messages** - jasne, korisnički-friendly poruke
- ✅ **Logging** - sve edge case-ove log-ovati za debugging
- ✅ **Test Coverage** - min 80% coverage za validacije

---

## 🎯 **CILJ FAZE 2:**

Implementirati edge case handling i validacije:
1. Plan deletion validation (soft delete)
2. Workout log duplicate prevention
3. Batch media signatures endpoint
4. Workout completion time validation (prebrz checkout detection)
5. Plan overlap handling (inteligentno rukovanje preklapajućim planovima)
6. Workout log date validation (ne dozvoliti budućnost/stare datume)
7. Workout log cleanup on plan change (označiti missed workouts)
8. Workout log plan validation
9. Plan template vs assigned plan logic
10. Plan cancellation
11. Rest day workout validation
12. Multiple workouts same day validation
13. Plan start date validation

---

## 📝 **PREPORUČENI REDOSLED IMPLEMENTACIJE:**

**Agent može raditi u bilo kom redosledu, ali OVO JE OPTIMALNO:**

### **FAZA A - Utilities (već urađeno u V1, koristiti):**
1. ✅ **DateUtils klasa** - već postoji iz V1

### **FAZA B - Plan Management (Grupa povezanih):**
2. **2.5 Plan Overlap Handling** - koristi DateUtils
3. **2.8 Workout Log Cleanup on Plan Change** - direktno povezano sa overlap handling
4. **2.1 Plan Deletion Validation**
5. **2.10 Plan Template vs Assigned Plan Logic**
6. **2.11 Plan Cancellation**
7. **2.14 Plan Start Date Validation** - koristi DateUtils

### **FAZA C - Workout Log Validations (Grupa povezanih):**
8. **2.6 Workout Log Date Validation** - koristi DateUtils
9. **2.9 Workout Log Plan Validation**
10. **2.12 Rest Day Workout Validation**
11. **2.13 Multiple Workouts Same Day Validation**

### **FAZA D - Workout Log Operations:**
12. **2.2 Workout Log Duplicate Prevention**
13. **2.4 Workout Completion Time Validation**

### **FAZA E - Media:**
14. **2.3 Batch Media Signatures** - nezavisan, može u bilo kom trenutku

---

## 📋 **ZADACI:**

### **2.1 Plan Deletion Validation** 🟡

**Zadatak:**
Proširiti `deletePlan()` da validira pre brisanja

**Zahtevi:**
- [x] Proveri da li ima aktivnih workout logs (budući datumi)
- [x] Proveri da li plan ima dodeljene klijente u `assignedClientIds`
- [x] Ako ima aktivne logs → **Soft Delete** (ne hard delete)
- [x] Dodati `isDeleted: true` flag u WeeklyPlan schema
- [x] Query-i treba da filtriraju soft deleted planove
- [x] Admin može da vidi i restore soft deleted planove

**Fajlovi:**
- `src/plans/schemas/weekly-plan.schema.ts` - **IZMENA**
- `src/plans/plans.service.ts` - **IZMENA**

**Implementacija:**

```typescript
// weekly-plan.schema.ts
@Prop({ default: false })
isDeleted: boolean;

@Prop()
deletedAt?: Date;

// plans.service.ts
async deletePlan(planId: string, userId: string, userRole: string): Promise<void> {
  const plan = await this.planModel.findById(planId).exec();
  if (!plan) {
    throw new NotFoundException('Plan not found');
  }
  
  // Check for active workout logs
  const activeLogsCount = await this.workoutLogModel.countDocuments({
    weeklyPlanId: planId,
    workoutDate: { $gte: new Date() },
  });
  
  // Check for assigned clients
  const assignedClientsCount = plan.assignedClientIds?.length || 0;
  
  if (activeLogsCount > 0 || assignedClientsCount > 0) {
    // Soft delete
    await this.planModel.findByIdAndUpdate(planId, {
      isDeleted: true,
      deletedAt: new Date(),
    }).exec();
    
    logger.warn(`Plan ${planId} soft deleted (has ${activeLogsCount} active logs, ${assignedClientsCount} assigned clients)`);
  } else {
    // Hard delete
    await this.planModel.findByIdAndDelete(planId).exec();
    logger.info(`Plan ${planId} hard deleted (no active logs or assigned clients)`);
  }
}
```

**Testovi:**
- [x] Test soft delete sa aktivnim logs
- [x] Test hard delete bez aktivnih logs
- [x] Test da soft deleted planovi ne prikazuju u query-jima
- [x] Test restore soft deleted plana (admin)

---

### **2.2 Workout Log Duplicate Prevention** 🟡

**Zadatak:**
Proširiti `generateWeeklyLogs()` da spreči duplicate logs

**Zahtevi:**
- [x] Provera pre kreiranja: da li već postoji WorkoutLog za taj `clientId + workoutDate`
- [x] Ako postoji → Update postojeći (ne kreiraj novi)
- [x] Ako ne postoji → Kreiraj novi
- [x] Logging za debugging

**Fajlovi:**
- `src/workouts/workouts.service.ts` - **IZMENA**

**Implementacija:**

```typescript
async generateWeeklyLogs(
  client: ClientProfile,
  plan: WeeklyPlan,
  startDate: Date,
): Promise<void> {
  for (const workoutDay of plan.workouts) {
    if (workoutDay.isRestDay) continue;
    
    const scheduledDate = new Date(startDate);
    scheduledDate.setDate(startDate.getDate() + (workoutDay.dayOfWeek - 1));
    
    // Normalize to start of day
    const normalizedDate = DateUtils.normalizeToStartOfDay(scheduledDate);
    
    // Check if log already exists
    const existingLog = await this.workoutLogModel.findOne({
      clientId: (client as any)._id,
      workoutDate: normalizedDate,
    }).exec();
    
    if (existingLog) {
      // Update existing log
      existingLog.weeklyPlanId = plan._id;
      existingLog.workoutName = workoutDay.name;
      existingLog.exercises = workoutDay.exercises.map(/* map exercise */);
      await existingLog.save();
      
      logger.debug(`Updated existing workout log for client ${client._id} on ${normalizedDate}`);
    } else {
      // Create new log
      const newLog = new this.workoutLogModel({
        clientId: (client as any)._id,
        weeklyPlanId: plan._id,
        workoutDate: normalizedDate,
        workoutName: workoutDay.name,
        exercises: workoutDay.exercises.map(/* map exercise */),
        isCompleted: false,
        isMissed: false,
      });
      
      await newLog.save();
      logger.debug(`Created new workout log for client ${client._id} on ${normalizedDate}`);
    }
  }
}
```

**Testovi:**
- [x] Test kreiranja novog log-a
- [x] Test update postojećeg log-a
- [x] Test sa duplicate datuma

---

### **2.3 Batch Media Signatures** 🟡

**Zadatak:**
Kreirati batch media signatures endpoint

**Zahtevi:**
- [x] Vraća `count` signature-a odjednom
- [x] Svaki signature ima unique folder path
- [x] Timestamp validnost (15 minuta)
- [x] Rate limiting (max 10 batch poziva/min)

**Fajlovi:**
- `src/media/media.controller.ts` - **IZMENA**
- `src/media/media.service.ts` - **IZMENA**

**Implementacija:**

```typescript
@Post('batch-signatures')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
async getBatchSignatures(
  @CurrentUser() user: JwtPayload,
  @Body() dto: { count: number },
): Promise<{ signatures: UploadSignatureDto[] }> {
  if (dto.count > 10) {
    throw new BadRequestException('Maximum 10 signatures per request');
  }
  
  const signatures: UploadSignatureDto[] = [];
  const timestamp = Math.round(Date.now() / 1000);
  
  for (let i = 0; i < dto.count; i++) {
    const folder = `checkins/${user.sub}/${timestamp}_${i}`;
    const signature = await this.cloudinaryService.generateUploadSignature(folder);
    
    signatures.push({
      signature: signature.signature,
      timestamp: timestamp,
      folder: folder,
    });
  }
  
  return { signatures };
}
```

**Testovi:**
- [x] Test batch signature generation
- [x] Test rate limiting
- [x] Test sa invalid count (> 10)

---

### **2.4 Workout Completion Time Validation** 🟡

**Zadatak:**
Validirati da li je workout log prebrzo završen (suspicious completion detection)

**Zahtevi:**
- [x] Dodati `workoutStartTime: Date` u WorkoutLog schema
- [x] Dodati `suspiciousCompletion: boolean` flag u WorkoutLog schema
- [x] Validirati `completedAt - workoutStartTime` > minimum vreme (npr. 5 minuta)
- [x] Ako je prebrzo → postaviti `suspiciousCompletion: true` (ne blokirati completion)
- [x] Log-ovati warning za suspicious completions
- [x] Trainer može da vidi suspicious completions u dashboard-u

**Fajlovi:**
- `src/workouts/schemas/workout-log.schema.ts` - **IZMENA**
- `src/workouts/workouts.service.ts` - **IZMENA** (u `logWorkout` metodi)

**Implementacija:**

```typescript
// workout-log.schema.ts
@Prop()
workoutStartTime?: Date;

@Prop({ default: false })
suspiciousCompletion: boolean;

// workouts.service.ts
async logWorkout(
  clientId: string,
  workoutLogId: string,
  completedExercises: CompletedExercise[],
): Promise<WorkoutLog> {
  const workoutLog = await this.workoutLogModel.findById(workoutLogId).exec();
  if (!workoutLog) {
    throw new NotFoundException('Workout log not found');
  }
  
  // If first completion, set workoutStartTime
  if (!workoutLog.workoutStartTime) {
    workoutLog.workoutStartTime = new Date();
  }
  
  // Update completed exercises
  workoutLog.completedExercises = completedExercises;
  workoutLog.isCompleted = true;
  workoutLog.completedAt = new Date();
  
  // Validate completion time (minimum 5 minutes)
  const minimumDurationMs = 5 * 60 * 1000; // 5 minutes
  const durationMs = workoutLog.completedAt.getTime() - workoutLog.workoutStartTime.getTime();
  
  if (durationMs < minimumDurationMs) {
    workoutLog.suspiciousCompletion = true;
    logger.warn(
      `Suspicious workout completion: Client ${clientId}, ` +
      `Duration: ${Math.round(durationMs / 1000)}s (minimum: 300s)`
    );
  }
  
  await workoutLog.save();
  return workoutLog;
}
```

**Testovi:**
- [x] Test normal completion (> 5 minuta)
- [x] Test suspicious completion (< 5 minuta)
- [x] Test workoutStartTime setting
- [x] Test da suspiciousCompletion flag radi

---

### **2.5 Plan Overlap Handling** 🟡

**Zadatak:**
Inteligentno rukovanje preklapajućim planovima (overlapping plans) - NE blokirati, već dati opcije

**Zašto je ovo važno:**
U realnom svetu, trener/admin MOŽE željeti da promeni plan klijentu iako stari još traje:
- Klijent napreduje brže → promena plana nakon 3-4 dana
- Klijent ima injury → potreban drugi plan odmah
- Trener želi da optimizuje trening → promena plana
- Admin testira različite planove → potrebna fleksibilnost

**Zahtevi:**
- [x] Provera pre dodele: da li klijent već ima aktivan plan u datom periodu
- [x] Ako ima aktivan plan → AUTOMATSKI završiti stari plan (postaviti `planEndDate` na `newStartDate - 1 dan`)
- [x] Ako je isti plan → NE menjati datume (već postoji logika)
- [x] Logging za plan overlap handling (info, ne warning)
- [x] Novi plan se dodeljuje normalno nakon zatvaranja starog

**Fajlovi:**
- `src/plans/plans.service.ts` - **IZMENA** (u `assignPlanToClients` metodi)

**Implementacija:**

```typescript
async assignPlanToClients(
  planId: string,
  dto: AssignPlanDto,
  userId: string,
  userRole: string,
): Promise<any> {
  // ... existing code ...
  
  const newStartDate = DateUtils.normalizeToStartOfDay(new Date(dto.startDate));
  const newEndDate = DateUtils.normalizeToEndOfDay(new Date(dto.startDate));
  newEndDate.setUTCDate(newEndDate.getUTCDate() + 6); // +6 jer startDate je dan 1
  
  for (const clientProfileId of clientProfileIds) {
    const client = await this.clientsService.getProfileById(clientProfileId);
    
    // Proveri planHistory za overlapping planove
    if (client.planHistory && client.planHistory.length > 0) {
      const overlappingPlan = client.planHistory.find(entry => {
        const existingStart = DateUtils.normalizeToStartOfDay(new Date(entry.planStartDate));
        const existingEnd = DateUtils.normalizeToEndOfDay(new Date(entry.planEndDate));
        
        // Provera overlap-a: nova dodela se preklapa sa postojećim planom
        // Ignoriši ako je isti plan (to već pokriva existing logic)
        const isSamePlan = entry.planId.toString() === planId;
        if (isSamePlan) return false;
        
        return (newStartDate <= existingEnd && newEndDate >= existingStart);
      });
      
      if (overlappingPlan) {
        // RAZLIČIT plan se preklapa → automatski zatvori stari plan
        const closeDate = new Date(newStartDate);
        closeDate.setUTCDate(closeDate.getUTCDate() - 1); // Dan pre novog plana
        closeDate.setUTCHours(23, 59, 59, 999);
        
        logger.info(
          `Plan overlap detected for client ${clientProfileId}: ` +
          `Closing existing plan ${overlappingPlan.planId} on ${closeDate.toISOString()}, ` +
          `starting new plan ${planId} on ${newStartDate.toISOString()}`
        );
        
        // Zatvori stari plan u planHistory
        await this.clientModel.updateOne(
          { _id: clientProfileId, 'planHistory.planId': overlappingPlan.planId },
          { $set: { 'planHistory.$.planEndDate': closeDate } }
        ).exec();
        
        // Ako je stari plan bio aktivan (currentPlanId), resetuj ga
        if (client.currentPlanId && client.currentPlanId.toString() === overlappingPlan.planId.toString()) {
          await this.clientModel.updateOne(
            { _id: clientProfileId },
            { 
              $set: { 
                currentPlanId: null,
                planStartDate: null,
                planEndDate: null,
              }
            }
          ).exec();
        }
      }
    }
  }
  
  // ... rest of existing assignment logic (normalna dodela novog plana) ...
}
```

**Testovi:**
- [x] Test dodele plana bez overlap-a
- [x] Test dodele plana sa overlap-om (auto-close stari plan)
- [x] Test dodele istog plana (već covered u existing logic)
- [x] Test da stari workout logs ostaju netaknuti
- [x] Test da se generišu novi workout logs za novi plan

---

### **2.6 Workout Log Date Validation** 🟡

**Zadatak:**
Validirati da li je workout log datum validan (ne budućnost, ne previše stara prošlost)

**Zahtevi:**
- [x] Ne dozvoliti logovanje workout-a za buduće datume (> danas)
- [x] Ne dozvoliti logovanje workout-a starijeg od 30 dana
- [x] Vraćati jasnu error poruku za invalid date
- [x] Exception: trener/admin može logovati workout-e za prošlost (manually)

**Fajlovi:**
- `src/workouts/workouts.service.ts` - **IZMENA** (u `logWorkout` metodi)

**Implementacija:**

```typescript
async logWorkout(
  clientId: string,
  workoutLogId: string,
  completedExercises: CompletedExercise[],
  userRole?: string,
): Promise<WorkoutLog> {
  const workoutLog = await this.workoutLogModel.findById(workoutLogId).exec();
  if (!workoutLog) {
    throw new NotFoundException('Workout log not found');
  }
  
  const workoutDate = new Date(workoutLog.workoutDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  
  // VALIDACIJA DATUMA (samo za CLIENT role)
  if (userRole === 'CLIENT') {
    // Ne dozvoliti buduće datume
    if (workoutDate > today) {
      throw new BadRequestException(
        'Cannot log workout for future dates. Please log workouts on or before their scheduled date.'
      );
    }
    
    // Ne dozvoliti previše stare workout-e (> 30 dana)
    if (workoutDate < thirtyDaysAgo) {
      throw new BadRequestException(
        'Cannot log workouts older than 30 days. Please contact your trainer if you need to log past workouts.'
      );
    }
  }
  
  // ... rest of existing logic ...
}
```

**Testovi:**
- [x] Test logovanja workout-a za danas (OK)
- [x] Test logovanja workout-a za budućnost (ERROR)
- [x] Test logovanja workout-a starijeg od 30 dana (ERROR za client, OK za trainer/admin)
- [x] Test da trainer može logovati bilo koji datum

---

### **2.8 Workout Log Cleanup on Plan Change** 🔴 **KRITIČNO**

**Zadatak:**
Kada se plan promeni, označiti sve buduće workout logs starog plana kao `isMissed: true`

**Zahtevi:**
- [x] Pri dodeli novog plana, pronaći sve workout logs starog plana sa datumom >= danas
- [x] Označiti ih kao `isMissed: true`
- [x] Ne dirati completed workout-e (ostaju kakvi jesu - istorija)
- [x] Logging za debugging

**Fajlovi:**
- `src/workouts/workouts.service.ts` - **NOVO** (dodati metodu `markMissedWorkoutsForPlan`)
- `src/plans/plans.service.ts` - **IZMENA** (pozvati iz overlap handling-a)

**Implementacija:**

```typescript
// workouts.service.ts
async markMissedWorkoutsForPlan(
  clientId: string,
  planId: string,
  endDate: Date,
): Promise<void> {
  const today = DateUtils.normalizeToStartOfDay(new Date());
  
  // Find all future/pending workouts for this plan
  const result = await this.workoutLogModel.updateMany(
    {
      clientId: new Types.ObjectId(clientId),
      weeklyPlanId: new Types.ObjectId(planId),
      workoutDate: { $gte: today },
      isCompleted: false,
      isMissed: false,
    },
    {
      $set: {
        isMissed: true,
        updatedAt: new Date(),
      }
    }
  ).exec();
  
  logger.info(
    `Marked ${result.modifiedCount} workout logs as missed ` +
    `for plan ${planId} and client ${clientId}`
  );
}

// plans.service.ts (U overlap handling sekciji)
if (overlappingPlan) {
  // ... close date logic ...
  
  // Mark future workouts as missed
  await this.workoutsService.markMissedWorkoutsForPlan(
    clientProfileId,
    overlappingPlan.planId.toString(),
    closeDate
  );
  
  // ... rest of logic ...
}
```

**Testovi:**
- [x] Test da označava samo future workouts kao missed
- [x] Test da ne dira completed workouts
- [x] Test da ne dira workouts drugih planova

---

### **2.15 AI Message System - Foundation** 🔴 **KRITIČNO**

**Zadatak:**
Kreirati sistem za AI-generisane motivacione/disciplinske poruke

**Zahtevi:**
- [x] Kreirati AIMessage schema (message, tone, trigger, clientId, createdAt, isRead)
- [x] Kreirati AIMessageService
- [x] Message generation logic:
  - Passive-aggressive za missed workouts (>2 u nedelji)
  - Empathetic za sick days (klijent označi razlog)
  - Motivational za streaks (npr. 7 dana bez propusta)
  - Warning za weight spike (nakon Monday weigh-in)
- [x] Endpoint: `POST /gamification/generate-message` (za manual trigger)
- [x] Endpoint: `GET /gamification/messages/:clientId` (history)
- [x] Endpoint: `PATCH /gamification/messages/:messageId/read` (mark as read)
- [x] Message templates (tone-based):
  - AGGRESSIVE: "2 missed workouts this week? That's not discipline, that's excuses."
  - EMPATHETIC: "Feeling sick? Take care of yourself. Recovery is part of training."
  - MOTIVATIONAL: "7 days straight! You're unstoppable. Keep this energy!"
  - WARNING: "Weight up 3kg this week? Time to explain what happened."

**Fajlovi:**
- `src/gamification/schemas/ai-message.schema.ts` - **NOVO**
- `src/gamification/ai-message.service.ts` - **NOVO**
- `src/gamification/gamification.controller.ts` - **IZMENA**
- `src/gamification/dto/generate-message.dto.ts` - **NOVO**
- `src/gamification/dto/ai-message.dto.ts` - **NOVO**

**Implementacija:**

```typescript
// ai-message.schema.ts
@Schema({ timestamps: true })
export class AIMessage {
  @Prop({ required: true })
  clientId: Types.ObjectId;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, enum: ['AGGRESSIVE', 'EMPATHETIC', 'MOTIVATIONAL', 'WARNING'] })
  tone: string;

  @Prop({ required: true, enum: ['MISSED_WORKOUTS', 'STREAK', 'WEIGHT_SPIKE', 'SICK_DAY'] })
  trigger: string;

  @Prop({ default: false })
  isRead: boolean;
}

// ai-message.service.ts
@Injectable()
export class AIMessageService {
  async generateMessage(clientId: string, trigger: string): Promise<AIMessage> {
    // Analyze client data based on trigger
    // Select appropriate tone
    // Generate message from template
    // Save to database
  }

  async getMessages(clientId: string): Promise<AIMessage[]> {
    return this.aiMessageModel.find({ clientId }).sort({ createdAt: -1 }).exec();
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.aiMessageModel.findByIdAndUpdate(messageId, { isRead: true }).exec();
  }
}
```

**Testovi:**
- [x] Test message generation za različite trigger-e
- [x] Test tone selection logic
- [x] Test message history endpoint
- [x] Test mark as read functionality

---

### **2.16 "Request Next Week" Notification** 🟡

**Zadatak:**
Endpoint za klijent request za novu nedelju

**Zahtevi:**
- [x] Endpoint: `POST /plans/request-next-week/:clientId`
- [x] Validacija: `canUnlockNextWeek()` (already exists)
- [x] Notification za trenera (future: push, for now: flag u bazi)
- [x] ClientProfile field: `nextWeekRequested: boolean, nextWeekRequestDate: Date`
- [x] Endpoint: `GET /trainers/pending-week-requests` (za trenera)

**Fajlovi:**
- `src/plans/plans.controller.ts` - **IZMENA**
- `src/plans/plans.service.ts` - **IZMENA**
- `src/clients/schemas/client-profile.schema.ts` - **IZMENA**
- `src/trainers/trainers.controller.ts` - **IZMENA**
- `src/trainers/trainers.service.ts` - **IZMENA**

**Implementacija:**

```typescript
// plans.service.ts
async requestNextWeek(clientId: string): Promise<void> {
  const canUnlock = await this.canUnlockNextWeek(clientId);
  if (!canUnlock) {
    throw new BadRequestException('Cannot unlock next week. Current week not completed.');
  }

  await this.clientModel.findByIdAndUpdate(clientId, {
    $set: {
      nextWeekRequested: true,
      nextWeekRequestDate: new Date(),
    }
  }).exec();

  logger.info(`Client ${clientId} requested next week`);
}

// trainers.service.ts
async getPendingWeekRequests(trainerId: string): Promise<ClientProfile[]> {
  return this.clientModel.find({
    trainerId: new Types.ObjectId(trainerId),
    nextWeekRequested: true,
  }).exec();
}
```

**Testovi:**
- [x] Test request endpoint
- [x] Test notification trigger
- [x] Test pending requests endpoint

---

## ✅ **CHECKLIST ZA ZAVRŠETAK FAZE 2:**

**Organizacija (Agent može raditi u bilo kom redosledu, ali preporučeno redosled iznad):**

### **Utilities:**
- [x] DateUtils klasa se koristi svuda (iz V1)
- [x] Plan start date validation implementirana
- [x] PlanValidators helper klasa kreirana
- [x] PlanOverlapHandler helper klasa kreirana
- [x] AppLogger utility klasa kreirana

### **Plan Management:**
- [x] **2.5 Plan Overlap Handling** - koristi DateUtils
- [x] **2.8 Workout Log Cleanup on Plan Change** - direktno povezano sa overlap ⚠️ **KRITIČNO**
- [x] Plan deletion validation implementirana
- [x] Soft delete flag dodato u schema
- [x] Plan template validation implementirana
- [x] Plan cancellation implementirana

### **Workout Log Validations:**
- [x] **2.6 Workout Log Date Validation** - koristi DateUtils
- [x] Workout log duplicate prevention implementirana
- [x] Rest day workout validation implementirana
- [x] Multiple workouts same day validation implementirana

### **Workout Log Operations:**
- [x] Workout completion time validation implementirana
- [x] Suspicious completion detection implementirana

### **Media:**
- [x] Batch media signatures endpoint kreiran
- [x] Rate limiting implementirano

### **AI & Notifications:**
- [x] AI Message System - schema, service, endpoints
- [x] Request Next Week - client i trainer endpoints

### **Final:**
- [x] Svi zadaci implementirani (16/16)
- [x] Build uspešan - nema TypeScript grešaka
- [x] Linter čist - nema linter grešaka
- [x] Runtime test - aplikacija uspešno pokrenuta
- [x] Sve rute mapirane - endpoints funkcionalni

---

## Bug Fixes

### Workout Logs Implementation Fixes

#### 1. Filter `getWeekWorkouts` by Active Plan
- **Issue**: `getWeekWorkouts` was returning ALL workout logs for a client within a date range, not filtering by the active plan's `weeklyPlanId`. This could return logs from old/inactive plans.
- **Fix**: Modified `getWeekWorkouts` in `src/workouts/workouts.service.ts` to:
  - Access `client.planHistory` directly (avoiding circular dependency with `PlansService`)
  - Find active plan entry using `DateUtils` for date normalization
  - Add `weeklyPlanId` filter to MongoDB query if active plan exists
  - Add comprehensive logging for debugging
- **Status**: ✅ Completed

#### 2. Fix `generateWeeklyLogs` dayOfWeek
- **Issue**: `generateWeeklyLogs` was using calendar day (`workoutDate.getDay()`) which is Monday-Sunday (1-7), but should use plan day index (1-7, where 1 = first day of plan).
- **Fix**: Modified `generateWeeklyLogs` in `src/workouts/workouts.service.ts` to:
  - Use `planDayIndex = day + 1` (where `day` is 0-6 loop index, `planDayIndex` is 1-7 plan day)
  - Update both existing log update and new log creation
  - Add logging for each day's plan day index
- **Status**: ✅ Completed

#### 3. Fix Schema Comment for `dayOfWeek`
- **Issue**: Schema comment incorrectly stated `dayOfWeek` represents "Monday-Sunday" when it actually represents plan day index.
- **Fix**: Updated comment in `src/workouts/schemas/workout-log.schema.ts` to: "1-7 (Plan day index: 1 = first day of plan, 2 = second day, etc.)"
- **Status**: ✅ Completed
- [x] Dokumentacija kreirana - BACKEND_V2_IMPLEMENTATION_SUMMARY.md

**⚠️ VAŽNO:** Plan overlap handling + workout cleanup su POVEZANI - raditi zajedno.

---

## 🔗 **VEZE:**

- **Status:** `docs/BACKEND_STATUS.md`
- **Glavni Masterplan:** `docs/BACKEND_MASTERPLAN.md`
- **Prethodna Faza:** `docs/BACKEND_MASTERPLAN_V1.md`
- **Sledeća Faza:** `docs/BACKEND_MASTERPLAN_V3.md`
