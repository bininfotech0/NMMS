import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ApplicationsModule } from "./applications/applications.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CardModule } from "./card/card.module";
import { DocumentsModule } from "./documents/documents.module";
import { EventsModule } from "./events/events.module";
import { HealthModule } from "./health/health.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { KycModule } from "./kyc/kyc.module";
import { MastersModule } from "./masters/masters.module";
import { MemberAuthModule } from "./member-auth/member-auth.module";
import { MembersModule } from "./members/members.module";
import { NoticesModule } from "./notices/notices.module";
import { OcrModule } from "./ocr/ocr.module";
import { OrgModule } from "./org/org.module";
import { PaymentsModule } from "./payments/payments.module";
import { PlansModule } from "./plans/plans.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { ReportsModule } from "./reports/reports.module";
import { UsersModule } from "./users/users.module";
import { WithdrawalsModule } from "./withdrawals/withdrawals.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env"],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrgModule,
    PlansModule,
    MastersModule,
    IntegrationsModule,
    MembersModule,
    ApplicationsModule,
    PaymentsModule,
    OcrModule,
    ReportsModule,
    DocumentsModule,
    EventsModule,
    NoticesModule,
    CardModule,
    MemberAuthModule,
    ReferralsModule,
    KycModule,
    WithdrawalsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
