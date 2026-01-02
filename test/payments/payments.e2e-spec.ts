import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import {
  createTestTrainer,
  createTestClient,
  cleanupTestData,
  TestTrainer,
  TestClient,
} from '../helpers/test-helpers';
import { ClientProfile } from '../../src/clients/schemas/client-profile.schema';
import { MonthlyInvoice } from '../../src/payments/schemas/monthly-invoice.schema';
import { InvoiceStatus } from '../../src/payments/schemas/monthly-invoice.schema';
import { User } from '../../src/users/schemas/user.schema';
import { UserRole } from '../../src/common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

/**
 * Helper function to create client with penaltyHistory
 * Accepts profileId (ClientProfile._id) directly since penaltyHistory is in ClientProfile
 */
async function createClientWithPenaltyHistory(
  connection: Connection,
  clientProfileId: string | Types.ObjectId,
  penalties: Array<{ date: Date; amount: number; reason: string }>,
): Promise<void> {
  const ClientProfileModel = connection.models[ClientProfile.name];
  
  // Convert to ObjectId - handle both string and ObjectId input
  let profileIdObjectId: Types.ObjectId;
  let profileIdString: string;
  
  if (typeof clientProfileId === 'string') {
    if (!Types.ObjectId.isValid(clientProfileId)) {
      throw new Error(`Invalid profileId format: ${clientProfileId}`);
    }
    profileIdObjectId = new Types.ObjectId(clientProfileId);
    profileIdString = clientProfileId;
  } else {
    profileIdObjectId = clientProfileId;
    profileIdString = clientProfileId.toString();
  }
  
  // Find client profile by _id directly
  const client = await ClientProfileModel.findById(profileIdObjectId).exec();
  
  if (!client) {
    throw new Error(`Client profile not found for profileId: ${profileIdString}`);
  }
  
  client.penaltyHistory = penalties;
  await client.save();
}

/**
 * E2E Test for Payments Module
 * 
 * Tests payments endpoints with proper RBAC checks and database verification.
 */
