import {
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { IBaseEntity } from '../interfaces/base-entity.interface';

export class GenericCrudRepository<T extends IBaseEntity> {
  protected readonly logger = new Logger(GenericCrudRepository.name);
  private errorMessage: string;

  constructor(
    private readonly repository: Repository<T>,
    private readonly entityName: string,
  ) {}

  private getRepo(manager?: EntityManager): Repository<T> {
    return manager
      ? manager.getRepository<T>(this.repository.target as any)
      : this.repository;
  }

  async create(createDto: DeepPartial<T>, manager?: EntityManager): Promise<T> {
    try {
      const repo = this.getRepo(manager);
      const entity = repo.create(createDto);
      return await repo.save(entity);
    } catch (error) {
      this.errorMessage = `Failed to create ${this.entityName}`;
      this.logger.error(this.errorMessage, error.stack);
      throw new InternalServerErrorException(this.errorMessage);
    }
  }

  async createMany(
    createDtos: DeepPartial<T>[],
    manager?: EntityManager,
  ): Promise<T[]> {
    try {
      const repo = this.getRepo(manager);
      const entities = repo.create(createDtos);
      return await repo.save(entities);
    } catch (error) {
      this.errorMessage = `Failed to create multiple ${this.entityName}s`;
      this.logger.error(this.errorMessage, error.stack);
      throw new InternalServerErrorException(this.errorMessage);
    }
  }

  async findOneBy(findOptions: FindOneOptions<T> = {}): Promise<T> {
    try {
      const entity = await this.repository.findOne(findOptions);
      if (!entity) {
        throw new NotFoundException(
          `${this.entityName} not found with the provided criteria`,
        );
      }
      return entity as T;
    } catch (error) {
      this.errorMessage = `Failed to find ${this.entityName}`;
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(this.errorMessage, error.stack);
      throw new InternalServerErrorException(this.errorMessage);
    }
  }

  async findOneOrNone(findOptions: FindOneOptions<T> = {}): Promise<T | null> {
    try {
      return await this.repository.findOne(findOptions);
    } catch (error) {
      this.errorMessage = `Failed to find ${this.entityName}`;
      if (error instanceof HttpException) throw error;
      this.logger.error(this.errorMessage, error.stack);
      throw new InternalServerErrorException(this.errorMessage);
    }
  }

  async findAll(findOptions: FindManyOptions<T> = {}): Promise<T[]> {
    try {
      return await this.repository.find(findOptions);
    } catch (error) {
      this.errorMessage = `Failed to find all ${this.entityName}s`;
      this.logger.error(this.errorMessage, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.errorMessage);
    }
  }

  async updateBy(
    findOptions: FindOneOptions<T> = {},
    updateDto: DeepPartial<T>,
    manager?: EntityManager,
  ): Promise<T[]> {
    try {
      const repo = this.getRepo(manager);
      const entities = await this.findAll(findOptions);

      for (const singleEntity of entities) {
        Object.assign(singleEntity, updateDto);
        await repo.save(singleEntity);
      }
      return entities;
    } catch (error) {
      this.errorMessage = `Failed to update ${this.entityName}s`;
      this.logger.error(this.errorMessage, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.errorMessage);
    }
  }

  async findAllAndCount(
    findOptions: FindManyOptions<T> = {},
  ): Promise<{ items: T[]; total: number }> {
    try {
      const [items, total] = await this.repository.findAndCount(findOptions);
      return { items, total };
    } catch (error) {
      this.errorMessage = `Failed to find all ${this.entityName}s`;
      this.logger.error(this.errorMessage, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(this.errorMessage);
    }
  }

  createQueryBuilder(alias: string): SelectQueryBuilder<T> {
    return this.repository.createQueryBuilder(alias);
  }

  async save(entity: T, manager?: EntityManager): Promise<T> {
    const repo = this.getRepo(manager);
    return await repo.save(entity);
  }

  async saveMany(entities: T[], manager?: EntityManager): Promise<T[]> {
    try {
      const repo = this.getRepo(manager);
      return await repo.save(entities);
    } catch (error) {
      this.errorMessage = `Failed to save multiple ${this.entityName}s`;
      this.logger.error(this.errorMessage, error.stack);
      throw new InternalServerErrorException(this.errorMessage);
    }
  }
}
