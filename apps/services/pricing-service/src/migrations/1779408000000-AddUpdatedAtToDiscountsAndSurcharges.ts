import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUpdatedAtToDiscountsAndSurcharges1779408000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'pricing_service.catalog_discounts',
      new TableColumn({ name: 'updated_at', type: 'timestamp with time zone', default: 'now()' }),
    );

    await queryRunner.addColumn(
      'pricing_service.position_surcharges',
      new TableColumn({ name: 'updated_at', type: 'timestamp with time zone', default: 'now()' }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('pricing_service.position_surcharges', 'updated_at');
    await queryRunner.dropColumn('pricing_service.catalog_discounts', 'updated_at');
  }
}
