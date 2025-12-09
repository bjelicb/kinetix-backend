import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API prefix
  app.setGlobalPrefix('api');

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Kinetix API')
    .setDescription('Kinetix Fitness Training Platform API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('trainers', 'Trainer profile and management')
    .addTag('clients', 'Client profile and management')
    .addTag('plans', 'Workout plan management')
    .addTag('workouts', 'Workout logging and tracking')
    .addTag('checkins', 'Gym check-in verification')
    .addTag('media', 'Media upload signatures')
    .addTag('training', 'Training synchronization')
    .addTag('gamification', 'Gamification and penalties')
    .addTag('admin', 'Admin operations and user management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Security & Performance Middleware
  app.use(helmet());
  app.use(compression());

  // CORS Configuration
  const allowedOrigins = process.env.MOBILE_APP_URL
    ? process.env.MOBILE_APP_URL.split(',')
    : [
        'http://localhost:19006', // Expo default
        'http://localhost:8080',  // Flutter web
        'http://localhost:3000',  // Backend (za Swagger)
      ];

  app.enableCors({
    origin: (origin, callback) => {
      console.log(`[CORS] Request from origin: ${origin || 'no origin'}`);
      
      // U development modu, dozvoli sve localhost origin-e i IP adrese iz lokalne mreže
      if (process.env.NODE_ENV !== 'production') {
        if (!origin || 
            origin.startsWith('http://localhost:') || 
            origin.startsWith('http://127.0.0.1:') ||
            origin.startsWith('http://192.168.0.') ||
            origin.includes('localhost') ||
            origin.includes('127.0.0.1')) { // Dozvoli sve localhost varijacije
          console.log(`[CORS] ✓ Allowing origin in dev mode: ${origin}`);
          return callback(null, true);
        }
      }
      
      // U produkciji, proveri da li je origin u dozvoljenim
      if (allowedOrigins.includes(origin)) {
        console.log(`[CORS] ✓ Allowing origin from allowed list: ${origin}`);
        callback(null, true);
      } else {
        console.log(`[CORS] ✗ Blocking origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown props
      transform: true, // Auto-transform to DTO types
    }),
  );

  // Global Filters & Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3000;
  // Listen on all interfaces (0.0.0.0) to allow connections from mobile devices on the same network
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Accessible from network at: http://192.168.0.27:${port}/api`);
}
bootstrap();
