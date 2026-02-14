import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Test } from './test.entity';
import { Persona } from './persona.entity';

@Entity('scenarios')
export class Scenario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  testId: string;

  @ManyToOne(() => Test, (test) => test.scenarios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'testId' })
  test: Test;

  @Column({ type: 'uuid', nullable: true })
  personaId: string;

  @ManyToOne(() => Persona, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'personaId' })
  persona: Persona;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text' })
  goal: string;

  @Column({ type: 'int', default: 30 })
  maxTurns: number;

  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
