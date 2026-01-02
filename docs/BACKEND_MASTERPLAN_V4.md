# KINETIX BACKEND - MASTERPLAN V4
## Faza 4: Produkcija (Deploy & Monitoring)

**Prioritet:** 🟢 **POSLE TESTIRANJA**  
**Status:** ⚠️ **STRUKTURE PRIREMLJENE**  
**Timeline:** 1-2 nedelje

> **FOKUS:** Produkcijski taskovi - Stripe payments, monitoring, security enhancements.

> **⚠️ NAPOMENA:** Neke strukture su već pripremljene (ClientPayment schema, AppLogger, TrainerProfile Stripe polja). Ova faza implementira logiku i production-ready verzije.

---

## 📋 **ZADACI:**

### **4.1 Stripe Payment Integration** 🔴

**⚠️ STATUS:** ⚠️ **STRUKTURA PRIREMLJENA**
- ✅ ClientPayment schema postoji u `src/payments/schemas/client-payment.schema.ts`
- ✅ ClientPayment je registrovana u `payments.module.ts`
- ✅ ClientPayment se inject-uje u `PaymentsService` kao `paymentModel`
- ✅ TrainerProfile ima `stripeCustomerId` i `stripeSubscriptionId` polja
- ❌ ClientPayment se NIKADA ne koristi (samo MonthlyInvoice se koristi)
- ❌ Nema Stripe integracije (webhook, payment intent, itd.)

**Zadaci:**
- [ ] Implementirati Stripe integraciju i koristiti ClientPayment
- [ ] Webhook endpoint za subscription events
- [ ] Subscription upgrade endpoint sa plaćanjem
- [ ] Invoice generation (koristiti ClientPayment umesto samo MonthlyInvoice)
- [ ] Payment history

### **4.2 Push Notifications** 🟡
- [ ] Firebase Cloud Messaging integracija
- [ ] Notification service
- [ ] Templates za notifikacije

### **4.3 Monitoring & Logging** 🟡

**⚠️ STATUS:** ⚠️ **OSNOVNA STRUKTURA POSTOJI**
- ✅ AppLogger postoji u `src/common/utils/logger.utils.ts`
- ✅ Osnovna struktura za logging
- ⚠️ Nije production-ready (nema Winston/Pino)
- ❌ Nema Sentry integraciju
- ❌ Nema performance monitoring
- ❌ Nema health checks endpoint

**Zadaci:**
- [ ] Migrirati AppLogger na Winston/Pino za produkciju
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Health checks endpoint

### **4.4 Security Enhancements** 🟡
- [ ] Global rate limiting
- [ ] DDoS protection
- [ ] CORS configuration
- [ ] Helmet.js security headers

---

### **4.5 LLM Integration for Plan Generation** 🟢 **FUTURE**

**Zadatak:**
Priprema za AI-generisane planove (Phase 2)

**Zahtevi:**
- [ ] Data export endpoint za training LLM-a
- [ ] Endpoint: `POST /ai/generate-plan` (sa parametrima: goal, level, equipment)
- [ ] LLM prompt templates
- [ ] Plan validation logic (AI output mora biti valid WeeklyPlan schema)
- [ ] Trainer review & approve workflow
- [ ] Integration sa OpenAI/Anthropic API (ili self-hosted LLM)
- [ ] Fine-tuning dataset preparation (export V1 plan data)

**Fajlovi:**
- `src/ai/llm-plan-generator.service.ts` - **NOVO**
- `src/ai/ai.controller.ts` - **IZMENA**
- `src/ai/dto/generate-plan.dto.ts` - **NOVO**
- `src/ai/prompts/plan-generation.prompt.ts` - **NOVO**

**Implementacija:**

```typescript
// llm-plan-generator.service.ts
@Injectable()
export class LLMPlanGeneratorService {
  async generatePlan(dto: GeneratePlanDto): Promise<WeeklyPlan> {
    // Build prompt from template
    const prompt = this.buildPrompt(dto);
    
    // Call LLM API
    const response = await this.llmClient.generate(prompt);
    
    // Parse and validate response
    const planData = this.parseLLMResponse(response);
    
    // Validate against WeeklyPlan schema
    this.validatePlanSchema(planData);
    
    // Return plan (trainer must approve before assignment)
    return planData;
  }

  async exportTrainingData(): Promise<TrainingDataExport> {
    // Export all V1 plans, workouts, client progress
    // Format for LLM fine-tuning
  }
}
```

**Napomena:** Ovo je Phase 2 feature, implementirati POSLE što imaš dovoljno V1 training data (min 6 meseci produkcije).

**Testovi:**
- [ ] Test plan generation endpoint
- [ ] Test plan validation
- [ ] Test prompt templates
- [ ] Test data export

---

### **4.6 Data Migration Strategy** 🔵

**Zadatak:**
Spremnost za schema changes i data migration

**Zahtevi:**
- [ ] Migration scripts za schema changes
- [ ] Backward compatibility handling
- [ ] Versioning za schema changes
- [ ] Rollback strategy

**Fajlovi:**
- `src/migrations/` - **NOVO** (folder za migration scripts)

---

## 🔗 **VEZE:**

- **Status:** `docs/BACKEND_STATUS.md`