describe('Payments E2E (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let moduleFixture: TestingModule;

  let trainer: TestTrainer;
  let client: TestClient;
  let otherClient: TestClient; // For RBAC tests
  let adminUser: { token: string; userId: string; email: string };
  const testEmails: string[] = [];

  /**
   * Create admin user directly in database
   */
  async function createTestAdmin(connection: Connection): Promise<{ token: string; userId: string; email: string }> {
    const adminEmail = `admin-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`;
    const UserModel = connection.models[User.name];
    
    // Generate proper bcrypt hash for password 'Test123!@#'
    const passwordHash = await bcrypt.hash('Test123!@#', 10);
    
    const adminUser = new UserModel({
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
    });
    await adminUser.save();

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Test123!@#' })
      .expect((res) => {
        if (res.status !== 200 && res.status !== 201) {
          throw new Error(`Expected 200 or 201, got ${res.status}`);
        }
      });

    const loginData = loginResponse.body?.data || loginResponse.body;
    const token = loginData.accessToken;

    return {
      token,
      userId: adminUser._id.toString(),
      email: adminEmail,
    };
  }

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();

    connection = moduleFixture.get<Connection>(getConnectionToken());

    // Create admin user
    adminUser = await createTestAdmin(connection);
    testEmails.push(adminUser.email);

    // Create trainer and clients for testing
    trainer = await createTestTrainer(app, undefined, connection);
    testEmails.push(trainer.email);

    client = await createTestClient(app, trainer.profileId, undefined, connection);
    testEmails.push(client.email);

    // Create another client for RBAC tests (different trainer)
    const otherTrainer = await createTestTrainer(app, undefined, connection);
    testEmails.push(otherTrainer.email);
    otherClient = await createTestClient(app, otherTrainer.profileId, undefined, connection);
    testEmails.push(otherClient.email);
  });

  afterAll(async () => {
    if (testEmails.length > 0 && connection) {
      await cleanupTestData(connection, testEmails);
    }
    if (connection) {
      await connection.close();
    }
    if (app) {
      await app.close();
    }
  });

  describe('POST /api/payments/generate-invoice', () => {
    it('should generate invoice with correct calculations from penaltyHistory', async () => {
      // Arrange: Setup client with penaltyHistory for January 2025
      const month = new Date('2025-01-15T10:00:00.000Z');
      const monthStartLocal = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEndLocal = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

      const penalties = [
        { date: new Date('2025-01-10T10:00:00.000Z'), amount: 1, reason: 'Missed workout' },
        { date: new Date('2025-01-15T10:00:00.000Z'), amount: 1, reason: 'Missed workout' },
        { date: new Date('2025-01-20T10:00:00.000Z'), amount: 50, reason: 'Weekly plan cost' },
      ];

      await createClientWithPenaltyHistory(connection, client.profileId, penalties);

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      const responseData = response.body?.data || response.body;

      // Assert response structure
      expect(responseData).toBeDefined();
      expect(responseData).toHaveProperty('_id');
      expect(responseData.totalBalance).toBe(52); // 2€ penalties + 50€ plan cost
      expect(responseData.penalties).toBe(2); // 2x Missed workout
      expect(responseData.planCosts).toBe(50); // 1x Weekly plan cost
      expect(responseData.status).toBe(InvoiceStatus.UNPAID);
      
      // MERODAVNOST PROVERE: Proveriti da se invoice stvarno čuva u bazu
      const InvoiceModel = connection.models[MonthlyInvoice.name];
      const savedInvoice = await InvoiceModel.findById(responseData._id).exec();
      
      expect(savedInvoice).toBeDefined();
      expect(savedInvoice.totalBalance).toBe(52);
      expect(savedInvoice.penalties).toBe(2);
      expect(savedInvoice.planCosts).toBe(50);
      expect(savedInvoice.status).toBe(InvoiceStatus.UNPAID);
      
      // MERODAVNOST PROVERE: Proveriti timezone handling (month start/end su u lokalnom timezone-u)
      const savedMonth = new Date(savedInvoice.month);
      expect(savedMonth.getFullYear()).toBe(monthStartLocal.getFullYear());
      expect(savedMonth.getMonth()).toBe(monthStartLocal.getMonth());
      expect(savedMonth.getDate()).toBe(monthStartLocal.getDate());
    });

    it('should return existing invoice if invoice already exists for the month', async () => {
      const month = new Date('2025-02-15T10:00:00.000Z');

      // Create invoice directly in database
      const InvoiceModel = connection.models[MonthlyInvoice.name];
      
      // Use profileId directly (ClientProfile._id)
      let profileIdObjectId: Types.ObjectId;
      if (typeof client.profileId === 'string') {
        if (!Types.ObjectId.isValid(client.profileId)) {
          throw new Error(`Invalid profileId format: ${client.profileId}`);
        }
        profileIdObjectId = new Types.ObjectId(client.profileId);
      } else {
        profileIdObjectId = client.profileId;
      }
      const clientProfileId = profileIdObjectId;
      const existingInvoice = new InvoiceModel({
        clientId: clientProfileId,
        month: new Date(month.getFullYear(), month.getMonth(), 1),
        totalBalance: 100,
        penalties: 50,
        planCosts: 50,
        status: InvoiceStatus.UNPAID,
        dueDate: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999),
      });
      await existingInvoice.save();

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(200); // Should return existing, not create new

      const responseData = response.body?.data || response.body;

      // Assert: Should return existing invoice
      expect(responseData._id.toString()).toBe(existingInvoice._id.toString());
      expect(responseData.totalBalance).toBe(100);

      // MERODAVNOST PROVERE: Proveriti da nije kreiran duplikat
      const allInvoices = await InvoiceModel.find({
        clientId: clientProfileId,
        month: new Date(month.getFullYear(), month.getMonth(), 1),
      }).exec();
      expect(allInvoices.length).toBe(1); // Only one invoice should exist
    });

    it('should handle penalty on first day of month (00:00:00)', async () => {
      const month = new Date('2025-03-15T10:00:00.000Z');
      const monthStartLocal = new Date(month.getFullYear(), month.getMonth(), 1);

      const penalties = [
        { date: monthStartLocal, amount: 1, reason: 'Missed workout' },
      ];

      await createClientWithPenaltyHistory(connection, client.profileId, penalties);

      const response = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData.penalties).toBe(1);
    });

    it('should handle penalty on last day of month (23:59:59.999)', async () => {
      const month = new Date('2025-04-15T10:00:00.000Z');
      const monthEndLocal = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

      const penalties = [
        { date: monthEndLocal, amount: 1, reason: 'Missed workout' },
      ];

      await createClientWithPenaltyHistory(connection, client.profileId, penalties);

      const response = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData.penalties).toBe(1);
    });

    it('should handle client with no penaltyHistory', async () => {
      const month = new Date('2025-05-15T10:00:00.000Z');

      // Ensure no penaltyHistory
      await createClientWithPenaltyHistory(connection, client.profileId, []);

      const response = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      const responseData = response.body?.data || response.body;
      expect(responseData.totalBalance).toBe(0);
      expect(responseData.penalties).toBe(0);
      expect(responseData.planCosts).toBe(0);

      // MERODAVNOST PROVERE: Proveriti da se invoice čuva u bazu sa 0 balance
      const InvoiceModel = connection.models[MonthlyInvoice.name];
      const savedInvoice = await InvoiceModel.findById(responseData._id).exec();
      expect(savedInvoice).toBeDefined();
      expect(savedInvoice.totalBalance).toBe(0);
      expect(savedInvoice.penalties).toBe(0);
      expect(savedInvoice.planCosts).toBe(0);
    });

    it('should return 400 BadRequest when month is invalid date', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: 'invalid-date' })
        .expect(400);
    });

    it('should return 403 Forbidden when authenticated as TRAINER', async () => {
      const month = new Date('2025-06-15T10:00:00.000Z');

      await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${trainer.token}`)
        .send({ month: month.toISOString() })
        .expect(403);
    });

    it('should return 401 Unauthorized when not authenticated', async () => {
      const month = new Date('2025-07-15T10:00:00.000Z');

      await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .send({ month: month.toISOString() })
        .expect(401);
    });
  });

  describe('GET /api/payments/invoice/:clientId/:month', () => {
    it('should return invoice when authenticated as CLIENT (own invoice)', async () => {
      // Arrange: Create invoice
      const month = new Date('2025-08-15T10:00:00.000Z');
      const penalties = [
        { date: new Date('2025-08-10T10:00:00.000Z'), amount: 1, reason: 'Missed workout' },
      ];
      await createClientWithPenaltyHistory(connection, client.profileId, penalties);

      const generateResponse = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      const invoiceId = (generateResponse.body?.data || generateResponse.body)._id;

      // Act
      const response = await request(app.getHttpServer())
        .get(`/api/payments/invoice/${client.userId}/${month.toISOString()}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;

      // Assert
      expect(responseData).toBeDefined();
      expect(responseData._id.toString()).toBe(invoiceId);
      expect(responseData.totalBalance).toBe(1);

      // MERODAVNOST PROVERE: Proveriti da invoice postoji u bazi sa ispravnim podacima
      const InvoiceModel = connection.models[MonthlyInvoice.name];
      const savedInvoice = await InvoiceModel.findById(invoiceId).exec();
      expect(savedInvoice).toBeDefined();
      expect(savedInvoice.totalBalance).toBe(1);
      expect(savedInvoice._id.toString()).toBe(invoiceId);
    });

    it('should return invoice when authenticated as TRAINER (client invoice)', async () => {
      // Arrange: Create invoice for client
      const month = new Date('2025-09-15T10:00:00.000Z');
      const penalties = [
        { date: new Date('2025-09-10T10:00:00.000Z'), amount: 1, reason: 'Missed workout' },
      ];
      await createClientWithPenaltyHistory(connection, client.profileId, penalties);

      await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      // Act: Trainer accessing their client's invoice
      const response = await request(app.getHttpServer())
        .get(`/api/payments/invoice/${client.userId}/${month.toISOString()}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();
      expect(responseData.totalBalance).toBe(1);

      // MERODAVNOST PROVERE: Proveriti da invoice postoji u bazi
      const InvoiceModel = connection.models[MonthlyInvoice.name];
      const savedInvoice = await InvoiceModel.findById(responseData._id).exec();
      expect(savedInvoice).toBeDefined();
      expect(savedInvoice.totalBalance).toBe(1);
    });

    it('should return invoice when authenticated as ADMIN', async () => {
      // Arrange: Create invoice
      const month = new Date('2025-10-15T10:00:00.000Z');
      const penalties = [
        { date: new Date('2025-10-10T10:00:00.000Z'), amount: 1, reason: 'Missed workout' },
      ];
      await createClientWithPenaltyHistory(connection, client.profileId, penalties);

      await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      // Act: Admin accessing invoice
      const response = await request(app.getHttpServer())
        .get(`/api/payments/invoice/${client.userId}/${month.toISOString()}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;
      expect(responseData).toBeDefined();

      // MERODAVNOST PROVERE: Proveriti da invoice postoji u bazi
      const InvoiceModel = connection.models[MonthlyInvoice.name];
      const savedInvoice = await InvoiceModel.findById(responseData._id).exec();
      expect(savedInvoice).toBeDefined();
    });

    it('should return 403 Forbidden when CLIENT tries to access another client invoice', async () => {
      const month = new Date('2025-11-15T10:00:00.000Z');

      await request(app.getHttpServer())
        .get(`/api/payments/invoice/${otherClient.userId}/${month.toISOString()}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });

    it('should return 403 Forbidden when TRAINER tries to access non-client invoice', async () => {
      const month = new Date('2025-12-15T10:00:00.000Z');

      await request(app.getHttpServer())
        .get(`/api/payments/invoice/${otherClient.userId}/${month.toISOString()}`)
        .set('Authorization', `Bearer ${trainer.token}`)
        .expect(403); // otherClient belongs to different trainer
    });

    it('should return 404 NotFound when invoice does not exist', async () => {
      const month = new Date('2026-01-15T10:00:00.000Z');

      await request(app.getHttpServer())
        .get(`/api/payments/invoice/${client.userId}/${month.toISOString()}`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(404);
    });
  });

  describe('PATCH /api/payments/invoice/:id/paid', () => {
    it('should mark invoice as paid and clear client balance', async () => {
      // Arrange: Create invoice and set client balance
      const month = new Date('2026-02-15T10:00:00.000Z');
      const penalties = [
        { date: new Date('2026-02-10T10:00:00.000Z'), amount: 1, reason: 'Missed workout' },
        { date: new Date('2026-02-20T10:00:00.000Z'), amount: 50, reason: 'Weekly plan cost' },
      ];
      await createClientWithPenaltyHistory(connection, client.profileId, penalties);

      // Set client balance manually
      const ClientProfileModel = connection.models[ClientProfile.name];
      // Use profileId directly (ClientProfile._id)
      let profileIdObjectId: Types.ObjectId;
      if (typeof client.profileId === 'string') {
        if (!Types.ObjectId.isValid(client.profileId)) {
          throw new Error(`Invalid profileId format: ${client.profileId}`);
        }
        profileIdObjectId = new Types.ObjectId(client.profileId);
      } else {
        profileIdObjectId = client.profileId;
      }
      const clientProfile = await ClientProfileModel.findById(profileIdObjectId).exec();
      
      if (!clientProfile) {
        throw new Error('Client profile not found');
      }
      
      clientProfile.balance = 51;
      clientProfile.monthlyBalance = 51;
      await clientProfile.save();

      const generateResponse = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${client.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      const invoiceId = (generateResponse.body?.data || generateResponse.body)._id;

      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/payments/invoice/${invoiceId}/paid`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(200);

      const responseData = response.body?.data || response.body;

      // Assert response
      expect(responseData.status).toBe(InvoiceStatus.PAID);
      expect(responseData.paidAt).toBeDefined();

      // MERODAVNOST PROVERE: Proveriti da se balance stvarno briše u bazi
      const updatedClientProfile = await ClientProfileModel.findById(profileIdObjectId).exec();
      
      expect(updatedClientProfile).toBeDefined();
      expect(updatedClientProfile.balance).toBe(0);
      expect(updatedClientProfile.monthlyBalance).toBe(0);

      // MERODAVNOST PROVERE: Proveriti da je invoice status ažuriran u bazi
      const InvoiceModel = connection.models[MonthlyInvoice.name];
      const updatedInvoice = await InvoiceModel.findById(invoiceId).exec();
      expect(updatedInvoice.status).toBe(InvoiceStatus.PAID);
      expect(updatedInvoice.paidAt).toBeDefined();
    });

    it('should return 403 Forbidden when CLIENT tries to pay another client invoice', async () => {
      // Create invoice for otherClient
      const month = new Date('2026-03-15T10:00:00.000Z');
      const penalties = [
        { date: new Date('2026-03-10T10:00:00.000Z'), amount: 1, reason: 'Missed workout' },
      ];
      await createClientWithPenaltyHistory(connection, otherClient.profileId, penalties);

      const generateResponse = await request(app.getHttpServer())
        .post('/api/payments/generate-invoice')
        .set('Authorization', `Bearer ${otherClient.token}`)
        .send({ month: month.toISOString() })
        .expect(201);

      const invoiceId = (generateResponse.body?.data || generateResponse.body)._id;

      // Act: client trying to pay otherClient's invoice
      await request(app.getHttpServer())
        .patch(`/api/payments/invoice/${invoiceId}/paid`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(403);
    });

    it('should return 404 NotFound when invoice does not exist', async () => {
      const fakeInvoiceId = '507f1f77bcf86cd799439999';

      await request(app.getHttpServer())
        .patch(`/api/payments/invoice/${fakeInvoiceId}/paid`)
        .set('Authorization', `Bearer ${client.token}`)
        .expect(404);
    });
  });
});