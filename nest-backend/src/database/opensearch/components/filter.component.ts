import { QueryComponent } from './base-query.component';

export class FilterComponent implements QueryComponent {
  constructor(private term: Record<string, any>) {}

  apply(query: { bool: { filter: any[] } }) {
    const value = Object.values(this.term)[0];
    const key = Object.keys(this.term)[0];
    if (Array.isArray(value)) {
      query.bool.filter.push({ terms: { [key]: value } });
    } else {
      query.bool.filter.push({ term: this.term });
    }
  }
}
