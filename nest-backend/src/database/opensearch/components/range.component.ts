import { IOpenSearchRangeFilterOptions } from '../opensearch.interface';
import { QueryComponent } from './base-query.component';

export class RangeQueryComponent implements QueryComponent {
  constructor(
    private field: string,
    private range: IOpenSearchRangeFilterOptions,
  ) {}

  apply(query: { bool: { filter: any[] } }) {
    query.bool.filter.push({
      range: {
        [this.field]: this.range,
      },
    });
  }
}
