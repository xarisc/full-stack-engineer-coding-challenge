import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogVersion } from './catalog-version.entity';
import { PositionSurcharge } from './position-surcharge.entity';

export enum PositionUnit {
  PIECE = 'piece',
  M2 = 'm2',
  METER = 'meter',
  HOUR = 'hour',
  FLAT = 'flat',
}

@Entity({ schema: 'pricing_service', name: 'pricing_positions' })
@Unique(['versionId', 'key'])
export class PricingPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @Column({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'varchar', length: 255 })
  unit: PositionUnit;

  @Column({ name: 'net_price_cents', type: 'integer' })
  netPriceCents: number;

  @Column({ name: 'vat_rate', type: 'numeric', precision: 5, scale: 4 })
  vatRate: number;

  @Column({ name: 'min_quantity', type: 'numeric', precision: 10, scale: 4, nullable: true })
  minQuantity: number | null;

  @Column({ name: 'max_quantity', type: 'numeric', precision: 10, scale: 4, nullable: true })
  maxQuantity: number | null;

  @Column({ name: 'trade_attributes', type: 'jsonb', default: {} })
  tradeAttributes: Record<string, unknown>;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => CatalogVersion, (v) => v.positions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: CatalogVersion;

  @OneToMany(() => PositionSurcharge, (s) => s.position, { cascade: true })
  surcharges: PositionSurcharge[];
}
