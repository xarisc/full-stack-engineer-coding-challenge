// input types for quote calculation

export interface QuoteLineItem {
  positionKey: string;
  quantity: number;
  appliedSurchargeKeys?: string[];
}

export interface SurchargeData {
  key: string;
  label: string;
  type: 'flat' | 'percentage';
  valueCents: number | null; // nur bei type = 'flat'
  percentage: number | null; // z.B. 5.0000 = 5%, nur bei type = 'percentage'
}

export interface PositionData {
  key: string;
  label: string;
  unit: string;
  netPriceCents: number;
  vatRate: number; // z.B. 0.1900 = 19%
  minQuantity: number | null;
  maxQuantity: number | null;
  surcharges: SurchargeData[];
}

export interface DiscountData {
  key: string;
  label: string;
  type: 'flat' | 'percentage';
  valueCents: number | null;
  percentage: number | null; // z.B. 10.0000 = 10%
  capCents: number | null;
  appliesToType: 'subtotal' | 'positions';
  positionKeys?: string[] | null;
}

// output types for quote calculation

export interface AppliedSurcharge {
  key: string;
  label: string;
  amountCents: number;
}

export interface AppliedDiscount {
  key: string;
  label: string;
  amountCents: number;
}

export interface QuoteLineResult {
  positionKey: string;
  label: string;
  quantity: number;
  unit: string;
  netPriceCents: number;
  lineNetCents: number;
  surcharges: AppliedSurcharge[];
  surchargeTotalCents: number;
  lineTotalCents: number;
  vatRate: number;
  appliedDiscounts: AppliedDiscount[];
}

export interface VatGroup {
  vatRate: number;
  netCents: number;
  vatCents: number;
  grossCents: number;
}

export interface QuoteResult {
  lines: QuoteLineResult[];
  discounts: AppliedDiscount[];
  subtotalCents: number;
  totalDiscountCents: number;
  discountedNetCents: number;
  vatGroups: VatGroup[];
  totalNetCents: number;
  totalVatCents: number;
  totalGrossCents: number;
}

// helpers

// Half-up rounding to whole cents.
function roundHalfUp(value: number): number {
  return Math.round(value);
}

function buildLine(item: QuoteLineItem, pos: PositionData): QuoteLineResult {
  const lineNetCents = roundHalfUp(item.quantity * pos.netPriceCents);

  const surchargeMap = new Map(pos.surcharges.map((s) => [s.key, s]));
  const surcharges: AppliedSurcharge[] = (item.appliedSurchargeKeys ?? []).map((sk) => {
    const s = surchargeMap.get(sk)!;
    const amountCents =
      s.type === 'flat' ? s.valueCents! : roundHalfUp(lineNetCents * (s.percentage! / 100));
    return { key: s.key, label: s.label, amountCents };
  });

  const surchargeTotalCents = surcharges.reduce((sum, s) => sum + s.amountCents, 0);

  return {
    positionKey: item.positionKey,
    label: pos.label,
    quantity: item.quantity,
    unit: pos.unit,
    netPriceCents: pos.netPriceCents,
    lineNetCents,
    surcharges,
    surchargeTotalCents,
    lineTotalCents: lineNetCents + surchargeTotalCents,
    vatRate: pos.vatRate,
    appliedDiscounts: [],
  };
}

function applyDiscounts(
  discounts: DiscountData[],
  lines: QuoteLineResult[],
  subtotalCents: number,
): { appliedDiscounts: AppliedDiscount[]; totalDiscountCents: number } {
  const appliedDiscounts: AppliedDiscount[] = discounts.map((d) => {
    const base =
      d.appliesToType === 'subtotal'
        ? subtotalCents
        : lines
            .filter((l) => (d.positionKeys ?? []).includes(l.positionKey))
            .reduce((sum, l) => sum + l.lineTotalCents, 0);

    let amountCents = d.type === 'flat' ? d.valueCents! : roundHalfUp(base * (d.percentage! / 100));

    if (d.capCents !== null) {
      amountCents = Math.min(amountCents, d.capCents);
    }

    return { key: d.key, label: d.label, amountCents };
  });

  const totalDiscountCents = appliedDiscounts.reduce((sum, d) => sum + d.amountCents, 0);
  return { appliedDiscounts, totalDiscountCents };
}

