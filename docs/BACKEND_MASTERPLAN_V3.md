# KINETIX BACKEND - MASTERPLAN V3
## Faza 3: Admin Dashboard Endpoints

**Prioritet:** 🟡 **SREDNJI**  
**Status:** ❌ Nije početo  
**Timeline:** 1 dan

> **FOKUS:** Admin dashboard endpointi za check-ins management i analytics.

---

## ⚠️ **KRITIČNA PRAVILA - MORA SE POŠTOVATI:**

### **1. NE TRPATI SVE U JEDAN FILE:**
- ❌ **ZABRANJENO:** Sve admin logika u `admin.service.ts` (1500+ linija)
- ✅ **DOBRO:** Odvojiti:
  - `admin-analytics.service.ts` - Analytics logika
  - `admin-checkins.service.ts` - Check-ins management
  - `admin-notifications.service.ts` - Notifications (cron jobs)

**Pravilo:** Admin service max 400 linija. Svaka funkcionalnost u svoj service.

### **2. CODE QUALITY:**
- ✅ **Cron Jobs** - odvojiti u `jobs/` folder
- ✅ **Analytics** - reusable query builder funkcije
- ✅ **Validation** - input sanitization u odvojene helper klase

---

## 🎯 **CILJ FAZE 3:**

Implementirati admin dashboard endpointi i dodatne funkcionalnosti:
1. Check-ins Management endpoints
2. Analytics endpoints
3. Improved validation messages
4. Plan expiration notifications (obaveštavanje trenera)
5. Input sanitization (security)
6. Plan renewal feature (produžiti plan za 7 dana)
7. Trainer switch handling (kritično za data integrity)

---

## 📋 **ZADACI:**

### **3.1 Check-ins Management Endpoints** 🟡

**Zahtevi:**
- [ ] `GET /api/admin/check-ins` - lista svih check-ins sa filterima
- [ ] `GET /api/admin/check-ins/:id` - detalji check-in-a
- [ ] `DELETE /api/admin/check-ins/:id` - brisanje check-in-a
- [ ] Filteri: `date`, `clientId`, `status` (verified/unverified)
- [ ] Paginacija

**Fajlovi:**
- `src/admin/admin.controller.ts` - **IZMENA**
- `src/admin/admin.service.ts` - **IZMENA**

---

### **3.2 Analytics Endpoints** 🟡

**Zahtevi:**
- [ ] `GET /api/admin/analytics/users` - user growth over time
- [ ] `GET /api/admin/analytics/workouts` - workout completion rates
- [ ] `GET /api/admin/analytics/check-ins` - check-in stats
- [ ] `GET /api/admin/analytics/trainers` - trainer performance metrics
- [ ] Time range filters (last 7 days, 30 days, etc.)

**Fajlovi:**
- `src/admin/admin.controller.ts` - **IZMENA**
- `src/admin/admin.service.ts` - **IZMENA**

---

### **3.3 Improved Validation Messages** 🟢

**Zahtevi:**
- [ ] Svi `BadRequestException` treba da imaju detaljne poruke
- [ ] Svi `NotFoundException` treba da imaju ID koji je nedostajao
- [ ] Svi `ForbiddenException` treba da objasne zašto je zabranjeno
- [ ] Logging pre svakog exception-a (sa context-om)

**Fajlovi:**
- Svi service fajlovi - **IZMENA**

---

### **3.4 Plan Expiration Notifications** 🟡

**Zadatak:**
Obaveštavati trenere kada klijentov plan ističe

**Zahtevi:**
- [ ] Cron job koji proverava planove koji ističu za 1 dan
- [ ] Slanje notifikacije treneru (email/push - future)
- [ ] Dashboard badge za trenere (koliko planova ističe)
- [ ] Endpoint: `GET /api/trainers/expiring-plans` (planovi koji ističu za 1-3 dana)

**Fajlovi:**
- `src/trainers/jobs/plan-expiration-notifier.job.ts` - **NOVO**
- `src/trainers/trainers.service.ts` - **IZMENA** (dodati getExpiringPlans)

**Implementacija:**

