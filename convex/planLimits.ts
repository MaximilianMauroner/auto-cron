import type { ProductId } from "./types/root";

export type { ProductId } from "./types/root";

export const VALID_PRODUCT_IDS = ["free", "basic", "plus", "pro"] as const;

const PLAN_HORIZON_WEEKS: Record<ProductId, number> = {
	free: 1,
	basic: 4,
	plus: 8,
	pro: 12,
};

const LEGACY_MAX_HORIZON_WEEKS = 12;

export const getMaxHorizonWeeks = (productId: string | undefined): number => {
	if (!productId) return LEGACY_MAX_HORIZON_WEEKS;
	return PLAN_HORIZON_WEEKS[productId as ProductId] ?? LEGACY_MAX_HORIZON_WEEKS;
};

export const getMaxHorizonDays = (productId: string | undefined): number =>
	getMaxHorizonWeeks(productId) * 7;

export const isValidProductId = (id: string): id is ProductId =>
	VALID_PRODUCT_IDS.includes(id as ProductId);
