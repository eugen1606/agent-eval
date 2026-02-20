import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { User } from './user.entity';
import { AccessToken } from './access-token.entity';
import { QuestionSet } from './question-set.entity';
import { Webhook } from './webhook.entity';
import { FlowConfig } from './flow-config.entity';
import { Tag } from './tag.entity';
import { Evaluator } from './evaluator.entity';
import { Scenario } from './scenario.entity';

export type TestType = 'qa' | 'conversation';
export type ConversationExecutionMode = 'sequential' | 'parallel';

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

  @Column({ nullable: true })
  flowConfigId: string;

  @ManyToOne(() => FlowConfig, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'flowConfigId' })
  flowConfig: FlowConfig;

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

  @Column({ type: 'int', default: 1 })
  repeatCount: number;

  @Column({ nullable: true })
  webhookId: string;

  @ManyToOne(() => Webhook, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'webhookId' })
  webhook: Webhook;

  @Column({ nullable: true })
  evaluatorId: string;

  @ManyToOne(() => Evaluator, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'evaluatorId' })
  evaluator: Evaluator;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'test_tags',
    joinColumn: { name: 'testId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @Column({ default: 'qa' })
  type: TestType;

  @Column({ nullable: true })
  executionMode: ConversationExecutionMode;

  @Column({ type: 'int', nullable: true, default: 0 })
  delayBetweenTurns: number;

  @Column({ nullable: true })
  simulatedUserModel: string;

  @Column({ type: 'jsonb', nullable: true })
  simulatedUserModelConfig: { temperature?: number; maxTokens?: number };

  @Column({ nullable: true })
  simulatedUserAccessTokenId: string;

  @ManyToOne(() => AccessToken, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'simulatedUserAccessTokenId' })
  simulatedUserAccessToken: AccessToken;

  @Column({ default: false })
  simulatedUserReasoningModel: boolean;

  @Column({ nullable: true })
  simulatedUserReasoningEffort: string;

  @Column({ nullable: true })
  responseVariableKey: string;

  @OneToMany(() => Scenario, (scenario) => scenario.test, { cascade: true })
  scenarios: Scenario[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