```typescript
// plan-expiration-notifier.job.ts
@Injectable()
export class PlanExpirationNotifierJob {
  @Cron('0 9 * * *') // Svaki dan u 9:00
  async checkExpiringPlans() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(23, 59, 59, 999);
    
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    dayAfterTomorrow.setUTCHours(23, 59, 59, 999);
    
    // Find all clients with plans expiring tomorrow
    const clients = await this.clientModel.find({
      $or: [
        { 
          'planHistory.planEndDate': {
            $gte: DateUtils.normalizeToStartOfDay(tomorrow),
            $lte: DateUtils.normalizeToEndOfDay(tomorrow),
          }
        },
        {
          planEndDate: {
            $gte: DateUtils.normalizeToStartOfDay(tomorrow),
            $lte: DateUtils.normalizeToEndOfDay(tomorrow),
          }
        }
      ]
    }).populate('trainerId').exec();
    
    // Group by trainer
    const byTrainer = new Map();
    for (const client of clients) {
      const trainerId = (client.trainerId as any)?._id?.toString();
      if (!byTrainer.has(trainerId)) {
        byTrainer.set(trainerId, []);
      }
      byTrainer.get(trainerId).push(client);
    }
    
    // Send notifications (future: email/push)
    for (const [trainerId, expiringClients] of byTrainer.entries()) {
      logger.info(
        `Trainer ${trainerId} has ${expiringClients.length} clients with plans expiring tomorrow`
      );
      // TODO: Send notification when notification system is ready
    }
  }
}
```

**Testovi:**
- [ ] Test cron job-a (simulacija)
- [ ] Test getExpiringPlans endpoint-a

---

### **3.5 Input Sanitization** 🟡

**Zahtevi:**
- [ ] Sanitizacija string input-a (prevent XSS)
- [ ] Validacija numeričkih vrednosti (weight, reps, etc.)
- [ ] Validacija URL-ova (videoUrl, photoUrl)
- [ ] Max length validation za text fields

**Fajlovi:**
- `src/common/utils/sanitizer.utils.ts` - **NOVO**
- Svi DTO fajlovi - **IZMENA** (dodati validators)

---

### **3.6 Plan Renewal Feature** 🟡

**Zadatak:**
Mogućnost automatskog produženja plana za još 7 dana

**Zahtevi:**
- [ ] Endpoint: `POST /api/plans/:id/renew`
- [ ] Produžiti plan za još 7 dana (planEndDate = planEndDate + 7 dana)
- [ ] Generisati nove workout logs za narednu nedelju
- [ ] Update planHistory entry sa novim endDate
- [ ] UI opcija za renewal (opciono u mobile V4)

**Fajlovi:**
- `src/plans/plans.controller.ts` - **IZMENA**
- `src/plans/plans.service.ts` - **IZMENA** (dodati `renewPlan` metodu)

**Implementacija:**

```typescript
async renewPlan(
  planId: string,
  clientId: string,
  userId: string,
  userRole: string,
): Promise<void> {
  // ... ownership check ...
  
  const client = await this.clientsService.getProfileById(clientId);
  const plan = await this.planModel.findById(planId).exec();
  
  // Find active plan entry
  const activeEntry = client.planHistory?.find(
    entry => entry.planId.toString() === planId &&
    DateUtils.isDateRangeActive(entry.planStartDate, entry.planEndDate)
  );
  
  if (!activeEntry) {
    throw new BadRequestException('Plan is not active for this client');
  }
  
  // Extend end date by 7 days
  const newEndDate = new Date(activeEntry.planEndDate);
  newEndDate.setUTCDate(newEndDate.getUTCDate() + 7);
  newEndDate.setUTCHours(23, 59, 59, 999);
  
  // Update planHistory
  await this.clientModel.updateOne(
    {
      _id: new Types.ObjectId(clientId),
      'planHistory.planId': new Types.ObjectId(planId),
    },
    { $set: { 'planHistory.$.planEndDate': newEndDate } }
  ).exec();
  
  // Update currentPlanId dates
  if (client.currentPlanId?.toString() === planId) {
    await this.clientModel.findByIdAndUpdate(clientId, {
      $set: { planEndDate: newEndDate },
    }).exec();
  }
  
  // Generate workout logs for next week
  const newStartDate = new Date(activeEntry.planEndDate);
  newStartDate.setUTCDate(newStartDate.getUTCDate() + 1);
  newStartDate.setUTCHours(0, 0, 0, 0);
  
  await this.workoutsService.generateWeeklyLogs(client, plan as any, newStartDate);
  
  logger.info(`Plan ${planId} renewed for client ${clientId} until ${newEndDate.toISOString()}`);
}
```

