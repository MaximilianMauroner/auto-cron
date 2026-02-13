import { convexTest } from "convex-test";
import schema from "../../convex/schema";

const modules = import.meta.glob([
	"../../convex/**/*.ts",
	"../../convex/**/*.js",
	"!../../convex/**/*.test.ts",
	"!../../convex/**/*.d.ts",
]);

export const createTestConvex = () => convexTest(schema, modules);
export { schema };
