export enum UserRole {
  ADMIN = 'ADMIN',
  CRAFTSMAN = 'CRAFTSMAN',
}

export interface JwtPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  /**
   * Present only for CRAFTSMAN tokens. Bind row-level access to this craftsman.
   */
  craftsmanId?: string | null;
  iat?: number;
  exp?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Trade categories used in seed data. Add new values via migration + seed, not
 * via code branches.
 */
export const TRADE_CODES = ['HVAC', 'SOLAR', 'WINDOWS', 'INSULATION', 'ROOFING'] as const;
export type TradeCode = (typeof TRADE_CODES)[number];

export type PricingSchemaFieldType = 'string' | 'number' | 'boolean' | 'enum';

export interface PricingSchemaField {
  name: string;
  type: PricingSchemaFieldType;
  required: boolean;
  min?: number; // for number type
  max?: number; // for number type
  allowedValues?: string[]; // for enum type
  dependsOn?: {
    field: string;
    equals: string | number | boolean;
  };
}

export interface PricingSchema {
  fields: PricingSchemaField[];
}
