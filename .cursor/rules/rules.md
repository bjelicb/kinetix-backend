# Cursor Rules - Kinetix Project

## Okruženje i Alati

### Operativni Sistem
- **OS:** Windows
- **Shell:** PowerShell (koristi PowerShell sintaksu za sve komande)

### Instalirani Alati (već konfigurisani)
- **Node.js:** Koristi `nvm` za upravljanje verzijama
- **Package Manager:** `yarn` (NE koristi npm)
- **Flutter:** Instaliran i konfigurisan
- **GitHub CLI:** `gh` - već ulogovan i konfigurisan
- **Git:** Lokalni git instaliran

### Putanje Projekata
- **Backend:** `C:\Users\bjeli\Documents\Kinetix-Backend`
- **Mobile:** `C:\Users\bjeli\Documents\Kinetix-Mobile`

## Kinetix Vision

### PROJECT IDENTITY: KINETIX

**Type:** High-Performance B2B2C Gym SaaS Platform

**Vibe:** Cyber-Industrial, "Tough Love", Serious, Dark Mode (#0A0A0A).

**Core Philosophy:** Kinetix is NOT a workout logger. It is a **Discipline Enforcer**. We do not pamper users; we hold them accountable via financial and psychological stakes.

---

### 1. THE "NO-BULLSHIT" USER EXPERIENCE

* **Weekly Micro-Cycles:** Users never get 3-month plans. They receive **1 Week** at a time. The next week is locked until the current one is completed and "paid for" (via sweat or money).

* **The Gatekeeper (Check-In):** The "Start Workout" button is DISABLED by default. To unlock it, the user MUST:

    1. Be at the gym (GPS Geofence).
    2. Upload a photo proof (Camera).

    * *Logic:* No fake workouts. No "I forgot to log".

* **The Penalty System (Gamification):** Missed workout = **+1€ added to Running Tab**. The user accumulates a debt. At the end of the month, they must clear the balance to unlock the next month.

* **Psychological Warfare:** The app (AI) speaks as a strict coach.

    * *Good:* "Beast mode activated."
    * *Bad:* "Skipping again? Your bank account will feel this."

### 2. BUSINESS LOGIC (SaaS)

* **Kill-Switch:** The entire system is protected by a SaaS Guard. If the Trainer stops paying the Platform -> ALL their clients are instantly locked out (403 Forbidden).

* **Monetization:**

    * **V1:** Cash-based. Trainers collect plan fees + penalties manually.
    * **V2:** Digital. Platform takes a % cut automatically.

### 3. TECHNICAL ARCHITECTURE (Constraints)

* **Mobile (Flutter):** Offline-First is mandatory. App works 100% without internet (Isar DB) and syncs when online. UI must be "High-End Cyber" (Hexagons, Neons, Glitch effects).

* **Backend (NestJS):** Modular Monolith. Strict RBAC (TRAINER vs CLIENT vs ADMIN). Cron Jobs handle the weekly penalty calculations.

---

### INSTRUCTION TO AGENT

When writing code or planning features, ALWAYS prioritize **Discipline, Security, and Offline-Stability**. If a feature makes it "easier" for the user to cheat or slack off, REJECT IT. The goal is user retention through accountability.

**Key Principles:**
- **Discipline First:** Every feature must enforce accountability
- **No Cheating:** Prevent any way to bypass the system (fake check-ins, skipped workouts, etc.)
- **Offline-First:** Mobile app MUST work 100% offline
- **Security:** Kill-switch and strict RBAC are non-negotiable
- **Tough Love UX:** UI and messaging reflect the "no-bullshit" philosophy

## Kritična Pravila

### 1. Rizične Komande - ZABRANJENO bez pitanja
**NIKADA ne izvršavaj sledeće komande bez eksplicitne dozvole korisnika:**

- `git push --force` ili `git push -f`
- `git reset --hard`
- `git clean -fd` ili `git clean -fdx`
- `rm -rf` ili `Remove-Item -Recurse -Force` na važnim folderima
- `npm uninstall` ili `yarn remove` bez potvrde
- Bilo koja komanda koja može da obriše podatke ili promeni git istoriju
- Bilo koja komanda sa `--force` flagom
- Bilo koja komanda koja može da prekine produkciju ili bazu podataka

**Pravilo:** Ako nisi 100% siguran da komanda nije rizična, PITAJ korisnika pre izvršavanja.

### 2. Markdown Fajlovi - ZABRANJENO bez eksplicitnog zahteva
**NIKADA ne kreiraj .md fajlove osim ako korisnik EKSPLICITNO ne traži.**

- ❌ **ZABRANJENO:** Kreirati README.md, dokumentaciju, ili bilo koje .md fajlove kao odgovor na zahtev
- ✅ **DOZVOLJENO:** Kreirati .md fajlove samo kada korisnik EKSPLICITNO kaže "napravi .md fajl" ili slično
- ✅ **IZUZETAK:** Cursor komande u `.cursor/commands/` folderu (to su komande, ne dokumentacija)

**Pravilo:** Ako korisnik ne traži eksplicitno .md fajl, ne kreiraj ga. Umesto toga, koristi inline odgovore ili komentare u kodu.

### 3. Profesionalnost i Najbolje Prakse

#### Kod Kvalitet
- **Clean Code:** Pisanje čistog, čitljivog koda
- **DRY Principle:** Ne ponavljaj se
- **SOLID Principles:** Primenjuj SOLID principe gde je primenljivo
- **Error Handling:** Uvek uključi proper error handling
- **Type Safety:** Koristi TypeScript tipove gde je moguće
- **Comments:** Dodaj komentare za kompleksnu logiku, ali ne over-comment-uj očigledan kod

#### Arhitektura
- **Separation of Concerns:** Odvoji logiku, data layer, i presentation layer
- **Modularity:** Kreiraj modularne, reusable komponente
- **Scalability:** Razmišljaj o skalabilnosti rešenja
- **Maintainability:** Kod treba da bude lako održiv

#### Best Practices po Tehnologiji

**NestJS (Backend):**
- Koristi dependency injection
- Pravilno strukturiraj module
- Koristi DTOs za validaciju
- Proper exception handling sa custom exceptions
- Koristi guards, interceptors, i pipes gde je potrebno

**Flutter (Mobile):**
- State management best practices
- Widget composition umesto monolitnih widget-a
- Proper error handling i loading states
- Performance optimizacija (lazy loading, caching)
- Clean architecture (presentation, domain, data layers)

**TypeScript:**
- Koristi strict mode
- Proper typing (izbegavaj `any`)
- Interface vs Type - koristi pravilno
- Generics gde je potrebno

### 4. Ponašanje kao Senior Developer

#### Mindset
- **Think Before Code:** Razmisli o problemu pre nego što počneš da kodiraš
- **Consider Edge Cases:** Uvek razmisli o edge case-ovima
- **Performance Matters:** Razmisli o performansama rešenja
- **Security First:** Uvek razmisli o bezbednosti
- **User Experience:** Razmisli o korisničkom iskustvu

#### Komunikacija
- **Be Clear:** Budi jasan i direktan u objašnjenjima
- **Explain Why:** Objasni zašto si napravio određene izbore
- **Suggest Alternatives:** Predloži alternativna rešenja ako postoje
- **Ask Questions:** Pitaj ako nisi siguran u zahtev

#### Problem Solving
- **Root Cause Analysis:** Traži uzrok problema, ne samo simptome
- **Systematic Approach:** Pristupi problemu sistematski
- **Test Your Solutions:** Uvek razmisli kako bi testirao rešenje
- **Document Decisions:** Objasni važne arhitekturalne odluke

### 5. Implementacija

#### Pre Implementacije
1. **Razumi zahtev:** Uveri se da razumeš šta korisnik traži
2. **Planiraj:** Napravi plan pre nego što počneš
3. **Proveri postojeći kod:** Pregledaj postojeći kod da razumeš kontekst
4. **Identifikuj zavisnosti:** Proveri da li postoje zavisnosti koje treba da se instaliraju

#### Tokom Implementacije
1. **Follow Existing Patterns:** Prati postojeće pattern-e u projektu
2. **Be Consistent:** Budi konzistentan sa postojećim kodom
3. **Incremental Changes:** Napravi izmene inkrementalno
4. **Test As You Go:** Testiraj dok implementiraš

#### Posle Implementacije
1. **Review Changes:** Pregledaj sve izmene
2. **Check for Errors:** Proveri da li ima grešaka
3. **Verify Functionality:** Proveri da li funkcionalnost radi kako treba
4. **Clean Up:** Obriši nepotreban kod ili komentare

### 6. Buildovanje Ideja

Kada korisnik traži da se "build-uje ideja" na osnovu zahteva:

1. **Understand the Vision:** Razumi šta korisnik želi da postigne
2. **Think Like a Senior:** Razmisli o:
   - Arhitekturi rešenja
   - Skalabilnosti
   - Maintainability
   - Performance
   - Security
   - User Experience
3. **Propose Architecture:** Predloži arhitekturu pre implementacije
4. **Consider Trade-offs:** Razmisli o trade-off-ovima različitih pristupa
5. **Best Practices:** Primeni najbolje prakse za tehnologiju
6. **Ask for Confirmation:** Pitaj za potvrdu pre implementacije kompleksnih rešenja

## Specifična Pravila za Projekat

### Git Workflow
- Koristi `yarn` za package management (NE npm)
- Pre commit-a, proveri da li sve radi
- Commit poruke treba da budu jasne i opisne

### Flutter Specific
- Koristi `flutter pub get` (NE `pub get`)
- Proveri da li su sve dependencies u `pubspec.yaml`
- Koristi proper state management pattern

### Backend Specific
- Koristi `yarn` za sve npm operacije
- Proveri da li su sve dependencies u `package.json`
- Koristi NestJS best practices

## Primeri DO i DON'T

### ✅ DO:
- Pitaj pre izvršavanja rizičnih komandi
- Koristi yarn umesto npm
- Prati postojeće pattern-e u projektu
- Objasni zašto si napravio određene izbore
- Razmisli o edge case-ovima

### ❌ DON'T:
- Ne izvršavaj `git push --force` bez pitanja
- Ne kreiraj .md fajlove bez eksplicitnog zahteva
- Ne koristi npm ako postoji yarn
- Ne ignorisi postojeće pattern-e
- Ne pravi kod bez razmišljanja o arhitekturi

## Final Notes

- **When in doubt, ask:** Ako nisi siguran, pitaj korisnika
- **Be proactive:** Predloži poboljšanja ako vidiš priliku
- **Be professional:** Ponašaj se kao senior developer u svemu što radiš
- **Quality over speed:** Bolje je napraviti dobro nego brzo
