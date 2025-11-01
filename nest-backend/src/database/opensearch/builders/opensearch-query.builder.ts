import { MatchFieldsDto } from '../opensearch.interface';
import { QueryComponent } from '../components/base-query.component';

export class OpenSearchQueryBuilder {
  private query: {
    bool: {
      must: MatchFieldsDto[];
      filter: any[];
      must_not: any[];
      should: any[];
    };
  } = {
    bool: { must: [], filter: [], must_not: [], should: [] },
  };

  private components: QueryComponent[] = [];

  addComponent(component: QueryComponent) {
    this.components.push(component);
    return this;
  }

  build() {
    this.components.forEach((component) => component.apply(this.query));
    return this.query;
  }
}
