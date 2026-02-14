import React from "react";

import CheckoutDialog from "@/components/autumn/checkout-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getPricingTableContent } from "@/lib/autumn/pricing-table-content";
import { cn } from "@/lib/utils";
import type { Product, ProductItem } from "autumn-js";
import { type ProductDetails, useCustomer, usePricingTable } from "autumn-js/react";
import { useMutation } from "convex/react";
import { Check, Loader2 } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { api } from "../../../../convex/_generated/api";

export default function PricingTable({
	productDetails,
}: {
	productDetails?: ProductDetails[];
}) {
	const { customer, checkout } = useCustomer({ errorOnNotFound: false });
	const updateActiveProduct = useMutation(api.hours.mutations.updateActiveProduct);

	const [isAnnual, setIsAnnual] = useState(false);
	const { products, isLoading, error } = usePricingTable({ productDetails });

	if (isLoading) {
		return (
			<div className="w-full h-full flex justify-center items-center min-h-[300px]">
				<Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
			</div>
		);
	}

	if (error) {
		return <div>Something went wrong...</div>;
	}

	const intervals = Array.from(
		new Set(products?.map((p) => p.properties?.interval_group).filter((i) => !!i)),
	);

	const multiInterval = intervals.length > 1;

	const intervalFilter = (product: Product) => {
		if (!product.properties?.interval_group) {
			return true;
		}

		if (multiInterval) {
			if (isAnnual) {
				return product.properties?.interval_group === "year";
			}
			return product.properties?.interval_group === "month";
		}

		return true;
	};

	return (
		<div>
			{products && (
				<PricingTableContainer
					products={products}
					isAnnualToggle={isAnnual}
					setIsAnnualToggle={setIsAnnual}
					multiInterval={multiInterval}
				>
					{products.filter(intervalFilter).map((product, index) => (
						<PricingCard
							key={index}
							productId={product.id}
							buttonProps={{
								disabled:
									(product.scenario === "active" && !product.properties.updateable) ||
									product.scenario === "scheduled",

								onClick: async () => {
									if (product.id && customer) {
										await checkout({
											productId: product.id,
											dialog: CheckoutDialog,
										});
										try {
											await updateActiveProduct({ productId: product.id });
										} catch {
											// Best-effort sync; the backend still enforces limits
										}
									} else if (product.display?.button_url) {
										window.open(product.display?.button_url, "_blank");
									}
								},
							}}
						/>
					))}
				</PricingTableContainer>
			)}
		</div>
	);
}

const PricingTableContext = createContext<{
	isAnnualToggle: boolean;
	setIsAnnualToggle: (isAnnual: boolean) => void;
	products: Product[];
	showFeatures: boolean;
}>({
	isAnnualToggle: false,
	setIsAnnualToggle: () => {},
	products: [],
	showFeatures: true,
});

export const usePricingTableContext = (componentName: string) => {
	const context = useContext(PricingTableContext);

	if (context === undefined) {
		throw new Error(`${componentName} must be used within <PricingTable />`);
	}

	return context;
};

export const PricingTableContainer = ({
	children,
	products,
	showFeatures = true,
	className,
	isAnnualToggle,
	setIsAnnualToggle,
	multiInterval,
}: {
	children?: React.ReactNode;
	products?: Product[];
	showFeatures?: boolean;
	className?: string;
	isAnnualToggle: boolean;
	setIsAnnualToggle: (isAnnual: boolean) => void;
	multiInterval: boolean;
}) => {
	if (!products) {
		throw new Error("products is required in <PricingTable />");
	}

	if (products.length === 0) {
		return <></>;
	}

	return (
		<PricingTableContext.Provider
			value={{ isAnnualToggle, setIsAnnualToggle, products, showFeatures }}
		>
			<div className="flex items-center flex-col">
				{multiInterval && (
					<div className="mb-8">
						<AnnualSwitch isAnnualToggle={isAnnualToggle} setIsAnnualToggle={setIsAnnualToggle} />
					</div>
				)}
				<div className={cn("grid grid-cols-1 sm:grid-cols-2 w-full gap-4", className)}>
					{children}
				</div>
			</div>
		</PricingTableContext.Provider>
	);
};

interface PricingCardProps {
	productId: string;
	showFeatures?: boolean;
	className?: string;
	onButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	buttonProps?: React.ComponentProps<"button">;
}

