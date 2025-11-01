import { matchClauses } from '../opensearch.constants';
import { QueryComponent } from './base-query.component';

export class MatchComponent implements QueryComponent {
  constructor(
    private match: Record<string, any>,
    private clauseType: matchClauses,
  ) {}

  apply(query: { bool: { must: any[]; should: any[]; must_not: any[] } }) {
    query.bool[this.clauseType].push({ match: this.match });
  }
}