function buildVatGroups(
  lines: QuoteLineResult[],
  subtotalCents: number,
  discountedNetCents: number,
): VatGroup[] {
  if (lines.length === 0) return [];

  const groupMap = new Map<number, number>();
  for (const line of lines) {
    groupMap.set(line.vatRate, (groupMap.get(line.vatRate) ?? 0) + line.lineTotalCents);
  }

  const entries = [...groupMap.entries()];
  const totalDiscountCents = subtotalCents - discountedNetCents;
  let remainingDiscount = totalDiscountCents;

  return entries.map(([vatRate, groupNetBeforeDiscount], i) => {
    const isLast = i === entries.length - 1;
    // Distribute discount proportionally; last group absorbs rounding remainder
    const groupDiscount =
      subtotalCents === 0 || isLast
        ? remainingDiscount
        : roundHalfUp(totalDiscountCents * (groupNetBeforeDiscount / subtotalCents));

    remainingDiscount -= groupDiscount;

    const netCents = groupNetBeforeDiscount - groupDiscount;
    const vatCents = roundHalfUp(netCents * vatRate);
    return { vatRate, netCents, vatCents, grossCents: netCents + vatCents };
  });
}

// main export

export function calculateQuote(
  lineItems: QuoteLineItem[],
  positions: PositionData[],
  discounts: DiscountData[],
): QuoteResult {
  const positionMap = new Map(positions.map((p) => [p.key, p]));

  // Validate all inputs before computing anything
  for (const item of lineItems) {
    const pos = positionMap.get(item.positionKey);
    if (!pos) {
      throw new Error(`Unknown position key: '${item.positionKey}'`);
    }
    if (pos.minQuantity !== null && item.quantity < pos.minQuantity) {
      throw new Error(
        `Quantity ${item.quantity} is below minimum ${pos.minQuantity} for position '${item.positionKey}'`,
      );
    }
    if (pos.maxQuantity !== null && item.quantity > pos.maxQuantity) {
      throw new Error(
        `Quantity ${item.quantity} exceeds maximum ${pos.maxQuantity} for position '${item.positionKey}'`,
      );
    }
    const declaredSurchargeKeys = new Set(pos.surcharges.map((s) => s.key));
    for (const sk of item.appliedSurchargeKeys ?? []) {
      if (!declaredSurchargeKeys.has(sk)) {
        throw new Error(`Surcharge key '${sk}' is not declared on position '${item.positionKey}'`);
      }
    }
  }

  const lines = lineItems.map((item) => buildLine(item, positionMap.get(item.positionKey)!));
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);

  const { appliedDiscounts, totalDiscountCents } = applyDiscounts(discounts, lines, subtotalCents);
  const discountedNetCents = subtotalCents - totalDiscountCents;

  // Enrich each line with the position-specific discounts that applied to it.
  // Subtotal-level discounts stay at catalog level only (result.discounts).
  const enrichedLines = lines.map((line) => ({
    ...line,
    appliedDiscounts: appliedDiscounts.filter((ad) => {
      const d = discounts.find((dd) => dd.key === ad.key);
      return d?.appliesToType === 'positions' && (d.positionKeys ?? []).includes(line.positionKey);
    }),
  }));

  const vatGroups = buildVatGroups(lines, subtotalCents, discountedNetCents);
  const totalNetCents = vatGroups.reduce((sum, g) => sum + g.netCents, 0);
  const totalVatCents = vatGroups.reduce((sum, g) => sum + g.vatCents, 0);
  const totalGrossCents = vatGroups.reduce((sum, g) => sum + g.grossCents, 0);

  return {
    lines: enrichedLines,
    discounts: appliedDiscounts,
    subtotalCents,
    totalDiscountCents,
    discountedNetCents,
    vatGroups,
    totalNetCents,
    totalVatCents,
    totalGrossCents,
  };
}
