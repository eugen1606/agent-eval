import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { AccessToken } from './access-token.entity';

@Entity('evaluators')
export class Evaluator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  accessTokenId: string;

  @ManyToOne(() => AccessToken, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'accessTokenId' })
  accessToken: AccessToken;

  @Column()
  model: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ default: false })
  reasoningModel: boolean;

  @Column({ nullable: true })
  reasoningEffort: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
