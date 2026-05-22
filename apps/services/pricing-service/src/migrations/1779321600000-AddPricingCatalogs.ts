import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPricingCatalogs1779321600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // add field catalog_versions to trade_configs
    await queryRunner.addColumn(
      'pricing_service.trade_configs',
      new TableColumn({
        name: 'pricing_schema',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    // create table catalog_versions
    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.catalog_versions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'craftsman_id', type: 'uuid' },
          { name: 'trade', type: 'varchar', length: '32' },
          { name: 'status', type: 'varchar', length: '20', default: "'DRAFT'" },
          { name: 'effective_from', type: 'timestamptz' },
          { name: 'published_by', type: 'varchar', length: '255', isNullable: true },
          { name: 'published_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
    );
    await queryRunner.createForeignKey(
      'pricing_service.catalog_versions',
      new TableForeignKey({
        columnNames: ['craftsman_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'pricing_service.craftsmen',
        onDelete: 'CASCADE',
      }),
    );

    // concurrency guard: partial index to ensure only one PUBLISHED version per craftsman and trade
    await queryRunner.createIndex(
      'pricing_service.catalog_versions',
      new TableIndex({
        name: 'uniq_one_published_per_craftsman_trade',
        columnNames: ['craftsman_id', 'trade'],
        isUnique: true,
        where: "status = 'PUBLISHED'",
      }),
    );

    // create table pricing_positions
    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.pricing_positions',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'version_id', type: 'uuid' },
          { name: 'key', type: 'varchar', length: '100' },
          { name: 'label', type: 'varchar', length: '255' },
          { name: 'unit', type: 'varchar', length: '20' },
          { name: 'net_price_cents', type: 'integer' },
          { name: 'vat_rate', type: 'numeric', precision: 10, scale: 4, isNullable: false },
          { name: 'min_quantity', type: 'numeric', precision: 10, scale: 4, isNullable: true },
          { name: 'max_quantity', type: 'numeric', precision: 10, scale: 4, isNullable: true },
          { name: 'trade_attributes', type: 'jsonb', default: "'{}'::jsonb" },
          { name: 'sort_order', type: 'integer', default: 0 },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [{ name: 'uniq_position_key_per_version', columnNames: ['version_id', 'key'] }],
      }),
    );
    await queryRunner.createForeignKey(
      'pricing_service.pricing_positions',
      new TableForeignKey({
        columnNames: ['version_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'pricing_service.catalog_versions',
        onDelete: 'CASCADE',
      }),
    );

    // create table position_surcharges
    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.position_surcharges',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'position_id', type: 'uuid' },
          { name: 'key', type: 'varchar', length: '100' },
          { name: 'label', type: 'varchar', length: '255' },
          { name: 'type', type: 'varchar', length: '20' },
          { name: 'value_cents', type: 'integer', isNullable: true },
          { name: 'percentage', type: 'numeric', precision: 8, scale: 4, isNullable: true },
          { name: 'sort_order', type: 'integer', default: 0 },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [{ name: 'uniq_surcharge_key_per_position', columnNames: ['position_id', 'key'] }],
      }),
    );
    await queryRunner.createForeignKey(
      'pricing_service.position_surcharges',
      new TableForeignKey({
        columnNames: ['position_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'pricing_service.pricing_positions',
        onDelete: 'CASCADE',
      }),
    );

    // create table catalog_discounts
    await queryRunner.createTable(
      new Table({
        name: 'pricing_service.catalog_discounts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'version_id', type: 'uuid' },
          { name: 'key', type: 'varchar', length: '100' },
          { name: 'label', type: 'varchar', length: '255' },
          { name: 'type', type: 'varchar', length: '20' },
          { name: 'value_cents', type: 'integer', isNullable: true },
          { name: 'percentage', type: 'numeric', precision: 8, scale: 4, isNullable: true },
          { name: 'applies_to_type', type: 'varchar', length: '20' },
          { name: 'position_keys', type: 'jsonb', isNullable: true },
          { name: 'cap_cents', type: 'integer', isNullable: true },
          { name: 'sort_order', type: 'integer', default: 0 },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [{ name: 'uniq_discount_key_per_version', columnNames: ['version_id', 'key'] }],
      }),
    );
    await queryRunner.createForeignKey(
      'pricing_service.catalog_discounts',
      new TableForeignKey({
        columnNames: ['version_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'pricing_service.catalog_versions',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('pricing_service.catalog_discounts', true);
    await queryRunner.dropTable('pricing_service.position_surcharges', true);
    await queryRunner.dropTable('pricing_service.pricing_positions', true);
    await queryRunner.dropIndex(
      'pricing_service.catalog_versions',
      'uniq_one_published_per_craftsman_trade',
    );
    await queryRunner.dropTable('pricing_service.catalog_versions', true);
    await queryRunner.dropColumn('pricing_service.trade_configs', 'pricing_schema');
  }
}
