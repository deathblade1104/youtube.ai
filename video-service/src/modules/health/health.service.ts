import { Injectable, Logger } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { MEMORY_HEAP_CHECK_SIZE } from './health.constants';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  async checkHealth() {
    const healthCheckRes = await this.health.check([
      () => this.db.pingCheck('database', { timeout: 5000 }),
      () => this.memory.checkHeap('memory_heap', MEMORY_HEAP_CHECK_SIZE),
      () => this.memory.checkRSS('memory_rss', 800 * 1024 * 1024), // 800MB RSS
      () =>
        this.disk.checkStorage('storage', {
          thresholdPercent: 0.9,
          path: '/',
        }),
    ]);

    const memoryUsage = process.memoryUsage();
    return {
      status: healthCheckRes.status,
      checks: healthCheckRes.details,
      memoryUsage: {
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
      },
    };
  }
}