export const PricingCard = ({ productId, className, buttonProps }: PricingCardProps) => {
	const { products, showFeatures } = usePricingTableContext("PricingCard");

	const product = products.find((p) => p.id === productId);

	if (!product) {
		throw new Error(`Product with id ${productId} not found`);
	}

	const { name, display: productDisplay } = product;

	const { buttonText } = getPricingTableContent(product);

	const isRecommended = !!productDisplay?.recommend_text;
	const isActive = product.scenario === "active";
	const mainPriceDisplay = product.properties?.is_free
		? {
				primary_text: "Free",
			}
		: product.items[0]?.display;

	const featureItems = product.properties?.is_free ? product.items : product.items.slice(1);

	return (
		<div
			className={cn(
				"relative flex flex-col rounded-lg border bg-card text-card-foreground transition-shadow",
				isActive
					? "ring-2 ring-primary shadow-md"
					: isRecommended
						? "ring-2 ring-accent shadow-md shadow-accent/10"
						: "shadow-sm hover:shadow-md",
				className,
			)}
		>
			{isActive && (
				<div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
					<span className="inline-block rounded-full bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold whitespace-nowrap">
						Current Plan
					</span>
				</div>
			)}
			{!isActive && productDisplay?.recommend_text && (
				<div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
					<span className="inline-block rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground whitespace-nowrap">
						{productDisplay.recommend_text}
					</span>
				</div>
			)}

			<div className="flex flex-col flex-1 p-6 pt-5">
				{/* Plan name */}
				<h2 className="text-lg font-semibold">{productDisplay?.name || name}</h2>

				{/* Description */}
				{productDisplay?.description && (
					<p className="mt-1 text-sm text-muted-foreground leading-snug">
						{productDisplay.description}
					</p>
				)}

				{/* Price */}
				<div className="mt-4 mb-5 flex items-baseline gap-1.5">
					<span className="text-2xl font-bold tracking-tight">
						{mainPriceDisplay?.primary_text}
					</span>
					{mainPriceDisplay?.secondary_text && (
						<span className="text-sm text-muted-foreground">{mainPriceDisplay.secondary_text}</span>
					)}
				</div>

				{/* Divider */}
				<div className="h-px bg-border mb-5" />

				{/* Features */}
				{showFeatures && featureItems.length > 0 && (
					<div className="flex-1 mb-6">
						<PricingFeatureList
							items={featureItems}
							everythingFrom={product.display?.everything_from}
							recommended={isRecommended}
						/>
					</div>
				)}

				{/* Button */}
				<div className="mt-auto">
					<PricingCardButton recommended={isRecommended} {...buttonProps}>
						{productDisplay?.button_text || buttonText}
					</PricingCardButton>
				</div>
			</div>
		</div>
	);
};

// Pricing Feature List
export const PricingFeatureList = ({
	items,
	everythingFrom,
	className,
	recommended,
}: {
	items: ProductItem[];
	everythingFrom?: string;
	className?: string;
	recommended?: boolean;
}) => {
	return (
		<div className={cn("flex-grow", className)}>
			{everythingFrom && (
				<p className="text-sm text-muted-foreground mb-3">
					Everything from {everythingFrom}, plus:
				</p>
			)}
			<ul className="space-y-2.5">
				{items.map((item, index) => (
					<li key={index} className="flex items-start gap-2.5 text-sm">
						<Check
							className={cn(
								"h-4 w-4 flex-shrink-0 mt-0.5",
								recommended ? "text-accent" : "text-muted-foreground",
							)}
							strokeWidth={2.5}
						/>
						<div className="flex flex-col">
							<span className="leading-snug">{item.display?.primary_text}</span>
							{item.display?.secondary_text && (
								<span className="text-xs text-muted-foreground">{item.display.secondary_text}</span>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
};

// Pricing Card Button
export interface PricingCardButtonProps extends React.ComponentProps<"button"> {
	recommended?: boolean;
	buttonUrl?: string;
}

export const PricingCardButton = React.forwardRef<HTMLButtonElement, PricingCardButtonProps>(
	({ recommended, children, className, onClick, ...props }, ref) => {
		const [loading, setLoading] = useState(false);

		const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
			setLoading(true);
			try {
				await onClick?.(e);
			} catch (error) {
				console.error(error);
			} finally {
				setLoading(false);
			}
		};

		return (
			<Button
				className={cn(
					"w-full py-2.5 px-4 rounded-md font-medium transition-all duration-200",
					recommended && "bg-accent text-accent-foreground hover:bg-accent/90",
					className,
				)}
				{...props}
				variant={recommended ? "default" : "outline"}
				ref={ref}
				disabled={loading || props.disabled}
				onClick={handleClick}
			>
				{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
			</Button>
		);
	},
);
PricingCardButton.displayName = "PricingCardButton";

// Annual Switch
export const AnnualSwitch = ({
	isAnnualToggle,
	setIsAnnualToggle,
}: {
	isAnnualToggle: boolean;
	setIsAnnualToggle: (isAnnual: boolean) => void;
}) => {
	return (
		<div className="flex items-center space-x-2 mb-4">
			<span className="text-sm text-muted-foreground">Monthly</span>
			<Switch id="annual-billing" checked={isAnnualToggle} onCheckedChange={setIsAnnualToggle} />
			<span className="text-sm text-muted-foreground">Annual</span>
		</div>
	);
};
