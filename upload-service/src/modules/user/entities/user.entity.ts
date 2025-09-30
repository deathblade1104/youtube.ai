import { Column, Entity, Index } from 'typeorm';
import { TableNames } from '../../../common/enums/entities.enums';
import { AbstractEntity } from '../../../database/postgres/abstract.entity';

@Entity(TableNames.USERS)
export class User extends AbstractEntity<User> {
  @Column()
  name: string;

  @Index('uq_users_email', { unique: true })
  @Column()
  email: string;

  @Column()
  password_hash: string;
}