**Testovi:**
- [ ] Test renewal aktivnog plana
- [ ] Test generisanja novih workout logs
- [ ] Test renewal neaktivnog plana (ERROR)

---

### **3.7 Trainer Switch Handling** 🔴 **KRITIČNO**

**Zadatak:**
Rukovanje kada klijent prelazi sa jednog trenera na drugog

**Zahtevi:**
- [ ] Endpoint: `POST /api/admin/clients/:clientId/switch-trainer`
- [ ] Zatvoriti sve aktive planove starog trenera (planEndDate = danas)
- [ ] Workout logs ostaju netaknuti (istorija je važna)
- [ ] Update `trainerId` u ClientProfile
- [ ] Remove client iz starog trenerovog `clientIds` array
- [ ] Add client u novog trenerovog `clientIds` array

**Fajlovi:**
- `src/admin/admin.controller.ts` - **IZMENA**
- `src/admin/admin.service.ts` - **IZMENA** (dodati `switchTrainer` metodu)

**Implementacija:**

```typescript
async switchTrainer(
  clientId: string,
  newTrainerId: string,
): Promise<void> {
  const client = await this.clientsService.getProfileById(clientId);
  const oldTrainerId = client.trainerId?.toString();
  
  if (oldTrainerId === newTrainerId) {
    throw new BadRequestException('Client is already assigned to this trainer');
  }
  
  // Close all active plans from old trainer
  const today = DateUtils.normalizeToEndOfDay(new Date());
  if (client.planHistory && client.planHistory.length > 0) {
    for (const entry of client.planHistory) {
      const plan = await this.planModel.findById(entry.planId).exec();
      if (plan && plan.trainerId.toString() === oldTrainerId) {
        // Check if plan is still active
        if (DateUtils.isDateRangeActive(entry.planStartDate, entry.planEndDate)) {
          // Close plan
          await this.clientModel.updateOne(
            {
              _id: new Types.ObjectId(clientId),
              'planHistory.planId': entry.planId,
            },
            { $set: { 'planHistory.$.planEndDate': today } }
          ).exec();
          
          // Mark missed workouts
          await this.workoutsService.markMissedWorkoutsForPlan(
            clientId,
            entry.planId.toString(),
            today
          );
        }
      }
    }
  }
  
  // Update trainerId
  await this.clientModel.findByIdAndUpdate(clientId, {
    $set: {
      trainerId: new Types.ObjectId(newTrainerId),
      currentPlanId: null,
      planStartDate: null,
      planEndDate: null,
    },
  }).exec();
  
  // Update trainer client lists
  if (oldTrainerId) {
    await this.trainerModel.findByIdAndUpdate(oldTrainerId, {
      $pull: { clientIds: new Types.ObjectId(clientId) },
    }).exec();
  }
  
  await this.trainerModel.findByIdAndUpdate(newTrainerId, {
    $addToSet: { clientIds: new Types.ObjectId(clientId) },
  }).exec();
  
  logger.info(`Client ${clientId} switched from trainer ${oldTrainerId} to ${newTrainerId}`);
}
```

**Testovi:**
- [ ] Test switch trainer
- [ ] Test da se zatvore aktivni planovi starog trenera
- [ ] Test da workout logs ostaju netaknuti
- [ ] Test da se update-uju trainer client lists

---

### **3.8 Rate Limiting Strategy** 🟡 **NOVO**

**Zadatak:**
Dodati rate limiting na kritične endpointe za zaštitu od abuse

**Zahtevi:**
- [ ] Global rate limiting: 100 req/min per IP
- [ ] Auth endpoints: 5 req/min per IP (login, register)
- [ ] Media signatures: 10 req/min per user
- [ ] Sync endpoint: 30 req/min per user
- [ ] Jasne error poruke (429 Too Many Requests)
- [ ] `Retry-After` header u responsu

**Fajlovi:**
- `src/main.ts` - **IZMENA** (global throttler config)
- `src/auth/auth.controller.ts` - **IZMENA** (dodati @Throttle decorator)
- `src/media/media.controller.ts` - **IZMENA**
- `src/training/training.controller.ts` - **IZMENA**

**Implementacija:**

