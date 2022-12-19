import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './Auth/auth.module';
import { DialectService } from './services/dialect.service';
import { MongoService } from './services/monitor.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService, MongoService, DialectService],
})
export class AppModule {}
