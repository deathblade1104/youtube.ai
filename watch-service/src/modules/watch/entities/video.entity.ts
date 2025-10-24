import { Column, Entity } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from '../../../database/postgres/abstract.entity';

@Entity(TableNames.VIDEOS)
export class Videos extends AbstractEntity<Videos> {
  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  user_id: number;

  @Column()
  key: string;
}
