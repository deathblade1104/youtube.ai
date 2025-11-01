import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

// Temporary interfaces until common modules are available
export interface MatchFieldsDto {
  query: string;
  fields: string[];
  type?: string;
  fuzziness?: string | number;
}

export enum Direction {
  NEXT = 'next',
  PREV = 'prev',
}

export type AnyPrimitiveType = string | number | boolean | null;
export type SortType = 'asc' | 'desc';

export interface FilterQuery {
  term?: Record<string, any>;
}

export interface ISearchIndex {
  searchIndex: string;
}
export interface IOpenSearchFindOptions {
  direction?: Direction;
  size?: number;
  searchAfter?: string;
  query?: Record<string, any>;
  sort?: Record<string, any>[];
  script_fields?: Record<string, any>;
}

export interface IOpenSearchFindByIdOptions {
  id: string;
  searchIndex: string;
}

export class IOpenSearchRangeFilterOptions {
  @ApiPropertyOptional({ description: 'Minimum number' })
  @IsOptional()
  @IsNumber()
  gte?: number;

  @ApiPropertyOptional({ description: 'Maximum number' })
  @IsOptional()
  @IsNumber()
  lte?: number;

  // At least one of gte or lte must be provided
  // Validation is handled manually where this DTO is used
}

export interface IOpenSearchBulkIndexOptions<T> {
  index: string;
  docs: { id: string; body: T }[];
}
export interface IOpenSearchResponse<T> {
  data: T[];
  total: number;
}

export interface GeoSearchQueryComponentOptions {
  latitude: number;
  longitude: number;
  distance: number;
}

export interface IOpenSearchQuery {
  multiMatch?: MatchFieldsDto[];
  mustMatchKeywords?: Record<string, AnyPrimitiveType>[];
  mustNotMatchKeywords?: Record<string, AnyPrimitiveType>[];
  shouldMatchKeywords?: Record<string, AnyPrimitiveType>[];
  terms?: Record<string, any>;
  filters?: FilterQuery[];
  rangeFilters?: Array<{
    field: string;
    range: { gte?: number; lte?: number };
  }>;
  geoLocation?: GeoSearchQueryComponentOptions;
}
export interface IOpenSearchFilterBody {
  query?: Record<string, any>;
  sort: Record<string, SortType>[];
  search_after?: [string];
  size: number;
  script_fields: Record<string, any>;
  _source: boolean;
}

export interface IOpenSearchUpdateDocOptions<T> {
  index: string;
  id: string;
  body: { doc: T };
}
