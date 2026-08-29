import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { patchNestJsSwagger, ZodValidationPipe } from "nestjs-zod";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { MAX_RAW_UPLOAD_BYTES } from "./common/upload.util";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ maxParamLength: 1000 }),
    // Exposes request.rawBody (Buffer) — needed by the Razorpay webhook
    // controller to verify the HMAC signature over the exact request bytes.
    { rawBody: true },
  );

  const config = app.get(ConfigService);

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: MAX_RAW_UPLOAD_BYTES, files: 1 } });

  app.enableCors({
    origin: config.get<string>("CORS_ORIGIN", "http://localhost:5173"),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Prevents a browser from MIME-sniffing an uploaded/served file into
  // executing as something other than its declared Content-Type (relevant
  // for the /documents/:id/file inline-served uploads).
  app.getHttpAdapter().getInstance().addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
  });

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  patchNestJsSwagger();
  const swaggerConfig = new DocumentBuilder()
    .setTitle("NMMS API")
    .setDescription("NGO Membership Management System API — Enterprise Grade")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = config.get<number>("PORT", 3000);
  await app.listen(port, "0.0.0.0");
}

bootstrap();