```typescript
// main.ts (Global config - već postoji, ažurirati)
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => {
    const isTest = process.env.NODE_ENV === 'test';
    return [{
      ttl: 60000, // 1 minuta
      limit: isTest ? 10000 : 100,  // Global: 100 req/min (10000 u testu)
    }];
  },
  inject: [ConfigService],
}),

// auth.controller.ts
@Post('login')
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 req/min
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}

@Post('register')
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 req/min
async register(@Body() dto: RegisterDto) {
  return this.authService.register(dto);
}

// media.controller.ts
@Get('signature')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 req/min
async getUploadSignature(@CurrentUser() user: JwtPayload) {
  return this.mediaService.generateSignature(user.sub);
}

// training.controller.ts
@Post('sync/batch')
@Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 req/min
async syncBatch(@CurrentUser() user: JwtPayload, @Body() dto: SyncBatchDto) {
  return this.trainingService.syncBatch(user.sub, user.role, dto);
}
```

**Error Response (429):**
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000000
Retry-After: 60
```

**Mobile app handling:**
- Catch 429 status
- Wait `Retry-After` seconds (default 60)
- Show message: "Too many requests. Please wait."
- Auto-retry after wait period

**Testovi:**
- [ ] Test global rate limiting (100 req/min)
- [ ] Test auth endpoint rate limiting (5 req/min)
- [ ] Test media endpoint rate limiting (10 req/min)
- [ ] Test da vraća `Retry-After` header

---

### **3.8 AI Message Automation (Cron Jobs)** 🔴 **KRITIČNO**

**Zadatak:**
Automatski generisati i slati AI poruke na osnovu event-a

**Zahtevi:**
- [ ] Cron job: Check missed workouts (daily at 20:00)
  - Ako >2 missed u nedelji → generate aggressive message
- [ ] Cron job: Check streaks (daily at 9:00)
  - Ako 7+ dana bez propusta → generate motivational message
- [ ] Cron job: Post-weigh-in analysis (Monday at 10:00)
  - Ako weight spike >5% → generate warning message
- [ ] Integration sa Push Notification service (kada je ready V4)
- [ ] Fallback: Poruke se čuvaju i prikazuju u app-u
- [ ] Avoid duplicate messages (ne slati istu poruku više puta u 24h)

**Fajlovi:**
- `src/gamification/jobs/ai-message-automation.job.ts` - **NOVO**
- `src/gamification/ai-message.service.ts` - **IZMENA**

**Implementacija:**

```typescript
// ai-message-automation.job.ts
@Injectable()
export class AIMessageAutomationJob {
  @Cron('0 20 * * *') // Daily at 20:00
  async checkMissedWorkouts() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // Find clients with >2 missed workouts in last 7 days
    const clients = await this.findClientsWithMissedWorkouts(weekAgo);
    
    for (const client of clients) {
      // Check if message already sent in last 24h
      const recentMessage = await this.aiMessageService.getRecentMessage(
        client._id,
        'MISSED_WORKOUTS',
        24
      );
      
      if (!recentMessage) {
        await this.aiMessageService.generateMessage(
          client._id.toString(),
          'MISSED_WORKOUTS'
        );
        // TODO: Send push notification (V4)
      }
    }
  }

  @Cron('0 9 * * *') // Daily at 9:00
  async checkStreaks() {
    // Find clients with 7+ day streak
    const clients = await this.findClientsWithStreak(7);
    
    for (const client of clients) {
      const recentMessage = await this.aiMessageService.getRecentMessage(
        client._id,
        'STREAK',
        24
      );
      
      if (!recentMessage) {
        await this.aiMessageService.generateMessage(
          client._id.toString(),
          'STREAK'
        );
      }
    }
  }

  @Cron('0 10 * * 1') // Monday at 10:00
  async checkWeightSpikes() {
    // Find clients with weight spike >5% from last weigh-in
    const clients = await this.findClientsWithWeightSpike();
    
    for (const client of clients) {
      await this.aiMessageService.generateMessage(
        client._id.toString(),
        'WEIGHT_SPIKE'
      );
    }
  }
}
```

**Testovi:**
- [ ] Test cron job execution
- [ ] Test message triggers
- [ ] Test duplicate prevention
- [ ] Test notification sending (mock)

---

### **3.9 Video Upload & Management** 🟢

**Zadatak:**
Video tutorials za vežbe (preparation)

**Zahtevi:**
- [ ] Cloudinary video upload (ili YouTube URL storage)
- [ ] Exercise schema: `videoUrl: string` (already exists)
- [ ] Video metadata (duration, thumbnail)
- [ ] Admin upload interface (future Mobile V3)
- [ ] Endpoint: `POST /media/video-upload` (Cloudinary upload)
- [ ] Endpoint: `GET /media/video/:videoId` (video metadata)

**Fajlovi:**
- `src/media/video-upload.service.ts` - **NOVO**
- `src/media/media.controller.ts` - **IZMENA**
- `src/media/dto/video-upload.dto.ts` - **NOVO**

**Implementacija:**

```typescript
// video-upload.service.ts
@Injectable()
export class VideoUploadService {
  async uploadVideo(file: Express.Multer.File, folder: string): Promise<VideoMetadata> {
    // Upload to Cloudinary
    const result = await this.cloudinaryService.uploadVideo(file, folder);
    
    return {
      videoUrl: result.secure_url,
      thumbnailUrl: result.thumbnail_url,
      duration: result.duration,
      publicId: result.public_id,
    };
  }

