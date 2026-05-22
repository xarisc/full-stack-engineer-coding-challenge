import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PricingPosition } from './pricing-position.entity';

export enum SurchargeType {
  FLAT = 'flat',
  PERCENTAGE = 'percentage',
}

@Entity({ schema: 'pricing_service', name: 'position_surcharges' })
@Unique(['positionId', 'key'])
export class PositionSurcharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'position_id', type: 'uuid' })
  positionId: string;

  @Column({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'varchar', length: 20 })
  type: SurchargeType;

  @Column({ name: 'value_cents', type: 'integer', nullable: true })
  valueCents: number | null;

  @Column({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  percentage: number | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => PricingPosition, (p) => p.surcharges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'position_id' })
  position: PricingPosition;
}
