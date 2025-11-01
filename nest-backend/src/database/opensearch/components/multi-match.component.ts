import { MatchFieldsDto } from '../opensearch.interface';
import { QueryComponent } from './base-query.component';

export class MultiMatchComponent implements QueryComponent {
  constructor(private readonly matchFieldDto: MatchFieldsDto) {}

  apply(query: { bool: { must: any[] } }) {
    const searchQueryPayload: MatchFieldsDto = {
      fields: this.matchFieldDto.fields,
      query: this.matchFieldDto.query,
    };

    if (this.matchFieldDto.type) {
      searchQueryPayload.type = this.matchFieldDto.type;
    }

    if (this.matchFieldDto.fuzziness) {
      searchQueryPayload.fuzziness = this.matchFieldDto.fuzziness;
    }

    query.bool.must.push({
      multi_match: searchQueryPayload,
    });
  }
}
