import { MatchFieldsDto } from '../opensearch.interface';

export interface QueryComponent {
  apply(query: {
    bool: {
      must: MatchFieldsDto[];
      filter: any[];
      must_not: any[];
      should: any[];
    };
  }): void;
}
