# KINETIX - System Architecture Diagrams

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    ADMIN ||--o{ USER : manages
    USER ||--o| TRAINER_PROFILE : has
    USER ||--o| CLIENT_PROFILE : has
    
    TRAINER_PROFILE ||--o{ WEEKLY_PLAN : creates
    TRAINER_PROFILE ||--o{ CLIENT_PROFILE : manages
    TRAINER_PROFILE ||--o{ SUBSCRIPTION : has
    
    CLIENT_PROFILE ||--o{ PLAN_HISTORY : has
    CLIENT_PROFILE ||--o{ WORKOUT_LOG : logs
    CLIENT_PROFILE ||--o{ CHECK_IN : performs
    
    WEEKLY_PLAN ||--o{ WORKOUT_DAY : contains
    WEEKLY_PLAN ||--o{ PLAN_HISTORY : assigned_to
    WEEKLY_PLAN ||--o{ WORKOUT_LOG : generates
    
    WORKOUT_DAY ||--o{ EXERCISE : contains
    WORKOUT_LOG ||--o{ COMPLETED_EXERCISE : tracks
    
    ADMIN {
        string id PK
        string email
        string role "ADMIN"
    }
    
    USER {
        string id PK
        string email
        string password_hash
        string role "TRAINER|CLIENT|ADMIN"
        string firstName
        string lastName
    }
    
    TRAINER_PROFILE {
        ObjectId id PK
        ObjectId userId FK
        string businessName
        boolean isActive
        string subscriptionStatus "ACTIVE|SUSPENDED|CANCELLED"
        Date subscriptionExpiresAt
        array clientIds
    }
    
    CLIENT_PROFILE {
        ObjectId id PK
        ObjectId userId FK
        ObjectId trainerId FK "nullable"
        ObjectId currentPlanId FK "nullable, backward compat"
        Date planStartDate "nullable"
        Date planEndDate "nullable"
        array planHistory "NEW: stores all plans"
        boolean isPenaltyMode
        int consecutiveMissedWorkouts
        int currentStreak
        int totalWorkoutsCompleted
        number weight
        number height
        string fitnessGoal
    }
    
    PLAN_HISTORY {
        ObjectId planId FK
        Date planStartDate
        Date planEndDate
        Date assignedAt
        ObjectId trainerId FK
    }
    
    WEEKLY_PLAN {
        ObjectId id PK
        ObjectId trainerId FK
        string name
        string description
        string difficulty "BEGINNER|INTERMEDIATE|ADVANCED"
        array workouts "7 days"
        array assignedClientIds
        boolean isTemplate
    }
    
    WORKOUT_DAY {
        int dayOfWeek "1-7"
        boolean isRestDay
        string name
        array exercises
        int estimatedDuration
    }
    
    EXERCISE {
        string name
        int sets
        string reps "e.g. '8-12'"
        int restSeconds
        string notes
        string videoUrl "YouTube link"
    }
    
    WORKOUT_LOG {
        ObjectId id PK
        ObjectId clientId FK
        ObjectId trainerId FK
        ObjectId weeklyPlanId FK
        Date workoutDate
        int weekNumber
        int dayOfWeek
        array completedExercises
        boolean isCompleted
        boolean isMissed
        Date completedAt
        number difficultyRating "1-5"
        string clientNotes
    }
    
    CHECK_IN {
        ObjectId id PK
        ObjectId clientId FK "ref: ClientProfile [Indexed, Unique Compound]"
        ObjectId trainerId FK "ref: TrainerProfile [Indexed in Compound]"
        ObjectId workoutLogId FK "ref: WorkoutLog [nullable]"
        Date checkinDate "Indexed with clientId [Unique Compound]"
        string photoUrl "Cloudinary"
        object gpsCoordinates "Embedded: lat, lng, accuracy"
        string verificationStatus "Indexed with trainerId [Compound]"
        ObjectId verifiedBy "ref: User [nullable]"
    }
```

---

## 1.1. Database Connection Details

### Reference Relationships (MongoDB `ref:`)

MongoDB references are used to link documents across collections. Use `.populate()` to join data at query time.

- **USER → TRAINER_PROFILE**: `TrainerProfile.userId` refs `User._id` [Unique Index]
- **USER → CLIENT_PROFILE**: `ClientProfile.userId` refs `User._id` [Unique Index]
- **TRAINER_PROFILE → CLIENT_PROFILE**: `ClientProfile.trainerId` refs `TrainerProfile._id` [Indexed, nullable]
- **TRAINER_PROFILE → WEEKLY_PLAN**: `WeeklyPlan.trainerId` refs `TrainerProfile._id` [Indexed]
- **CLIENT_PROFILE → WEEKLY_PLAN**: `ClientProfile.currentPlanId` refs `WeeklyPlan._id` [Indexed, nullable]
- **CLIENT_PROFILE.planHistory[]**: Array with embedded `planId` refs `WeeklyPlan._id`
- **CLIENT_PROFILE.planHistory[]**: Array with embedded `trainerId` refs `TrainerProfile._id`
- **WEEKLY_PLAN → CLIENT_PROFILE**: `WeeklyPlan.assignedClientIds[]` array refs `ClientProfile._id`
- **WORKOUT_LOG → CLIENT_PROFILE**: `WorkoutLog.clientId` refs `ClientProfile._id` [Indexed in compound]
- **WORKOUT_LOG → TRAINER_PROFILE**: `WorkoutLog.trainerId` refs `TrainerProfile._id` [Indexed in compound]
- **WORKOUT_LOG → WEEKLY_PLAN**: `WorkoutLog.weeklyPlanId` refs `WeeklyPlan._id` [Indexed]
- **CHECK_IN → CLIENT_PROFILE**: `CheckIn.clientId` refs `ClientProfile._id` [Indexed in compound, unique]
- **CHECK_IN → TRAINER_PROFILE**: `CheckIn.trainerId` refs `TrainerProfile._id` [Indexed in compound]
- **CHECK_IN → WORKOUT_LOG**: `CheckIn.workoutLogId` refs `WorkoutLog._id` [nullable]

### Embedded Documents (Stored in parent document)

- **WEEKLY_PLAN.workouts[]**: Embedded array of `WorkoutDay` objects (7 days)
- **WorkoutDay.exercises[]**: Embedded array of `Exercise` objects within WorkoutDay
- **WORKOUT_LOG.completedExercises[]**: Embedded array of `CompletedExercise` objects
- **CLIENT_PROFILE.planHistory[]**: Embedded array of plan history entries (planId, dates, trainerId)
- **CHECK_IN.gpsCoordinates**: Embedded `GpsCoordinates` object (lat, lng, accuracy)

### Database Indexes (Performance Optimization)

#### CLIENT_PROFILE Indexes
- `userId` [Unique] - One profile per user
- `trainerId` [Single] - Fast trainer queries
- `trainerId + currentPlanId` [Compound] - Trainer's clients with specific plan
- `currentPlanId` [Single] - Find all clients with plan

#### TRAINER_PROFILE Indexes
- `userId` [Unique] - One profile per user
- `isActive` [Single] - Filter active trainers
- `subscriptionExpiresAt` [Single] - Find expiring subscriptions

#### WEEKLY_PLAN Indexes
- `trainerId` [Single] - Trainer's plans
- `trainerId + isTemplate` [Compound] - Trainer's templates vs assigned plans
- `isTemplate` [Single] - All templates

#### WORKOUT_LOG Indexes
- `clientId + workoutDate` [Compound, Unique] - Prevent duplicate logs per day
- `trainerId` [Single] - Trainer's client logs
- `trainerId + workoutDate` [Compound] - Trainer's logs by date
- `weeklyPlanId` [Single] - Logs for specific plan
- `isCompleted` [Single] - Completed workouts
- `isMissed` [Single] - Missed workouts (penalty calculation)

#### CHECK_IN Indexes
- `clientId + checkinDate` [Compound, Unique] - One check-in per day
- `trainerId + verificationStatus` [Compound] - Pending check-ins for trainer

### Populate Patterns (How data is joined at query time)

- **Get Client Profile**: `.populate('userId')`, `.populate('trainerId')`, `.populate('currentPlanId')`
- **Get Weekly Plan**: `.populate('trainerId')`, `.populate('assignedClientIds')`
- **Get Workout Log**: `.populate('clientId')`, `.populate('trainerId')`, `.populate('weeklyPlanId')`
- **Get Trainer Clients**: `.populate('clientIds')` - All clients for trainer
- **Admin Queries**: Multiple populate chains for full data hierarchy

### Bidirectional Relationships

#### TRAINER ↔ CLIENT
- `TrainerProfile.clientIds[]` → Array of `ClientProfile._id`
- `ClientProfile.trainerId` → Single `TrainerProfile._id`
- *Maintained manually in code (not enforced by DB)*

#### WEEKLY_PLAN ↔ CLIENT
- `WeeklyPlan.assignedClientIds[]` → Array of `ClientProfile._id`
- `ClientProfile.currentPlanId` → Single `WeeklyPlan._id` (current)
- `ClientProfile.planHistory[]` → Array with `planId` references (all history)

---

## 2. Plan Assignment Flow (Kako Admin/Trener dodeljuje plan klijentu)

```mermaid
sequenceDiagram
    participant Admin as Admin/Trainer
    participant API as Backend API
    participant PlanService as PlansService
    participant ClientService as ClientsService
    participant WorkoutService as WorkoutsService
    participant DB as MongoDB

    Admin->>API: POST /api/plans/:id/assign<br/>{clientIds, startDate}
    
    API->>PlanService: assignPlanToClients(planId, userId, role, dto)
    
    PlanService->>DB: Find plan by ID
    DB-->>PlanService: Plan document
    
    Note over PlanService: Validate: Plan ownership<br/>(unless ADMIN)
    
    loop For each clientId
        PlanService->>ClientService: getProfile(clientId) or getProfileById(clientId)
        ClientService->>DB: Find client profile
        DB-->>ClientService: ClientProfile
        
        alt Client profile not found
            PlanService->>DB: Create new ClientProfile<br/>with trainerId from plan
            DB-->>PlanService: New ClientProfile created
        end
        
        PlanService->>PlanService: Check if plan exists in<br/>planHistory or currentPlanId
        
        alt Plan already exists
            Note over PlanService: Skip - preserve existing dates
        else New plan assignment
            alt Client has no trainer
                PlanService->>DB: Update client.trainerId = plan.trainerId
            else Client has different trainer
                PlanService->>DB: Update client.trainerId = plan.trainerId<br/>(change trainer to match plan)
            end
            
            PlanService->>DB: Add to planHistory array:<br/>{planId, startDate, endDate, trainerId}
            PlanService->>DB: Update currentPlanId (backward compat)
            PlanService->>DB: Update planStartDate, planEndDate
            
            PlanService->>WorkoutService: generateWeeklyLogs(client, plan, startDate)
            WorkoutService->>DB: Create 7 WorkoutLog documents<br/>(one per day, isCompleted: false)
        end
    end
    
    PlanService->>DB: Add clients to plan.assignedClientIds
    
    PlanService-->>API: {message: "Plan assigned successfully"}
    API-->>Admin: Success response

    Note over Admin,DB: Result: Client now has plan in planHistory,<br/>7 workout logs generated, trainer assigned
```

---

## 3. Get Active Plan Flow (Kako klijent dobija svoj aktivan plan)

```mermaid
sequenceDiagram
    participant Client as Mobile App
    participant API as Backend API
    participant ClientService as ClientsService
    participant PlanService as PlansService
    participant DB as MongoDB

    Client->>API: GET /api/clients/current-plan
    
    API->>ClientService: getCurrentPlan(userId)
    
    ClientService->>DB: Find ClientProfile by userId
    DB-->>ClientService: ClientProfile with planHistory
    
    alt planHistory exists and not empty
        ClientService->>ClientService: getActivePlanFromHistory(profile)
        
        Note over ClientService: Find plan where:<br/>planStartDate <= today <= planEndDate
        
        alt Active plan found
            ClientService->>PlanService: getPlanById(activePlan.planId)
            PlanService->>DB: Find plan with workouts populated
            DB-->>PlanService: Full plan details
            PlanService-->>ClientService: Plan with workouts
            ClientService-->>API: Active plan
            API-->>Client: Plan details
        else No active plan
            ClientService-->>API: null
            API-->>Client: No active plan (expired or not started)
        end
        
    else planHistory empty, but currentPlanId exists
        Note over ClientService: BACKWARD COMPATIBILITY
        
        ClientService->>ClientService: migrateCurrentPlanToHistory(profile)
        ClientService->>DB: Push currentPlanId to planHistory array
        
        ClientService->>DB: Reload profile
        DB-->>ClientService: Updated profile with planHistory
        
        ClientService->>ClientService: getActivePlanFromHistory(updatedProfile)
        
        alt Plan is still active by date
            ClientService->>PlanService: getPlanById(planId)
            PlanService-->>ClientService: Plan details
            ClientService-->>API: Active plan
            API-->>Client: Plan details
        else Plan expired
            ClientService-->>API: null
            API-->>Client: No active plan
        end
        
    else No plan assigned
        ClientService-->>API: null
        API-->>Client: No plan assigned
    end

    Note over Client,DB: Result: Client sees only ACTIVE plan<br/>based on current date, or null if expired
```

---

## 4. Workout Logging Flow (Kako klijent loguje workout)

```mermaid
sequenceDiagram
    participant Client as Mobile App
    participant IsarDB as Isar (Local DB)
    participant Sync as SyncManager
    participant API as Backend API
    participant WorkoutService as WorkoutsService
    participant DB as MongoDB
    participant Cron as Cron Job

    Note over Client,IsarDB: OFFLINE-FIRST: Client can work offline
    
    Client->>IsarDB: Save workout log locally<br/>(weight, reps, sets, RPE)
    IsarDB-->>Client: Saved locally
    
    Note over Client: Client can continue working<br/>even without internet
    
    Client->>IsarDB: Mark workoutLog.isDirty = true
    
    alt Internet available
        Sync->>API: POST /api/workouts/log<br/>(sync dirty logs)
        
        API->>WorkoutService: logWorkout(userId, dto)
        
        WorkoutService->>WorkoutService: Validate: Get active plan<br/>for today's date
        
        alt Active plan exists
            WorkoutService->>DB: Find WorkoutLog for today
            DB-->>WorkoutService: WorkoutLog document
            
            WorkoutService->>DB: Update WorkoutLog:<br/>completedExercises, isCompleted: true, completedAt
            DB-->>WorkoutService: Updated log
            
            WorkoutService->>ClientService: Update client stats:<br/>totalWorkoutsCompleted++, currentStreak++
            ClientService->>DB: Update ClientProfile
            
            WorkoutService-->>API: Success
            API-->>Sync: Success
            Sync->>IsarDB: Mark isDirty = false,<br/>Update serverId
            
        else No active plan
            WorkoutService-->>API: Error: No active plan
            API-->>Sync: Error (will retry later)
        end
        
    else No internet
        Note over Sync: Queue for sync when online
    end
    
    Note over Cron: Every Monday at 23:59
    
    Cron->>WorkoutService: Analyze last week's logs
    
    loop For each client
        WorkoutService->>DB: Count missed workouts (isMissed: true)
        
        alt Missed workouts > 2
            WorkoutService->>ClientService: Enable penalty mode
            WorkoutService->>DB: Add "Penalty Cardio" to next week's plan
            WorkoutService->>DB: Update client.isPenaltyMode = true
            WorkoutService->>DB: Reset client.currentStreak = 0
        else Good adherence
            WorkoutService->>DB: Award badge/achievement
        end
    end

    Note over Client,DB: Result: Workout logged, stats updated,<br/>penalties calculated weekly
```

---

## 5. Admin Dashboard - Full Control Flow

```mermaid
graph TD
    A[Admin Dashboard] --> B[User Management]
    A --> C[Trainer Management]
    A --> D[Plan Management]
    A --> E[Workout Management]
    A --> F[Client Management]
    A --> G[System Stats]
    
    B --> B1[Create User<br/>CLIENT/TRAINER/ADMIN]
    B --> B2[Edit User<br/>email, name, role]
    B --> B3[Delete User<br/>with cascade]
    B --> B4[View All Users<br/>with filters]
    
    C --> C1[View All Trainers<br/>with subscription status]
    C --> C2[Assign Clients to Trainer<br/>or Unassign]
    C --> C3[Activate/Suspend Trainer<br/>Kill-switch control]
    C --> C4[View Trainer's Clients]
    C --> C5[Manage Subscription<br/>expiry, status]
    
    D --> D1[Create Plan<br/>for any trainer]
    D --> D2[Edit Plan<br/>workouts, exercises]
    D --> D3[Delete Plan<br/>with validation]
    D --> D4[Assign Plan to Clients<br/>bypass trainer ownership]
    D --> D5[View Plan Details<br/>assigned clients, history]
    D --> D6[Duplicate Plan<br/>as template]
    
    E --> E1[View All Workout Logs<br/>by client, date, plan]
    E --> E2[View Workout Details<br/>exercises, sets, reps]
    E --> E3[Manual Log Correction<br/>if needed]
    E --> E4[View Completion Stats<br/>per client/week]
    
    F --> F1[View All Clients<br/>with trainer info]
    F --> F2[View Client Profile<br/>metrics, goals, stats]
    F --> F3[View Client Plan History<br/>all assigned plans]
    F --> F4[View Active Plan<br/>current week]
    F --> F5[Assign/Reassign Client<br/>to different trainer]
    F --> F6[View Client Workouts<br/>completed, missed]
    
    G --> G1[Total Users<br/>Trainers, Clients]
    G --> G2[Active Subscriptions<br/>Suspended, Expired]
    G --> G3[Total Plans Created<br/>Templates vs Assigned]
    G --> G4[Workout Completion Rate<br/>Average across all clients]
    G --> G5[System Health<br/>API uptime, DB status]
    
    style A fill:#00F0FF,stroke:#fff,stroke-width:3px
    style B fill:#1E1E1E,stroke:#00F0FF,stroke-width:2px
    style C fill:#1E1E1E,stroke:#00F0FF,stroke-width:2px
    style D fill:#1E1E1E,stroke:#00F0FF,stroke-width:2px
    style E fill:#1E1E1E,stroke:#00F0FF,stroke-width:2px
    style F fill:#1E1E1E,stroke:#00F0FF,stroke-width:2px
    style G fill:#1E1E1E,stroke:#00F0FF,stroke-width:2px
```

---

## 6. Admin Actions - Detailed Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Dashboard
    participant AdminAPI as Admin API
    participant PlansAPI as Plans API
    participant ClientsAPI as Clients API
    participant TrainersAPI as Trainers API
    participant DB as MongoDB

    Note over Admin,DB: ADMIN BYPASSES ALL GUARDS AND OWNERSHIP CHECKS

    rect rgb(30, 30, 30)
        Note over Admin,DB: PLAN MANAGEMENT
        Admin->>PlansAPI: POST /api/plans<br/>{name, workouts, trainerId}
        PlansAPI->>DB: Create plan (any trainer)
        
        Admin->>PlansAPI: PATCH /api/plans/:id<br/>{...updates}
        Note over PlansAPI: Admin can edit ANY plan
        
        Admin->>PlansAPI: DELETE /api/plans/:id
        Note over PlansAPI: Admin can delete ANY plan<br/>(even if clients assigned)
        
        Admin->>PlansAPI: POST /api/plans/:id/assign<br/>{clientIds, startDate}
        Note over PlansAPI: Admin can assign ANY plan<br/>to ANY clients (bypass trainer check)
    end
    
    rect rgb(30, 30, 30)
        Note over Admin,DB: CLIENT MANAGEMENT
        Admin->>ClientsAPI: GET /api/admin/clients
        ClientsAPI->>DB: Find all clients<br/>(populate trainer, currentPlan)
        
        Admin->>ClientsAPI: GET /api/admin/clients/:id
        ClientsAPI->>DB: Get client + planHistory
        
        Admin->>TrainersAPI: POST /api/admin/assign-client<br/>{clientId, trainerId}
        TrainersAPI->>DB: Update client.trainerId<br/>Remove from old trainer.clientIds<br/>Add to new trainer.clientIds
        
        Admin->>TrainersAPI: POST /api/admin/assign-client<br/>{clientId, trainerId: null}
        Note over TrainersAPI: Unassign client from trainer<br/>(client.trainerId = null)
    end
    
    rect rgb(30, 30, 30)
        Note over Admin,DB: TRAINER MANAGEMENT
        Admin->>TrainersAPI: GET /api/admin/trainers
        TrainersAPI->>DB: Find all trainers<br/>(populate subscription, clients)
        
        Admin->>TrainersAPI: PATCH /api/admin/trainers/:id<br/>{isActive: false}
        Note over TrainersAPI: Suspend trainer<br/>→ Kill-switch activates<br/>→ All clients get 403
        
        Admin->>TrainersAPI: PATCH /api/admin/trainers/:id<br/>{subscriptionExpiresAt}
        Note over TrainersAPI: Extend subscription<br/>→ Trainer stays active
    end
    
    rect rgb(30, 30, 30)
        Note over Admin,DB: USER MANAGEMENT
        Admin->>AdminAPI: POST /api/admin/users<br/>{email, role, password}
        AdminAPI->>DB: Create user (any role)
        
        Admin->>AdminAPI: PATCH /api/admin/users/:id
        AdminAPI->>DB: Update user (role, email, etc.)
        
        Admin->>AdminAPI: DELETE /api/admin/users/:id
        Note over AdminAPI: Delete user + cascade:<br/>- If TRAINER: Delete TrainerProfile<br/>- If CLIENT: Delete ClientProfile
    end

    Note over Admin,DB: Admin has FULL CONTROL over entire system
```

---

## 7. Kill-Switch Flow (SaaS Protection)

```mermaid
sequenceDiagram
    participant Client as Client App
    participant Guard as SaasKillswitchGuard
    participant DB as MongoDB
    participant Trainer as TrainerProfile

    Client->>Guard: Any API Request<br/>(with JWT token)
    
    Guard->>Guard: Extract user.role from JWT
    
    alt user.role === 'CLIENT'
        Guard->>DB: Find ClientProfile by userId
        DB-->>Guard: ClientProfile with trainerId
        
        Guard->>DB: Find TrainerProfile by trainerId
        DB-->>Guard: TrainerProfile with<br/>isActive, subscriptionStatus,<br/>subscriptionExpiresAt
        
        alt isActive === false OR<br/>subscriptionStatus !== 'ACTIVE'
            Guard-->>Client: 403 Forbidden<br/>"Your trainer's subscription<br/>is inactive"
        else subscriptionExpiresAt < today
            Guard->>DB: Auto-suspend trainer:<br/>isActive = false,<br/>subscriptionStatus = 'SUSPENDED'
            Guard-->>Client: 403 Forbidden<br/>"Subscription has expired"
        else All checks pass
            Guard-->>Client: Allow request (200 OK)
        end
        
    else user.role === 'TRAINER' OR 'ADMIN'
        Note over Guard: Trainers and Admins<br/>bypass kill-switch
        Guard-->>Client: Allow request (200 OK)
    end

    Note over Client,DB: Result: Clients automatically blocked<br/>if their trainer's subscription expires
```

---

## 8. Plan History vs Current Plan Logic

```mermaid
graph TD
    A[Client Profile] --> B{Has planHistory?}
    
    B -->|Yes| C[Check planHistory]
    B -->|No| D{Has currentPlanId?}
    
    C --> E{Find active plan by date}
    E -->|Date range is active| F[Return Active Plan]
    E -->|No active plan| G["Return null<br/>Plan expired or not started"]
    
    D -->|Yes| H[Migrate to planHistory<br/>Backward compatibility]
    D -->|No| I[Return null<br/>No plan assigned]
    
    H --> J{Plan still active by date?}
    J -->|Yes| F
    J -->|No| G
    
    F --> K[Client sees workouts<br/>for this week]
    G --> L["Client sees: No active plan<br/>Can view history"]
    I --> L
    
    style A fill:#00F0FF,stroke:#fff,stroke-width:2px
    style F fill:#00FF00,stroke:#000,stroke-width:2px
    style G fill:#FFA500,stroke:#000,stroke-width:2px
    style L fill:#FF6B6B,stroke:#000,stroke-width:2px
```

---

## 9. Weekly Penalty Calculation (Cron Job)

```mermaid
sequenceDiagram
    participant Cron as Cron Job<br/>(Every Monday 23:59)
    participant GamificationService as GamificationService
    participant WorkoutService as WorkoutsService
    participant ClientService as ClientsService
    participant DB as MongoDB

    Cron->>GamificationService: calculateWeeklyPenalties()
    
    GamificationService->>DB: Find all ClientProfiles
    
    loop For each client
        GamificationService->>WorkoutService: Get last week's workout logs<br/>(from Monday to Sunday)
        
        WorkoutService->>DB: Find WorkoutLogs where:<br/>workoutDate >= lastMonday<br/>workoutDate <= lastSunday<br/>clientId = client._id
        
        DB-->>WorkoutService: Array of WorkoutLogs
        
        WorkoutService->>WorkoutService: Count where isMissed === true
        
        alt Missed workouts > 2
            GamificationService->>ClientService: Enable penalty mode
            ClientService->>DB: Update ClientProfile:<br/>isPenaltyMode = true<br/>consecutiveMissedWorkouts += count<br/>currentStreak = 0
            
            GamificationService->>PlansService: Add "Penalty Cardio" workout<br/>to client's next week plan
            
            Note over DB: Penalty workout automatically<br/>added to next week's schedule
            
        else Missed workouts <= 2
            GamificationService->>ClientService: Update streak
            ClientService->>DB: Update ClientProfile:<br/>currentStreak += days_completed<br/>isPenaltyMode = false (if was true)
        end
    end
    
    GamificationService->>DB: Save PenaltyRecord documents
    
    Note over Cron,DB: Result: All clients analyzed,<br/>penalties assigned, streaks updated
```

---

## 10. Check-In Flow (Photo Verification)

```mermaid
sequenceDiagram
    participant Client as Mobile App
    participant Camera as Camera API
    participant IsarDB as Isar (Local)
    participant Sync as SyncManager
    participant API as Backend API
    participant MediaAPI as Media API<br/>(Cloudinary)
    participant CheckInService as CheckInService
    participant DB as MongoDB
    participant Trainer as Trainer Dashboard

    Client->>Camera: Open camera<br/>(mandatory check-in)
    Camera->>Client: Photo captured
    
    Client->>IsarDB: Save CheckInCollection:<br/>photoLocalPath, timestamp<br/>isSynced: false
    
    Note over Client: Client can proceed<br/>even offline
    
    alt Internet available
        Sync->>API: GET /api/media/signature
        API-->>Sync: Upload signature<br/>(Cloudinary credentials)
        
        Sync->>MediaAPI: Upload photo directly<br/>(using signature)
        MediaAPI-->>Sync: photoUrl (Cloudinary URL)
        
        Sync->>IsarDB: Update CheckInCollection:<br/>photoUrl, isSynced: true
        
        Sync->>API: POST /api/checkins<br/>{photoUrl, location, timestamp}
        
        API->>CheckInService: createCheckIn(userId, dto)
        CheckInService->>DB: Save CheckIn document
        
        CheckInService->>Trainer: Notify trainer<br/>(new check-in pending verification)
        
    else No internet
        Note over Sync: Queue for sync when online
    end
    
    Trainer->>API: GET /api/trainers/clients/checkins<br/>(pending verification)
    API-->>Trainer: List of check-ins
    
    Trainer->>API: PATCH /api/checkins/:id/verify<br/>{isVerified: true}
    API->>CheckInService: verifyCheckIn(checkInId)
    CheckInService->>DB: Update CheckIn.isVerified = true
    
    Note over Client,Trainer: Result: Photo uploaded,<br/>trainer verifies authenticity
```

---

## Summary: Key Concepts

### 1. **Admin vs Trainer vs Client Roles**
- **Admin**: Full control, bypasses all ownership checks
- **Trainer**: Creates plans, assigns to own clients, manages subscription
- **Client**: Views active plan, logs workouts, checks in

### 2. **Plan Management**
- Plans stored in `planHistory` array (supports multiple plans)
- Only ONE plan is ACTIVE at a time (determined by date)
- Admin can assign ANY plan to ANY client (bypass trainer ownership)

### 3. **Offline-First Architecture**
- Mobile app uses Isar (local DB) for all operations
- Sync happens in background (Fire & Forget)
- Client can work completely offline

### 4. **Kill-Switch Protection**
- Clients blocked automatically if trainer subscription expires
- Guard checks on EVERY client API request
- Trainers/Admins bypass kill-switch

### 5. **Weekly Penalty System**
- Cron job runs every Monday at 23:59
- Analyzes previous week's workout completion
- Automatically assigns penalty workouts if >2 missed

### 6. **Active Plan Logic**
- Plan is ACTIVE if: `planStartDate <= today <= planEndDate`
- `getCurrentPlan` returns null if plan expired or not started
- Client can view full plan history via `/api/clients/plan-history`