  async deleteVideo(publicId: string): Promise<void> {
    await this.cloudinaryService.deleteVideo(publicId);
  }
}

// media.controller.ts
@Post('video-upload')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('video'))
async uploadVideo(
  @CurrentUser() user: JwtPayload,
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: VideoUploadDto,
): Promise<VideoMetadata> {
  const folder = `exercises/${dto.exerciseId || 'general'}`;
  return this.videoUploadService.uploadVideo(file, folder);
}
```

**Testovi:**
- [ ] Test video upload
- [ ] Test video metadata extraction
- [ ] Test video deletion
- [ ] Test file size validation

---

### **3.10 CORS Security Configuration** 🟡 **NOVO**

**Zadatak:**
Učvrstiti CORS configuration za produkciju

**Problem:**
Trenutno `main.ts` dozvolj ava SVE localhost adrese i 192.168.0.x opseg u development modu. Previše otvoreno.

**Zahtevi:**
- [ ] Development: Strict localhost + specific IP from .env
- [ ] Production: Samo dozvoljeni origin-i iz .env
- [ ] Credentials enabled samo za dozvoljene origin-e
- [ ] Jasne error poruke za unauthorized origins

**Fajlovi:**
- `src/main.ts` - **IZMENA**
- `.env.example` - **IZMENA** (dodati DEV_MOBILE_IP)

**Implementacija:**

```typescript
// main.ts
const allowedOrigins = process.env.MOBILE_APP_URL
  ? process.env.MOBILE_APP_URL.split(',')
  : [];

// Development specific origins
const devOrigins = process.env.NODE_ENV !== 'production'
  ? [
      'http://localhost:19006',  // Expo default
      'http://localhost:8080',   // Flutter web
      ...(process.env.DEV_MOBILE_IP ? [process.env.DEV_MOBILE_IP] : []),
    ]
  : [];

const allAllowedOrigins = [...allowedOrigins, ...devOrigins];

app.enableCors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Reject
    logger.warn(`CORS blocked request from origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

**.env.example update:**
```bash
# CORS Configuration
MOBILE_APP_URL=https://kinetix-app.com,https://www.kinetix-app.com
DEV_MOBILE_IP=http://192.168.0.27:8080
```

**Testovi:**
- [ ] Test da production blokira non-whitelisted origins
- [ ] Test da development dozvoljava localhost
- [ ] Test da development dozvoljava DEV_MOBILE_IP
- [ ] Test da vraća jasnu error poruku za unauthorized origin

---

## ✅ **CHECKLIST:**

- [ ] Check-ins Management endpointi implementirani
- [ ] Analytics endpointi implementirani
- [ ] Validation messages poboljšane
- [ ] **Plan expiration notifications implementirane**
- [ ] **Input sanitization implementirana**
- [ ] **Plan renewal feature implementirana**
- [ ] **Trainer switch handling implementirana (KRITIČNO)**
- [ ] **Rate Limiting Strategy implementirana (NOVO)**
- [ ] **AI Message Automation (Cron Jobs) implementirana (KRITIČNO)**
- [ ] **Video Upload & Management implementirana**
- [ ] **CORS Security Configuration učvršćena (NOVO)**
- [ ] Testovi napisani (min 20 testova - povećano)

---

## 🔗 **VEZE:**

- **Status:** `docs/BACKEND_STATUS.md`
- **Sledeća Faza:** `docs/BACKEND_MASTERPLAN_V4.md` (Produkcija)

