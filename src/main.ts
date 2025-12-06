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
      // U development modu, dozvoli sve localhost origin-e
      if (process.env.NODE_ENV !== 'production') {
        if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
      }
      
      // U produkciji, proveri da li je origin u dozvoljenim
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
