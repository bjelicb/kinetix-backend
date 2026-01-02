# PRIORITET 2: Detaljan Plan Implementacije - Seniorski Nivo

**Datum:** 2025-12-31  
**Fokus:** Kvalitet i merodavnost testova, ne samo da prolaze  
**Cilj:** Gamification 53.33% → 75%, Plans 46.81% → 75%

**Status Ažuriran:** 2025-12-31 (Finalna Provera)

---

## 📊 TRENUTNI STATUS IMPLEMENTACIJE

### ✅ Ukupno Testova: **136 passed, 0 failing**

### Gamification Modul:
- ✅ **Failing Testovi:** 4 → **0** (svi popravljeni)
- ✅ **Guard Integration Testovi:** 15 test case-ova za `MonthlyPaywallGuard`
- ✅ **Controller Unit Testovi:** `balance` i `clearBalance` endpoint-i
- ✅ **Service Unit Testovi:** `clearBalance()`, `removePenaltiesForPlan()`
- ⚠️ **Coverage:** Treba proveriti (cilj: 75%+)

### Plans Modul:
- ✅ **E2E Test Suite:** `test/plans/plans.e2e-spec.ts` kreiran
- ✅ **Controller Unit Testovi:** `cancelPlan`, `canUnlockNextWeek`, `requestNextWeek` endpoint-i
- ✅ **Service Unit Testovi:** `canUnlockNextWeek()`, `cancelPlan()`, `requestNextWeek()`
- ✅ **Mock Setup:** GamificationService mock ažuriran sa potrebnim metodama
- ⚠️ **Coverage:** Treba proveriti (cilj: 75%+)

### Dodatno Implementirano (van originalnog plana):
1. ✅ GamificationController unit testovi za `balance` i `clearBalance` endpoint-e
2. ✅ PlansController unit testovi za `cancel`, `canUnlockNextWeek`, `requestNextWeek` endpoint-e
3. ✅ MonthlyPaywallGuard integration testovi (15 test case-ova)

---

## 🎯 FILOZOFIJA TESTOVA

### Principi koje MORAŠ poštovati:

1. **Merodavnost > Coverage**
   - Testovi **MORAJU** proveravati stvarnu business logiku
   - **NE** mock-ovati logiku koja se testira
   - **NE** menjati test da prođe - dorađivati logiku ako test padne

2. **Edge Case-ovi su OBAVEZNI**
   - Testirati granične vrednosti
   - Testirati null/undefined scenarije
   - Testirati error handling

3. **Business Logic Verification**
   - Proveravati da se balance i monthlyBalance ažuriraju pravilno
   - Proveravati ownership checks
   - Proveravati cascade delete logiku

4. **Mock Patterns - Pravilno**
   - Mock-ovati samo dependencies, ne logiku
   - Proveravati da se metode pozivaju sa ispravnim parametrima
   - Koristiti `mock.calls` za praćenje poziva

5. **ForwardRef Dependencies - Mock Setup**
   - **KRITIČNO:** Kada service koristi `forwardRef(() => OtherService)`, mock MORA biti kompletan
   - **Primer:** PlansService koristi `forwardRef(() => GamificationService)`
   - **Problem:** Ako mock nije kompletan, testovi mogu proći ali logika ne radi
   - **Rešenje:** Dodati sve metode koje se pozivaju u mock objekat

---

## ✅ 2.1 GAMIFICATION MODUL (53.33% → 75%+)

### Trenutno Stanje (Ažurirano 2025-12-31):
- **Coverage:** Treba proveriti (cilj: 75%+)
- **GamificationService:** Testovi implementirani ✅
- **GamificationController:** Testovi implementirani ✅
- **Failing Testovi:** **0** ✅ (svi testovi prolaze)

### ✅ REŠENO: 4 Failing Testa u `clearBalance`

**Status:** ✅ **ZAVRŠENO** - Svi testovi sada prolaze

**Rešenje Implementirano:**
- Mock pattern je ispravljen - `{ new: true }` opcija je dodata u expectations
- Testovi za `clearBalance()` sada prolaze bez grešaka
- Implementirano je 8 test case-ova za `clearBalance()` metodu

---

### DODATNI UNIT TESTOVI - GAMIFICATIONSERVICE

#### 1. `getPenaltyStatus()` - Kompletna Logika

**Fajl:** `src/gamification/gamification.service.spec.ts`

**Testovi koje MORAŠ implementirati:**

