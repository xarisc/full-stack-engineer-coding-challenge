import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CatalogVersion } from './catalog-version.entity';

export enum DiscountType {
  FLAT = 'flat',
  PERCENTAGE = 'percentage',
}

@Entity({ schema: 'pricing_service', name: 'catalog_discounts' })
@Unique(['versionId', 'key'])
export class CatalogDiscount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @Column({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'varchar', length: 20 })
  type: DiscountType;

  @Column({ name: 'value_cents', type: 'integer', nullable: true })
  valueCents: number | null;

  @Column({ type: 'numeric', precision: 8, scale: 4, nullable: true })
  percentage: number | null;

  @Column({ name: 'cap_cents', type: 'integer', nullable: true })
  capCents: number | null;

  @Column({ name: 'applies_to_type', type: 'varchar', length: 20 })
  appliesToType: string;

  @Column({ name: 'position_keys', type: 'jsonb', nullable: true })
  positionKeys: string[] | null;

  @Column({ name: 'sort_order', type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => CatalogVersion, (v) => v.discounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'version_id' })
  version: CatalogVersion;
}
