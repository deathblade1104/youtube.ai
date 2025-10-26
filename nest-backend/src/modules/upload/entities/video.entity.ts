import { Column, Entity } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from '../../../database/postgres/abstract.entity';

@Entity(TableNames.VIDEOS)
export class Videos extends AbstractEntity<Videos> {
  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false })
  description: string;

  @Column({ nullable: false })
  user_id: number;

  @Column({ nullable: false })
  user_name: string;

  @Column({ nullable: false })
  key: string;
}