```typescript
describe('getPenaltyStatus', () => {
  it('should return penalty status with balance and monthlyBalance', async () => {
    // MERODAVNOST: Proveriti da se balance i monthlyBalance vraćaju pravilno
    // Proveriti da se recentPenalties filtriraju i sortiraju pravilno
  });

  it('should throw NotFoundException if client profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should handle client with no penaltyHistory', async () => {
    // EDGE CASE: Client bez penaltyHistory
    // MERODAVNOST: Proveriti da se vraća prazan array za recentPenalties
  });

  it('should handle client with null balance and monthlyBalance', async () => {
    // EDGE CASE: null balance/monthlyBalance
    // MERODAVNOST: Proveriti da se vraća 0 umesto null
  });

  it('should limit recentPenalties to 4', async () => {
    // MERODAVNOST: Proveriti da se limit(4) primenjuje pravilno
    // Proveriti da se sort({ weekStartDate: -1 }) primenjuje
  });

  it('should handle clientId as userId vs clientProfileId', async () => {
    // EDGE CASE: clientId može biti userId ili clientProfileId
    // MERODAVNOST: Proveriti da se query koristi ispravan ID
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `clientsService.getProfile()` poziva sa ispravnim clientId
- ✅ Proveriti da se `penaltyRecordModel.find()` poziva sa ispravnim clientId
- ✅ Proveriti da se `sort({ weekStartDate: -1 })` i `limit(4)` primenjuju
- ✅ Proveriti da se balance i monthlyBalance vraćaju pravilno (ne null)

---

#### 2. `getPenaltyHistory()` - Query Logika

**Testovi koje MORAŠ implementirati:**

```typescript
describe('getPenaltyHistory', () => {
  it('should return penalty history sorted by weekStartDate descending', async () => {
    // MERODAVNOST: Proveriti da se sort({ weekStartDate: -1 }) primenjuje
  });

  it('should throw NotFoundException if client profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should handle client with no penalty history', async () => {
    // EDGE CASE: Client bez penalty history
    // MERODAVNOST: Proveriti da se vraća prazan array
  });

  it('should handle clientId as userId vs clientProfileId', async () => {
    // EDGE CASE: clientId može biti userId ili clientProfileId
    // MERODAVNOST: Proveriti da se query koristi ispravan ID
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `clientsService.getProfile()` poziva sa ispravnim clientId
- ✅ Proveriti da se `penaltyRecordModel.find()` poziva sa ispravnim clientId
- ✅ Proveriti da se `sort({ weekStartDate: -1 })` primenjuje

---

#### 3. `resetPenalty()` - Ownership Check

**Testovi koje MORAŠ implementirati:**

```typescript
describe('resetPenalty', () => {
  it('should reset penalty mode and consecutiveMissedWorkouts', async () => {
    // MERODAVNOST: Proveriti da se isPenaltyMode postavlja na false
    // Proveriti da se consecutiveMissedWorkouts postavlja na 0
    // Proveriti da se save() poziva
  });

  it('should throw NotFoundException if client profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should throw NotFoundException if trainer profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should throw NotFoundException if trainer does not own client', async () => {
    // MERODAVNOST: Proveriti ownership check
    // Proveriti da se baca NotFoundException ako trainerId ne odgovara
  });

  it('should handle client with null trainerId', async () => {
    // EDGE CASE: Client bez trainerId
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should handle trainerId as ObjectId vs string', async () => {
    // EDGE CASE: trainerId može biti ObjectId ili string
    // MERODAVNOST: Proveriti da se comparison radi pravilno
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `clientProfileModel.findById()` poziva sa ispravnim clientId
- ✅ Proveriti da se `trainersService.getProfile()` poziva sa ispravnim trainerUserId
- ✅ Proveriti ownership check: `clientProfile.trainerId.toString() === trainerProfileId.toString()`
- ✅ Proveriti da se `save()` poziva nakon update-a

---

#### 4. `getLeaderboard()` - Leaderboard Calculation

**Testovi koje MORAŠ implementirati:**

```typescript
describe('getLeaderboard', () => {
  it('should return leaderboard sorted by streak then totalWorkouts', async () => {
    // MERODAVNOST: Proveriti sorting logiku
    // Proveriti da se sortira po currentStreak (desc), zatim totalWorkoutsCompleted (desc)
  });

  it('should throw NotFoundException if trainer profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should handle trainer with no clients', async () => {
    // EDGE CASE: Trainer bez klijenata
    // MERODAVNOST: Proveriti da se vraća prazan array
  });

  it('should include all required fields in leaderboard', async () => {
    // MERODAVNOST: Proveriti da se vraća clientId, totalWorkoutsCompleted, currentStreak, isPenaltyMode, consecutiveMissedWorkouts
  });

  it('should handle clients with null values', async () => {
    // EDGE CASE: Client sa null totalWorkoutsCompleted ili currentStreak
    // MERODAVNOST: Proveriti da se null vrednosti tretiraju kao 0
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `trainersService.getProfile()` poziva sa ispravnim trainerUserId
- ✅ Proveriti da se `clientProfileModel.find({ trainerId })` poziva sa ispravnim trainerProfileId
- ✅ Proveriti sorting logiku: `b.currentStreak - a.currentStreak`, zatim `b.totalWorkoutsCompleted - a.totalWorkoutsCompleted`

---

#### 5. `addPenaltyToBalance()` - **KRITIČNO**

**Testovi koje MORAŠ implementirati:**

```typescript
describe('addPenaltyToBalance', () => {
  it('should add penalty to balance and monthlyBalance', async () => {
    // MERODAVNOST: Proveriti da se balance i monthlyBalance ažuriraju pravilno
    // Proveriti da se penaltyHistory ažurira sa novim entry-jem
  });

  it('should throw NotFoundException if client profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should handle client with null balance and monthlyBalance', async () => {
    // EDGE CASE: Client sa null balance/monthlyBalance
    // MERODAVNOST: Proveriti da se tretira kao 0
  });

  it('should add penalty entry to penaltyHistory', async () => {
    // MERODAVNOST: Proveriti da se penaltyHistory ažurira sa:
    // - date: new Date()
    // - amount: amount
    // - reason: reason
    // - planId: planId (ako postoji)
  });

  it('should handle clientProfileId as string vs ObjectId', async () => {
    // EDGE CASE: clientProfileId može biti string ili ObjectId
    // MERODAVNOST: Proveriti da se konvertuje pravilno
  });

  it('should handle planId as optional parameter', async () => {
    // EDGE CASE: planId je opcioni
    // MERODAVNOST: Proveriti da se penalty entry kreira i bez planId
  });

  it('should calculate balance correctly: oldBalance + amount', async () => {
    // MERODAVNOST: Proveriti da se balance računa kao oldBalance + amount
    // Proveriti da se monthlyBalance računa kao oldMonthlyBalance + amount
  });

  it('should use $set and $push operators correctly', async () => {
    // MERODAVNOST: Proveriti da se koristi $set za balance i monthlyBalance
    // Proveriti da se koristi $push za penaltyHistory
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `clientProfileModel.findById()` poziva sa ispravnim clientProfileId
- ✅ Proveriti da se `clientProfileModel.findByIdAndUpdate()` poziva sa:
  - `$set: { balance: updatedBalance, monthlyBalance: updatedMonthlyBalance }`
  - `$push: { penaltyHistory: penaltyEntry }`
- ✅ Proveriti da se balance računa kao `oldBalance + amount`
- ✅ Proveriti da se monthlyBalance računa kao `oldMonthlyBalance + amount`

---

#### 6. `clearBalance()` - ✅ **ZAVRŠENO**

**Status:** ✅ **IMPLEMENTIRANO** - 8 test case-ova, svi testovi prolaze

**Implementirano:**
- ✅ Mock pattern ispravljen sa `{ new: true }` opcijom
- ✅ Testovi za različite edge case-ove (balance = 0, null vrednosti, itd.)
- ✅ Error handling testovi (NotFoundException)
- ✅ Svi testovi prolaze bez grešaka

---

#### 7. `checkMonthlyPaywall()` - Paywall Logika

**Testovi koje MORAŠ implementirati:**

```typescript
describe('checkMonthlyPaywall', () => {
  it('should return true if no lastBalanceReset (first time)', async () => {
    // MERODAVNOST: Proveriti da se vraća true ako lastBalanceReset ne postoji
  });

  it('should return true if same month and balance = 0', async () => {
    // MERODAVNOST: Proveriti da se vraća true ako je isti mesec i balance = 0
  });

  it('should return false if new month and balance > 0', async () => {
    // MERODAVNOST: Proveriti da se vraća false ako je novi mesec i balance > 0
  });

  it('should return true if new month and balance = 0', async () => {
    // MERODAVNOST: Proveriti da se vraća true ako je novi mesec ali balance = 0
  });

  it('should return true if same month and balance > 0', async () => {
    // MERODAVNOST: Proveriti da se vraća true ako je isti mesec čak i ako balance > 0
  });

  it('should handle year change (December to January)', async () => {
    // EDGE CASE: Promena godine (decembar → januar)
    // MERODAVNOST: Proveriti da se proverava i godina, ne samo mesec
  });

  it('should return false if client profile not found', async () => {
    // MERODAVNOST: Proveriti da se vraća false ako client ne postoji
  });

  it('should handle client with null balance', async () => {
    // EDGE CASE: Client sa null balance
    // MERODAVNOST: Proveriti da se tretira kao 0
  });

  it('should check balance, not monthlyBalance', async () => {
    // MERODAVNOST: Proveriti da se proverava balance, ne monthlyBalance
    // Edge case: balance = 0, monthlyBalance = 10€ → treba vraćati true
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `clientProfileModel.findById()` poziva sa ispravnim clientProfileId
- ✅ Proveriti da se proverava `balance`, ne `monthlyBalance`
- ✅ Proveriti da se proverava i mesec i godina: `currentMonth !== lastResetMonth || currentYear !== lastResetYear`
- ✅ Proveriti da se vraća `false` ako je novi mesec/godina i `balance > 0`

---

#### 8. `removePenaltiesForPlan()` - ✅ **ZAVRŠENO**

**Status:** ✅ **IMPLEMENTIRANO** - Testovi dodati i svi prolaze

**Testovi koje su implementirani:**

```typescript
describe('removePenaltiesForPlan', () => {
  it('should remove penalties for plan and update balance', async () => {
    // MERODAVNOST: Proveriti da se penalties uklanjaju iz penaltyHistory
    // Proveriti da se balance i monthlyBalance smanjuju za totalAmount
  });

  it('should throw NotFoundException if client profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should return 0 if no penalties found for plan', async () => {
    // EDGE CASE: Nema penalties za plan
    // MERODAVNOST: Proveriti da se vraća 0
  });

  it('should handle planId as string vs ObjectId', async () => {
    // EDGE CASE: planId može biti string ili ObjectId
    // MERODAVNOST: Proveriti da se konvertuje pravilno
  });

  it('should calculate totalAmount correctly', async () => {
    // MERODAVNOST: Proveriti da se totalAmount računa kao suma svih penalty.amount
  });

  it('should not allow negative balance', async () => {
    // MERODAVNOST: Proveriti da se koristi Math.max(0, oldBalance - totalAmount)
  });

  it('should filter penalties by planId correctly', async () => {
    // MERODAVNOST: Proveriti da se filtriraju samo penalties sa matching planId
  });

  it('should handle penalties without planId', async () => {
    // EDGE CASE: Penalties bez planId
    // MERODAVNOST: Proveriti da se ne uklanjaju
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `clientProfileModel.findById()` poziva sa ispravnim clientProfileId
- ✅ Proveriti da se penalties filtriraju po planId: `penalty.planId.toString() === planIdObj.toString()`
- ✅ Proveriti da se balance računa kao `Math.max(0, oldBalance - totalAmount)`
- ✅ Proveriti da se monthlyBalance računa kao `Math.max(0, oldMonthlyBalance - totalAmount)`
- ✅ Proveriti da se `findByIdAndUpdate()` poziva sa `$set` operatorom za balance, monthlyBalance i penaltyHistory
- ✅ Proveriti da se penalties uklanjaju iz penaltyHistory array-a (filter, ne splice)

**⚠️ VAŽNO - Mock Setup:**
- Mock `clientProfileModel.findById()` da vraća client sa penaltyHistory
- Mock `clientProfileModel.findByIdAndUpdate()` da vraća ažurirani client
- Proveriti da se `$set` koristi za balance, monthlyBalance i penaltyHistory (ne $push/$pull)

---

### E2E TESTOVI - GAMIFICATION

**Fajl:** `test/gamification.e2e-spec.ts` (već postoji, ali treba proveriti coverage)

**⚠️ VAŽNO - Endpoint Route Corrections:**

1. **clearBalance Endpoint:**
   - ❌ **PLAN (POGREŠNO):** `POST /api/gamification/clear-balance/:clientProfileId`
   - ✅ **STVARNI:** `POST /api/gamification/clear-balance` (bez parametra, koristi `CurrentUser` iz JWT tokena)
   - **Code Reference:** ```67:83:Kinetix-Backend/src/gamification/gamification.controller.ts```
   - **Objašnjenje:** Endpoint ne prima `clientProfileId` kao parametar, već koristi `user.sub` iz JWT tokena za bezbednost. Client može da očisti samo svoj balance.

2. **checkMonthlyPaywall Endpoint:**
   - ❌ **PLAN (POGREŠNO):** `GET /api/gamification/check-paywall/:clientProfileId`
   - ✅ **STVARNI:** Endpoint **NE POSTOJI** u controller-u
   - **Objašnjenje:** Metoda `checkMonthlyPaywall()` postoji u `GamificationService`, ali se koristi u `MonthlyPaywallGuard`, ne kao direktan endpoint.
   - **Code Reference:** ```327:327:Kinetix-Backend/src/gamification/gamification.service.ts```, ```34:34:Kinetix-Backend/src/common/guards/monthly-paywall.guard.ts```
   - **Akcija:** Umesto E2E testa za endpoint, testirati guard integraciju (vidi sekciju "Guard Integration Tests" ispod).

3. **balance Endpoint (Dodatno):**
   - ✅ **STVARNI:** `GET /api/gamification/balance` (postoji u controller-u, ali nije u planu)
   - **Code Reference:** ```53:65:Kinetix-Backend/src/gamification/gamification.controller.ts```
   - **Akcija:** Dodati E2E test za ovaj endpoint.

**Status Testova za Endpoint-e:**
- ✅ `GET /api/gamification/status` (postoji)
- ✅ `GET /api/gamification/penalties` (postoji)
- ✅ `POST /api/gamification/reset-penalty/:clientId` (postoji)
- ✅ `GET /api/gamification/leaderboard` (postoji)
- ✅ `POST /api/gamification/clear-balance` (dodato - unit testovi u controller spec)
- ✅ `GET /api/gamification/balance` (dodato - unit testovi u controller spec)
- ✅ `checkMonthlyPaywall` (testirano kroz guard integration testove)

**✅ Guard Integration Tests - ZAVRŠENO:**

**Status:** ✅ **IMPLEMENTIRANO** - 15 test case-ova u `monthly-paywall.guard.spec.ts`

**Implementirano:**
- ✅ ExecutionContext mock pattern
- ✅ Testovi za non-CLIENT roles (ADMIN, TRAINER)
- ✅ Testovi za CLIENT role sa različitim scenarijima:
  - Block access (new month + balance > 0)
  - Allow access (same month)
  - Allow access (balance = 0)
  - Payment routes exception
  - Error handling
- ✅ Svi testovi prolaze

---

## ✅ 2.2 PLANS MODUL (46.81% → 75%+)

### Trenutno Stanje (Ažurirano 2025-12-31):
- **Coverage:** Treba proveriti (cilj: 75%+)
- **PlansService:** Testovi implementirani ✅
- **PlansController:** Testovi implementirani ✅
- **E2E Testovi:** ✅ **POSTOJI** - `test/plans/plans.e2e-spec.ts` kreiran

### ✅ REŠENO: E2E Testovi

**Status:** ✅ **ZAVRŠENO** - E2E test suite je kreiran

**Fajl:** `test/plans/plans.e2e-spec.ts` **POSTOJI**

---

### DODATNI UNIT TESTOVI - PLANSSERVICE

**✅ REŠENO - Mock Setup za ForwardRef Dependencies:**

**Status:** ✅ **ZAVRŠENO** - GamificationService mock je ažuriran sa potrebnim metodama

**Implementirano:**
- ✅ Mock setup ažuriran sa `removePenaltiesForPlan` metodom
- ✅ Mock setup ažuriran sa `addPenaltyToBalance` metodom
- ✅ Svi testovi koji koriste ove metode sada prolaze

---

#### 1. `createPlan()` - Edge Case-ovi

**Fajl:** `src/plans/plans.service.spec.ts`

**Testovi koje MORAŠ implementirati:**

```typescript
describe('createPlan', () => {
  it('should handle trainerId in DTO (admin case)', async () => {
    // MERODAVNOST: Proveriti da se koristi dto.trainerId ako postoji
  });

  it('should handle missing trainerId (trainer case)', async () => {
    // MERODAVNOST: Proveriti da se koristi userId ako dto.trainerId ne postoji
  });

  it('should throw NotFoundException if trainer profile not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should set isTemplate to true by default', async () => {
    // MERODAVNOST: Proveriti da se isTemplate postavlja na true ako nije navedeno
  });

  it('should handle isTemplate explicitly set to false', async () => {
    // EDGE CASE: isTemplate = false
    // MERODAVNOST: Proveriti da se postavlja na false
  });

  it('should remove trainerId from DTO before saving', async () => {
    // MERODAVNOST: Proveriti da se trainerId uklanja iz DTO-a (nije deo plan schema)
  });
});
```

---

#### 2. `getPlans()` - Query Logika

**Testovi koje MORAŠ implementirati:**

```typescript
describe('getPlans', () => {
  it('should return only non-deleted plans', async () => {
    // MERODAVNOST: Proveriti da se filtrira isDeleted: { $ne: true }
  });

  it('should populate assignedClientIds', async () => {
    // MERODAVNOST: Proveriti da se assignedClientIds populate-uje
  });

  it('should return only plans for trainer', async () => {
    // MERODAVNOST: Proveriti da se filtrira po trainerId
  });

  it('should select only required fields', async () => {
    // MERODAVNOST: Proveriti da se select-uju samo potrebna polja
  });
});
```

---

#### 3. `getPlanById()` - Ownership Check

**Testovi koje MORAŠ implementirati:**

```typescript
describe('getPlanById', () => {
  it('should return plan with trainerId as User ID', async () => {
    // MERODAVNOST: Proveriti da se trainerId vraća kao User ID (ne TrainerProfile ID)
  });

  it('should allow ADMIN to access any plan', async () => {
    // MERODAVNOST: Proveriti da ADMIN može pristupiti bilo kom planu
  });

  it('should allow TRAINER to access own plans', async () => {
    // MERODAVNOST: Proveriti da TRAINER može pristupiti samo svojim planovima
  });

  it('should throw ForbiddenException if TRAINER tries to access other trainer plan', async () => {
    // MERODAVNOST: Proveriti da se baca ForbiddenException
  });

  it('should allow CLIENT to access assigned plans', async () => {
    // MERODAVNOST: Proveriti da CLIENT može pristupiti planovima koji su mu dodeljeni
  });

  it('should throw ForbiddenException if CLIENT tries to access unassigned plan', async () => {
    // MERODAVNOST: Proveriti da se baca ForbiddenException
  });

  it('should check plan in planHistory for CLIENT', async () => {
    // MERODAVNOST: Proveriti da se proverava planHistory
  });

  it('should check assignedClientIds for CLIENT', async () => {
    // MERODAVNOST: Proveriti da se proverava assignedClientIds
  });

  it('should throw NotFoundException if plan not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should filter out soft-deleted plans', async () => {
    // MERODAVNOST: Proveriti da se filtrira isDeleted: { $ne: true }
  });
});
```

---

#### 4. `updatePlan()` - Ownership Check

**Testovi koje MORAŠ implementirati:**

```typescript
describe('updatePlan', () => {
  it('should allow ADMIN to update any plan', async () => {
    // MERODAVNOST: Proveriti da ADMIN može ažurirati bilo koji plan
  });

  it('should allow TRAINER to update own plans', async () => {
    // MERODAVNOST: Proveriti da TRAINER može ažurirati samo svoje planove
  });

  it('should throw ForbiddenException if TRAINER tries to update other trainer plan', async () => {
    // MERODAVNOST: Proveriti da se baca ForbiddenException
  });

  it('should validate template status if plan has assigned clients', async () => {
    // MERODAVNOST: Proveriti da se poziva PlanValidators.validateIsTemplate()
  });

  it('should handle trainerId conversion (user ID → trainer profile ID)', async () => {
    // MERODAVNOST: Proveriti da se trainerId konvertuje pravilno
  });

  it('should throw NotFoundException if plan not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });
});
```

---

#### 5. `deletePlan()` - Cascade Delete

**Testovi koje MORAŠ implementirati:**

```typescript
describe('deletePlan', () => {
  it('should soft delete if plan has assigned clients', async () => {
    // MERODAVNOST: Proveriti da se koristi soft delete (isDeleted: true)
  });

  it('should soft delete if plan has active workout logs', async () => {
    // MERODAVNOST: Proveriti da se koristi soft delete ako ima aktivne workout logs
  });

  it('should hard delete if plan has no assigned clients and no active logs', async () => {
    // MERODAVNOST: Proveriti da se koristi hard delete (findByIdAndDelete)
  });

  it('should allow ADMIN to delete any plan', async () => {
    // MERODAVNOST: Proveriti da ADMIN može obrisati bilo koji plan
  });

  it('should allow TRAINER to delete own plans', async () => {
    // MERODAVNOST: Proveriti da TRAINER može obrisati samo svoje planove
  });

  it('should throw ForbiddenException if TRAINER tries to delete other trainer plan', async () => {
    // MERODAVNOST: Proveriti da se baca ForbiddenException
  });

  it('should check for future workout logs', async () => {
    // MERODAVNOST: Proveriti da se proveravaju workout logs sa workoutDate >= today
  });

  it('should set deletedAt on soft delete', async () => {
    // MERODAVNOST: Proveriti da se deletedAt postavlja na new Date()
  });
});
```

---

#### 6. `canUnlockNextWeek()` - ✅ **ZAVRŠENO**

**Status:** ✅ **IMPLEMENTIRANO** - Testovi dodati i svi prolaze

**Testovi koje su implementirani:**

```typescript
describe('canUnlockNextWeek', () => {
  it('should return true if no currentPlanId', async () => {
    // Setup: Client sa currentPlanId = null
    // MERODAVNOST: Proveriti da se vraća true
    // Proveriti da se NE pozivaju dodatni query-ji
  });

  it('should return true if currentPlanId not in planHistory (data inconsistency)', async () => {
    // EDGE CASE: Data inconsistency (currentPlanId postoji ali nije u planHistory)
    // MERODAVNOST: Proveriti da se vraća true (recovery mechanism)
    // Proveriti da se loguje upozorenje (ako postoji logging)
  });

  it('should return false if last workout day has not passed', async () => {
    // Setup: lastWorkoutDate = today ili budućnost
    // MERODAVNOST: Proveriti da se vraća false
    // Proveriti da se proverava workoutDate >= today
  });

  it('should return true if all non-rest-day workouts are completed', async () => {
    // Setup: Svi non-rest-day workouts su completed
    // MERODAVNOST: Proveriti da se vraća true
    // Proveriti da se rest days ignorišu
  });

  it('should return false if any non-rest-day workout is incomplete', async () => {
    // Setup: Bar jedan non-rest-day workout je incomplete
    // MERODAVNOST: Proveriti da se vraća false
    // Proveriti da se proveravaju samo non-rest-day workouts
  });

  it('should ignore rest days in completion check', async () => {
    // Setup: Plan sa rest days i non-rest-day workouts
    // MERODAVNOST: Proveriti da se rest days ne računaju u completion check
    // Proveriti da se proveravaju samo workouts gde isRestDay = false
  });

  it('should return true if plan deleted', async () => {
    // EDGE CASE: Plan obrisan (isDeleted = true)
    // MERODAVNOST: Proveriti da se vraća true (recovery mechanism)
  });

  it('should return true if no workout logs for current plan', async () => {
    // EDGE CASE: Nema workout logs za trenutni plan
    // MERODAVNOST: Proveriti da se vraća true (recovery mechanism)
  });

  it('should handle client with null planHistory', async () => {
    // EDGE CASE: Client sa null planHistory
    // MERODAVNOST: Proveriti da se tretira kao prazan array
  });

  it('should handle planHistory with multiple plans', async () => {
    // EDGE CASE: planHistory sa više planova
    // MERODAVNOST: Proveriti da se pronalazi ispravan plan po currentPlanId
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `clientProfileModel.findById()` poziva sa ispravnim clientProfileId
- ✅ Proveriti da se proverava `currentPlanId` u `planHistory`
- ✅ Proveriti da se proverava `lastWorkoutDate` vs `today`
- ✅ Proveriti da se proveravaju samo non-rest-day workouts
- ✅ Proveriti da se ignoriraju rest days u completion check-u

---

#### 7. `assignPlanToClients()` - Assignment Logic

**Testovi koje MORAŠ implementirati:**

```typescript
describe('assignPlanToClients', () => {
  it('should check canUnlockNextWeek for each client', async () => {
    // MERODAVNOST: Proveriti da se poziva canUnlockNextWeek() za svakog clienta
  });

  it('should skip unlock check if client already has this plan', async () => {
    // MERODAVNOST: Proveriti da se preskače unlock check ako client već ima plan
  });

  it('should throw BadRequestException if client cannot unlock', async () => {
    // MERODAVNOST: Proveriti da se baca BadRequestException
  });

  it('should handle overlapping plans and close them', async () => {
    // MERODAVNOST: Proveriti da se poziva PlanOverlapHandler.findOverlappingPlan()
    // Proveriti da se poziva markMissedWorkoutsForPlan()
  });

  it('should NOT set currentPlanId during assign', async () => {
    // MERODAVNOST: Proveriti da se currentPlanId NE postavlja tokom assign-a
  });

  it('should generate workout logs for new clients only', async () => {
    // MERODAVNOST: Proveriti da se workout logs generišu samo za nove klijente
  });

  it('should NOT charge balance during assign', async () => {
    // MERODAVNOST: Proveriti da se balance NE naplaćuje tokom assign-a
  });

  it('should add plan to planHistory', async () => {
    // MERODAVNOST: Proveriti da se plan dodaje u planHistory
  });

  it('should add clients to plan assignedClientIds', async () => {
    // MERODAVNOST: Proveriti da se clienti dodaju u plan.assignedClientIds
  });
});
```

---

#### 8. `cancelPlan()` - ✅ **ZAVRŠENO**

**Status:** ✅ **IMPLEMENTIRANO** - Testovi dodati i svi prolaze

**Testovi koje su implementirani:**

```typescript
describe('cancelPlan', () => {
  // ⚠️ VAŽNO: GamificationService mock MORA imati removePenaltiesForPlan metodu
  beforeEach(() => {
    // Setup mock za gamificationService.removePenaltiesForPlan
    gamificationService.removePenaltiesForPlan.mockResolvedValue(2); // 2 penalties removed
  });

  it('should delete uncompleted workout logs', async () => {
    // MERODAVNOST: Proveriti da se poziva deleteUncompletedWorkoutsForPlan()
    // Proveriti da se workout logs brišu samo za specifični plan i client
  });

  it('should remove penalties for plan', async () => {
    // MERODAVNOST: Proveriti da se poziva gamificationService.removePenaltiesForPlan()
    // Proveriti da se prosleđuje ispravan clientProfileId i planId
    // Proveriti da se vraća broj uklonjenih penalties
  });

  it('should remove plan from planHistory', async () => {
    // MERODAVNOST: Proveriti da se plan uklanja iz client planHistory
    // Proveriti da se koristi ispravan planId za filtriranje
  });

  it('should clear currentPlanId if it matches cancelled plan', async () => {
    // MERODAVNOST: Proveriti da se currentPlanId briše ako odgovara otkazanom planu
    // Proveriti da se currentPlanId NE briše ako ne odgovara
  });

  it('should remove client from plan assignedClientIds', async () => {
    // MERODAVNOST: Proveriti da se client uklanja iz plan.assignedClientIds
    // Proveriti da se plan ažurira u bazi
  });

  it('should throw NotFoundException if plan not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should throw NotFoundException if client not found', async () => {
    // MERODAVNOST: Proveriti da se baca NotFoundException
  });

  it('should handle plan not in client planHistory', async () => {
    // EDGE CASE: Plan nije u planHistory
    // MERODAVNOST: Proveriti da se ne baca greška, samo se preskače
  });

  it('should handle client with null planHistory', async () => {
    // EDGE CASE: Client sa null planHistory
    // MERODAVNOST: Proveriti da se tretira kao prazan array
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `gamificationService.removePenaltiesForPlan()` poziva sa ispravnim parametrima
- ✅ Proveriti da se `deleteUncompletedWorkoutsForPlan()` poziva sa ispravnim parametrima
- ✅ Proveriti da se plan uklanja iz `planHistory` array-a
- ✅ Proveriti da se `currentPlanId` briše ako odgovara otkazanom planu
- ✅ Proveriti da se client uklanja iz `plan.assignedClientIds`

---

#### 9. `requestNextWeek()` - ✅ **ZAVRŠENO**

**Status:** ✅ **IMPLEMENTIRANO** - Testovi dodati i svi prolaze

**Testovi koje su implementirani:**

```typescript
describe('requestNextWeek', () => {
  // ⚠️ VAŽNO: GamificationService mock MORA imati addPenaltyToBalance metodu
  beforeEach(() => {
    // Setup mock za gamificationService.addPenaltyToBalance
    gamificationService.addPenaltyToBalance.mockResolvedValue(undefined);
  });

  it('should throw BadRequestException if cannot unlock', async () => {
    // Setup: canUnlockNextWeek() vraća false
    // MERODAVNOST: Proveriti da se baca BadRequestException
    // Proveriti da se NE poziva addPenaltyToBalance
    // Proveriti da se NE ažurira currentPlanId
  });

  it('should charge balance if weeklyCost > 0', async () => {
    // Setup: Plan sa weeklyCost = 5€
    // MERODAVNOST: Proveriti da se poziva gamificationService.addPenaltyToBalance()
    // Proveriti da se prosleđuje ispravan clientProfileId, amount (weeklyCost), reason, planId
  });

  it('should NOT charge balance if weeklyCost = 0', async () => {
    // Setup: Plan sa weeklyCost = 0
    // MERODAVNOST: Proveriti da se addPenaltyToBalance() NE poziva
  });

  it('should set currentPlanId to next plan', async () => {
    // MERODAVNOST: Proveriti da se currentPlanId postavlja na next plan iz planHistory
    // Proveriti da se client profile ažurira u bazi
  });

  it('should find next plan in planHistory', async () => {
    // MERODAVNOST: Proveriti da se next plan pronalazi u planHistory
    // Proveriti da se koristi ispravna logika za pronalaženje next plan-a
  });

  it('should throw BadRequestException if no next plan available', async () => {
    // Setup: Nema next plan u planHistory
    // MERODAVNOST: Proveriti da se baca BadRequestException
  });

  it('should handle first unlock (no currentPlanId)', async () => {
    // EDGE CASE: Prvi unlock (currentPlanId = null)
    // MERODAVNOST: Proveriti da se uzima prvi plan koji nije completed
    // Proveriti da se currentPlanId postavlja na taj plan
  });

  it('should return balance and monthlyBalance in response', async () => {
    // MERODAVNOST: Proveriti da se vraća { currentPlanId, balance, monthlyBalance }
    // Proveriti da se balance i monthlyBalance čitaju iz ažuriranog client profile-a
  });

  it('should handle planHistory with multiple plans', async () => {
    // EDGE CASE: planHistory sa više planova
    // MERODAVNOST: Proveriti da se pronalazi ispravan next plan (prvi koji nije completed)
  });
});
```

**Merodavnost Provera:**
- ✅ Proveriti da se `canUnlockNextWeek()` poziva PRE bilo koje akcije
- ✅ Proveriti da se `gamificationService.addPenaltyToBalance()` poziva samo ako weeklyCost > 0
- ✅ Proveriti da se `currentPlanId` postavlja na ispravan next plan
- ✅ Proveriti da se plan pronalazi u `planHistory` array-u
- ✅ Proveriti da se client profile ažurira u bazi

---

#### 10. `duplicatePlan()` - Plan Duplication

**Testovi koje MORAŠ implementirati:**

```typescript
describe('duplicatePlan', () => {
  it('should keep original trainerId if user is ADMIN', async () => {
    // MERODAVNOST: Proveriti da ADMIN zadržava original trainerId
  });

  it('should use own trainerProfileId if user is TRAINER', async () => {
    // MERODAVNOST: Proveriti da TRAINER koristi svoj trainerProfileId
  });

  it('should create plan as template', async () => {
    // MERODAVNOST: Proveriti da se novi plan kreira kao template
  });

  it('should reset assignedClientIds', async () => {
    // MERODAVNOST: Proveriti da se assignedClientIds resetuje na []
  });

  it('should append " (Copy)" to plan name', async () => {
    // MERODAVNOST: Proveriti da se ime plana menja na "Original Name (Copy)"
  });
});
```

---

### E2E TESTOVI - PLANS - ✅ **ZAVRŠENO**

**Fajl:** `test/plans/plans.e2e-spec.ts` ✅ **KREIRAN**

**Status:** ✅ E2E test suite je kreiran i implementiran

**⚠️ VAŽNO - Endpoint Route Corrections (Primenjeno u testovima):**

1. **cancelPlan Endpoint:**
   - ❌ **PLAN (POGREŠNO):** `POST /api/plans/:id/cancel`
   - ✅ **STVARNI:** `POST /api/plans/:id/cancel/:clientId` (ima dodatni `:clientId` parametar)
   - **Code Reference:** ```112:125:Kinetix-Backend/src/plans/plans.controller.ts```
   - **Objašnjenje:** Endpoint prima i `planId` i `clientId` kao parametre jer se plan otkazuje za specifičnog klijenta.

2. **canUnlockNextWeek Endpoint:**
   - ❌ **PLAN (POGREŠNO):** Nije eksplicitno naveden u E2E sekciji
   - ✅ **STVARNI:** `GET /api/plans/unlock-next-week/:clientId` (GET, ne POST)
   - **Code Reference:** ```127:177:Kinetix-Backend/src/plans/plans.controller.ts```
   - **Objašnjenje:** Endpoint je GET metoda koja proverava da li klijent može da otključa sledeću nedelju.

3. **requestNextWeek Endpoint:**
   - ❌ **PLAN (POGREŠNO):** `POST /api/plans/:id/request-next-week`
   - ✅ **STVARNI:** `POST /api/plans/request-next-week/:clientId` (nema `:id` parametra)
   - **Code Reference:** ```179:214:Kinetix-Backend/src/plans/plans.controller.ts```
   - **Objašnjenje:** Endpoint ne prima `planId` kao parametar, već samo `clientId`. Service pronalazi trenutni plan iz `clientProfile.currentPlanId`.

**Testovi koje MORAŠ implementirati:**

```typescript
describe('Plans E2E', () => {
  // Setup: Kreirati trainer, client, admin users

  describe('POST /api/plans', () => {
    it('should create plan as trainer', async () => {
      // MERODAVNOST: Proveriti da se plan kreira i čuva u bazu
    });

    it('should create plan as admin with trainerId', async () => {
      // MERODAVNOST: Proveriti da admin može kreirati plan za drugog trainera
    });

    it('should return 401 if not authenticated', async () => {
      // RBAC: Proveriti 401 Unauthorized
    });

    it('should return 403 if CLIENT tries to create plan', async () => {
      // RBAC: Proveriti 403 Forbidden
    });
  });

  describe('GET /api/plans', () => {
    it('should return only trainer plans', async () => {
      // MERODAVNOST: Proveriti da se vraćaju samo planovi trenutnog trainera
    });

    it('should filter out soft-deleted plans', async () => {
      // MERODAVNOST: Proveriti da se soft-deleted planovi ne vraćaju
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should return plan with trainerId as User ID', async () => {
      // MERODAVNOST: Proveriti da se trainerId vraća kao User ID
    });

    it('should allow ADMIN to access any plan', async () => {
      // RBAC: Proveriti da ADMIN može pristupiti bilo kom planu
    });

    it('should allow TRAINER to access own plans', async () => {
      // RBAC: Proveriti da TRAINER može pristupiti svojim planovima
    });

    it('should return 403 if TRAINER tries to access other trainer plan', async () => {
      // RBAC: Proveriti 403 Forbidden
    });

    it('should allow CLIENT to access assigned plans', async () => {
      // RBAC: Proveriti da CLIENT može pristupiti dodeljenim planovima
    });

    it('should return 403 if CLIENT tries to access unassigned plan', async () => {
      // RBAC: Proveriti 403 Forbidden
    });
  });

  describe('PATCH /api/plans/:id', () => {
    it('should update plan', async () => {
      // MERODAVNOST: Proveriti da se plan ažurira u bazi
    });

    it('should return 403 if TRAINER tries to update other trainer plan', async () => {
      // RBAC: Proveriti 403 Forbidden
    });
  });

  describe('DELETE /api/plans/:id', () => {
    it('should soft delete if plan has assigned clients', async () => {
      // MERODAVNOST: Proveriti da se koristi soft delete
    });

    it('should hard delete if plan has no assigned clients', async () => {
      // MERODAVNOST: Proveriti da se koristi hard delete
    });

    it('should return 403 if TRAINER tries to delete other trainer plan', async () => {
      // RBAC: Proveriti 403 Forbidden
    });
  });

  describe('POST /api/plans/:id/assign', () => {
    it('should assign plan to clients', async () => {
      // MERODAVNOST: Proveriti da se plan dodaje u client planHistory
      // Proveriti da se workout logs generišu
    });

    it('should NOT set currentPlanId during assign', async () => {
      // MERODAVNOST: Proveriti da se currentPlanId NE postavlja
    });

    it('should NOT charge balance during assign', async () => {
      // MERODAVNOST: Proveriti da se balance NE naplaćuje
    });

    it('should return 400 if client cannot unlock', async () => {
      // MERODAVNOST: Proveriti 400 BadRequest
    });
  });

  describe('POST /api/plans/:id/cancel/:clientId', () => {
    // ⚠️ ISPRAVKA: Endpoint prima i planId i clientId
    it('should cancel plan assignment for specific client', async () => {
      // MERODAVNOST: Proveriti da se plan uklanja iz client planHistory
      // Proveriti da se workout logs brišu za tog klijenta
      // Proveriti da se penalties uklanjaju za tog klijenta
    });

    it('should clear currentPlanId if it matches cancelled plan', async () => {
      // MERODAVNOST: Proveriti da se currentPlanId briše ako odgovara otkazanom planu
    });

    it('should return 404 if plan not found', async () => {
      // MERODAVNOST: Proveriti 404 NotFound
    });

    it('should return 404 if client not found', async () => {
      // MERODAVNOST: Proveriti 404 NotFound
    });

    it('should return 403 if TRAINER tries to cancel plan for client they do not own', async () => {
      // RBAC: Proveriti 403 Forbidden
    });
  });

  describe('GET /api/plans/unlock-next-week/:clientId', () => {
    // ⚠️ ISPRAVKA: Endpoint je GET, ne POST, i nema :id parametra
    it('should return canUnlock status for client', async () => {
      // MERODAVNOST: Proveriti da se vraća { canUnlock: boolean }
      // Proveriti da se poziva canUnlockNextWeek() metoda
    });

    it('should return true if client can unlock next week', async () => {
      // MERODAVNOST: Proveriti da se vraća { canUnlock: true }
    });

    it('should return false if client cannot unlock next week', async () => {
      // MERODAVNOST: Proveriti da se vraća { canUnlock: false }
    });

    it('should handle CLIENT role (uses CurrentUser)', async () => {
      // MERODAVNOST: Proveriti da CLIENT može proveriti svoj status
    });

    it('should handle TRAINER role (uses clientId param)', async () => {
      // MERODAVNOST: Proveriti da TRAINER može proveriti status svog klijenta
    });

    it('should return 404 if client not found', async () => {
      // MERODAVNOST: Proveriti 404 NotFound
    });
  });

  describe('POST /api/plans/request-next-week/:clientId', () => {
    // ⚠️ ISPRAVKA: Endpoint nema :id parametra, samo :clientId
    it('should unlock next week and charge balance', async () => {
      // MERODAVNOST: Proveriti da se currentPlanId postavlja na next plan
      // Proveriti da se balance naplaćuje (ako weeklyCost > 0)
      // Proveriti da se vraća { message, currentPlanId, balance, monthlyBalance }
    });

    it('should return 400 if cannot unlock', async () => {
      // MERODAVNOST: Proveriti 400 BadRequest ako canUnlockNextWeek() vraća false
    });

    it('should NOT charge balance if weeklyCost = 0', async () => {
      // MERODAVNOST: Proveriti da se balance NE naplaćuje ako weeklyCost = 0
    });

    it('should return 403 if not CLIENT role', async () => {
      // RBAC: Proveriti 403 Forbidden za TRAINER/ADMIN
    });

    it('should return 404 if client not found', async () => {
      // MERODAVNOST: Proveriti 404 NotFound
    });
  });

  describe('POST /api/plans/:id/duplicate', () => {
    it('should duplicate plan', async () => {
      // MERODAVNOST: Proveriti da se plan duplira
    });
  });
});
```

**Merodavnost Provera:**
- ✅ Database persistence verification (proveriti da se podaci čuvaju u bazu)
- ✅ Business logic verification (proveriti da se balance naplaćuje pravilno)
- ✅ RBAC checks (proveriti da se role-based access control primenjuje)
- ✅ Ownership checks (proveriti da se ownership proverava pravilno)

---

## ✅ CHECKLIST PRE COMMIT-A

### Gamification Modul:
- [x] ✅ **ZAVRŠENO:** Popraviti 4 failing testa u `clearBalance` (dodati `{ new: true }` u mock expectations)
- [x] ✅ Implementirati testove za `clearBalance()` (8 test case-ova)
- [x] ✅ **ZAVRŠENO:** Implementirati testove za `removePenaltiesForPlan()` (testovi dodati)
- [x] ✅ **ZAVRŠENO:** Dodati unit testove za `GET /api/gamification/balance` endpoint (controller spec)
- [x] ✅ **ZAVRŠENO:** Dodati unit testove za `POST /api/gamification/clear-balance` endpoint (controller spec)
- [x] ✅ **ZAVRŠENO:** Dodati guard integration testove za `MonthlyPaywallGuard` (15 test case-ova)
- [x] ✅ Svi testovi **PROLAZE** (136 passed, 0 failing)
- [ ] ⚠️ Coverage **TREBA PROVERITI** (cilj: ≥75%)

### Plans Modul:
- [x] ✅ **ZAVRŠENO:** Ažurirati GamificationService mock u `plans.service.spec.ts` (dodati `removePenaltiesForPlan` i `addPenaltyToBalance` metode)
- [x] ✅ **ZAVRŠENO:** Implementirati testove za `canUnlockNextWeek()` unlock logic (testovi dodati)
- [x] ✅ **ZAVRŠENO:** Implementirati testove za `cancelPlan()` cancellation logic (testovi dodati)
- [x] ✅ **ZAVRŠENO:** Implementirati testove za `requestNextWeek()` next week request (testovi dodati)
- [x] ✅ **ZAVRŠENO:** Dodati unit testove za `cancelPlan` endpoint (controller spec)
- [x] ✅ **ZAVRŠENO:** Dodati unit testove za `canUnlockNextWeek` endpoint (controller spec)
- [x] ✅ **ZAVRŠENO:** Dodati unit testove za `requestNextWeek` endpoint (controller spec)
- [x] ✅ **ZAVRŠENO:** Kreirati `test/plans/plans.e2e-spec.ts` sa svim endpoint-ima (E2E suite kreiran)
- [x] ✅ Svi testovi **PROLAZE** (136 passed, 0 failing)
- [ ] ⚠️ Coverage **TREBA PROVERITI** (cilj: ≥75%)

---

## 🎯 FINALNA PROVERA

### Pre Commit-a:
1. ✅ Svi testovi prolaze (0 failing)
2. ✅ Coverage ≥75% za oba modula
3. ✅ Testovi proveravaju stvarnu logiku (ne mock-uju logiku koja se testira)
4. ✅ Testovi pokrivaju edge case-ove
5. ✅ Testovi proveravaju error handling
6. ✅ Testovi proveravaju business logic (balance, ownership, cascade delete)

### Ako Test Padne:
**NE** menjati test da prođe - **DORAĐIVATI LOGIKU!**

- Ako test padne zbog bug-a u logici → popraviti logiku
- Ako test padne zbog edge case-a → dodati edge case handling
- Ako test padne zbog error handling-a → dodati error handling

**Filozofija:** Testovi su "oličenje" - ako padnu, logika treba da se dorađuje.

---

## 📊 Očekivani Rezultati (Ažurirano 2025-12-31)

### Gamification Modul:
- **Coverage:** 53.33% → **Treba proveriti** (cilj: 75%+) ⚠️
- **Failing Testovi:** 4 → **0** ✅
- **Unit Testovi:** ✅ Dodato: `clearBalance()` (8 testova), `removePenaltiesForPlan()` (testovi), controller testovi za `balance` i `clearBalance` endpoint-e
- **Guard Integration Testovi:** ✅ Dodato 15 test case-ova za `MonthlyPaywallGuard`
- **E2E Testovi:** ✅ Postoje u `test/gamification.e2e-spec.ts`

### Plans Modul:
- **Coverage:** 46.81% → **Treba proveriti** (cilj: 75%+) ⚠️
- **E2E Testovi:** 0 → **Kreiran** ✅ `test/plans/plans.e2e-spec.ts`
- **Unit Testovi:** ✅ Dodato: `canUnlockNextWeek()` (testovi), `cancelPlan()` (testovi), `requestNextWeek()` (testovi), controller testovi za `cancel`, `canUnlockNextWeek`, `requestNextWeek` endpoint-e
- **Kompletan E2E Suite:** ✅ Kreiran `test/plans/plans.e2e-spec.ts`

---

## ✅ STATUS IMPLEMENTACIJE (2025-12-31)

### Ukupno Testova: 136 passed, 0 failing ✅

### Dodatno Implementirano (van originalnog plana):
1. ✅ **GamificationController Unit Testovi:**
   - `getBalance` endpoint (3 test case-a)
   - `clearBalance` endpoint (4 test case-a)

2. ✅ **PlansController Unit Testovi:**
   - `cancelPlan` endpoint (3 test case-a)
   - `canUnlockNextWeek` endpoint (4 test case-a)
   - `requestNextWeek` endpoint (4 test case-a)

3. ✅ **MonthlyPaywallGuard Integration Testovi:**
   - 15 test case-ova pokrivaju sve scenarije

4. ✅ **GamificationService Unit Testovi:**
   - `clearBalance()` - 8 test case-ova
   - `removePenaltiesForPlan()` - testovi dodati

5. ✅ **PlansService Unit Testovi:**
   - `canUnlockNextWeek()` - testovi dodati
   - `cancelPlan()` - testovi dodati
   - `requestNextWeek()` - testovi dodati

### Preostali Posao:
- ⚠️ **Proveriti coverage** za oba modula (treba pokrenuti coverage report)
- ⚠️ Ako coverage nije ≥75%, dodati dodatne testove za nedostajuće delove

---

**Sledeći korak:** Pokrenuti coverage report i proveriti da li je cilj od 75%+ postignut za oba modula.
