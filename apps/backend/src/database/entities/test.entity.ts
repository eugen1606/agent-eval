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
import { QuestionSet } from './question-set.entity';

@Entity('tests')
export class Test {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  flowId: string;

  @Column()
  basePath: string;

  @Column({ nullable: true })
  accessTokenId: string;

  @ManyToOne(() => AccessToken, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'accessTokenId' })
  accessToken: AccessToken;

  @Column({ nullable: true })
  questionSetId: string;

  @ManyToOne(() => QuestionSet, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'questionSetId' })
  questionSet: QuestionSet;

  @Column({ default: false })
  multiStepEvaluation: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
