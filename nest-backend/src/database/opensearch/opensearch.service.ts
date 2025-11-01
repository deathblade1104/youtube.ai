import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OpenSearchQueryBuilder } from './builders/opensearch-query.builder';
import {
  FilterComponent,
  GeoSearchQueryComponent,
  MatchComponent,
  MultiMatchComponent,
  RangeQueryComponent,
} from './components';
import { matchClauses } from './opensearch.constants';
import {
  IOpenSearchBulkIndexOptions,
  IOpenSearchFilterBody,
  IOpenSearchFindByIdOptions,
  IOpenSearchFindOptions,
  IOpenSearchQuery,
  IOpenSearchResponse,
  IOpenSearchUpdateDocOptions,
  ISearchIndex,
} from './opensearch.interface';
// Temporary constants until common modules are available
const ENV = process.env.NODE_ENV || 'development';

// For now, skip product-specific methods

@Injectable()
export class OpensearchService {
  private readonly logger = new Logger(OpensearchService.name);
  constructor(
    @Inject('OPENSEARCH_CLIENT') private readonly searchClient: Client,
  ) {}
  queryBuilder(queryInput: IOpenSearchQuery): {
    bool: { must: any[]; filter: any[]; must_not: any[]; should: any[] };
  } {
    const {
      multiMatch,
      mustMatchKeywords,
      mustNotMatchKeywords,
      shouldMatchKeywords,
      terms,
      rangeFilters,
      geoLocation,
      filters,
    } = queryInput;

    const queryBuilder = new OpenSearchQueryBuilder();

    // Add Multi-Match Queries
    if (multiMatch) {
      multiMatch.forEach((match) => {
        queryBuilder.addComponent(new MultiMatchComponent(match));
      });
    }

    // Add Must-Match Queries
    if (mustMatchKeywords) {
      mustMatchKeywords.forEach((keyword) =>
        queryBuilder.addComponent(
          new MatchComponent(keyword, matchClauses.must),
        ),
      );
    }

    // Add Must-Not-Match Queries
    if (mustNotMatchKeywords) {
      mustNotMatchKeywords.forEach((keyword) =>
        queryBuilder.addComponent(
          new MatchComponent(keyword, matchClauses.mustNot),
        ),
      );
    }

    // Add Should-Match Queries
    if (shouldMatchKeywords) {
      shouldMatchKeywords.forEach((keyword) =>
        queryBuilder.addComponent(
          new MatchComponent(keyword, matchClauses.should),
        ),
      );
    }

    // Add Terms Filters
    if (terms) {
      Object.entries(terms).forEach(([key, value]) =>
        queryBuilder.addComponent(new FilterComponent({ [key]: value })),
      );
    }

    // Add Range Filters
    if (rangeFilters) {
      rangeFilters.forEach(({ field, range }) =>
        queryBuilder.addComponent(new RangeQueryComponent(field, range)),
      );
    }

    // Add Geo-Location Filter
    if (geoLocation && geoLocation.latitude && geoLocation.longitude) {
      queryBuilder.addComponent(new GeoSearchQueryComponent(geoLocation));
    }

    if (filters?.length) {
      filters.forEach((filter) => {
        // Each filter should be added directly as a component
        queryBuilder.addComponent(new FilterComponent(filter.term));
      });
    }

    const queryRes = queryBuilder.build();
    return queryRes;
  }
  async fetchDocs<T>({
    searchIndex,
    size,
    query,
    sort,
    searchAfter,
    script_fields,
  }: IOpenSearchFindOptions & ISearchIndex): Promise<IOpenSearchResponse<T>> {
    try {
      const body: IOpenSearchFilterBody = {
        query,
        sort,
        size,
        script_fields,
        _source: true,
      };

      if (searchAfter) {
        body.search_after = [searchAfter];
      }

      const { body: results } = await this.searchClient.search({
        index: searchIndex,
        body,
      });

      // Handle total which can be number or TotalHits object
      const total =
        typeof results?.hits?.total === 'number'
          ? results.hits.total
          : results?.hits?.total?.value || 0;

      return {
        data:
          results?.hits?.hits?.map((hit) => ({
            ...(hit?._source as T),
            ...hit?.fields,
            _id: hit._id as string,
          })) || [],
        total,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error occurred while fetching records from index ${searchIndex}`,
        error,
      );
      throw error;
    }
  }
  async findDocById<T>({ id, searchIndex }: IOpenSearchFindByIdOptions) {
    try {
      const { body: results } = await this.searchClient.get({
        index: searchIndex,
        id,
      });
      if (!results._source) {
        this.logger.error(`${searchIndex} with id ${id} not found`);
        throw new NotFoundException();
      }
      const data = { ...(results._source as T) };
      return { id, ...data };
    } catch (error) {
      if (error.statusCode === 404) {
        this.logger.error(`${searchIndex} with id ${id} not found`);
        throw new NotFoundException();
      }
      this.logger.error(
        `Error occurred while fetching records from index ${searchIndex} `,
        error,
      );
      throw error;
    }
  }

  async findDocsByIds<T>({
    ids,
    searchIndex,
  }: {
    ids: string[];
    searchIndex: string;
  }) {
    try {
      const { body: results } = await this.searchClient.mget({
        index: searchIndex,
        body: {
          ids,
        },
      });
      if (!results.docs?.length) {
        this.logger.error(
          `No documents found in ${searchIndex} for ids ${ids.join(', ')}`,
        );
        return [];
      }

      return results.docs
        .filter((doc: any) => doc._source && !doc.error)
        .map((doc: any) => ({
          id: doc._id,
          ...(doc._source as T),
        }));
    } catch (error) {
      this.logger.error(
        `Error occurred while fetching multiple records from index ${searchIndex} for ids ${ids.join(', ')}`,
      );
      this.logger.error(error.stack);
      throw error;
    }
  }
  async bulkCreateDocs<T>({
    index,
    docs,
  }: IOpenSearchBulkIndexOptions<T>): Promise<boolean> {
    try {
      const body = docs.flatMap((doc) => [
        { index: { _index: index, _id: doc.id } },
        doc.body,
      ]);
      await this.searchClient.bulk({
        refresh: true,
        body,
      });
      return true;
    } catch (error) {
      this.logger.error('Error bulk indexing documents:', error);
      return false;
    }
  }
  async updateDoc<T>({
    index,
    id,
    body,
  }: IOpenSearchUpdateDocOptions<T>): Promise<boolean> {
    try {
      await this.searchClient.update({
        index,
        id,
        body,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Error updating document in index ${index} with id ${id}`,
        error,
      );
      return false;
    }
  }
  async bulkUpdateDocuments<T>(
    index: string,
    ids: string[],
    updates: Partial<T>,
  ): Promise<boolean> {
    try {
      const body = ids.flatMap((id) => [
        { update: { _id: id } },
        { doc: updates },
      ]);
      const { body: response } = await this.searchClient.bulk({
        index,
        body,
      });
      if (response.errors) {
        this.logger.error('Errors occurred during bulk update', response);
        return false;
      }
      this.logger.debug(
        `Successfully updated ${ids.length} documents in index ${index}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error bulk updating documents in index ${index}`,
        error,
      );
      return false;
    }
  }

  async createIndex({
    indexName,
    settings,
    mappings,
  }: {
    indexName: string;
    settings: Record<string, any>;
    mappings: Record<string, any>;
  }): Promise<boolean> {
    try {
      const { body: exists } = await this.searchClient.indices.exists({
        index: indexName,
      });

      if (exists) {
        this.logger.warn(`Index ${indexName} already exists.`);
        return false;
      }

      const response = await this.searchClient.indices.create({
        index: indexName,
        body: {
          settings,
          mappings,
        },
      });

      this.logger.log(`Index  ${indexName} creation Response: `);
      this.logger.log(response);
      return true;
    } catch (error) {
      this.logger.error(`Error creating index ${indexName}:`, error);
      return false;
    }
  }
}
