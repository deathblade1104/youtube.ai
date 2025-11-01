// Default geo search distance in km
const defaultBuildingSearchGeoDistance = 10;
import { GeoSearchQueryComponentOptions } from '../opensearch.interface';
import { QueryComponent } from './base-query.component';

export class GeoSearchQueryComponent implements QueryComponent {
  private latitude: number;
  private longitude: number;
  private distance: number;

  constructor({
    latitude,
    longitude,
    distance = defaultBuildingSearchGeoDistance,
  }: GeoSearchQueryComponentOptions) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.distance = distance;
  }

  apply(query: { bool: { filter: any[] } }) {
    query.bool.filter.push({
      geo_distance: {
        distance: `${this.distance}km`,
        coordinates: `${this.latitude},${this.longitude}`,
      },
    });
  }
}
