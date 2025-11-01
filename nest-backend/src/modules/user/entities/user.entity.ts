import { Column, Entity, Index } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from '../../../database/postgres/abstract.entity';

@Entity(TableNames.USERS)
@Index(['email'], {
  unique: true,
  where: 'is_active = true',
})
export class User extends AbstractEntity<User> {
  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  password_hash: string;

  @Column({ default: true })
  @Index()
  is_active: boolean;
}
