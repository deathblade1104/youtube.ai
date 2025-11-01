import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullMQModule } from '../../providers/bullmq/bullmq.module';
import { BloomFilterStateService } from './bloom-filter-state.service';
import { UsersController } from './controllers/user.controller';
import { User } from './entities/user.entity';
import { SyncUserEmailsProcessor } from './processors/sync-user-emails.processor';
import { UserEmailSyncScheduler } from './schedulers/user-email-sync.scheduler';
import {
  SYNC_USER_EMAILS_JOB_OPTIONS,
  SYNC_USER_EMAILS_JOB_QUEUE,
} from './user.constants';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BullMQModule.forFeature([
      {
        name: SYNC_USER_EMAILS_JOB_QUEUE,
        defaultJobOptions: SYNC_USER_EMAILS_JOB_OPTIONS,
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [
    BloomFilterStateService,
    UserService,
    SyncUserEmailsProcessor,
    UserEmailSyncScheduler,
  ],
  exports: [UserService],
})
export class UserModule {}
