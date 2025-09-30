// src/bullmq/bullmq.service.ts
import { getQueueToken } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BulkJobOptions, JobsOptions, Queue } from 'bullmq';

@Injectable()
export class BullQueueService {
  private queues: Map<string, Queue> = new Map();

  constructor(private moduleRef: ModuleRef) {}

  async getQueue(queueName: string): Promise<Queue> {
    if (!this.queues.has(queueName)) {
      try {
        const queue = this.moduleRef.get(getQueueToken(queueName), {
          strict: false,
        });
        if (queue) {
          this.queues.set(queueName, queue);
        } else {
          throw new Error(`Queue "${queueName}" not registered`);
        }
      } catch (error) {
        throw new Error(`Failed to get queue "${queueName}": ${error.message}`);
      }
    }
    return this.queues.get(queueName) as Queue;
  }

  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ) {
    const queue = await this.getQueue(queueName);
    return await queue.add(jobName, data, options);
  }

  async addJobsInBulk<T>(
    queueName: string,
    jobName: string,
    dataArray: T[],
    options?: JobsOptions,
  ) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return;
    }

    const queue = await this.getQueue(queueName);

    const jobsArray: {
      name: string;
      data: T;
      opts?: BulkJobOptions;
    }[] = dataArray.map((data) => ({
      name: jobName,
      data,
      opts: options,
    }));

    return await queue.addBulk(jobsArray);
  }
}
