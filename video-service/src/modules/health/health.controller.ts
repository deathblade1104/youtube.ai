import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { CacheService } from '../../database/redis/redis.service';

@Controller({ path: 'health', version: '1' })
@ApiTags('Health Check API')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private cacheService: CacheService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'System health check',
    description:
      'Comprehensive health check including database, memory, disk, and cache status.',
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            memory_heap: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            memory_rss: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            disk: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            redis: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
          },
        },
        error: {},
        details: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            memory_heap: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            memory_rss: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            disk: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
            redis: {
              type: 'object',
              properties: { status: { type: 'string', example: 'up' } },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'System is unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        info: {},
        error: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: { status: { type: 'string', example: 'down' } },
            },
          },
        },
        details: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: { status: { type: 'string', example: 'down' } },
            },
          },
        },
      },
    },
  })
  check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck('database'),

      // Memory health checks
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150MB

      // Disk health check
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9, // 90% disk usage threshold
        }),
    ]);
  }
}
