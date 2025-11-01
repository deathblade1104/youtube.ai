export enum OPENSEARCH_QUERY_TYPES {
  bestFields = 'best_fields',
  mostFields = 'most_fields',
  crossFields = 'cross_fields',
  phrase = 'phrase',
  phrasePrefix = 'phrase_prefix',
  boolPrefix = 'bool_prefix',
}

export enum matchClauses {
  term = 'term',
  match = 'match',
  queryString = 'query_string',
  must = 'must',
  mustNot = 'must_not',
  should = 'should',
}
