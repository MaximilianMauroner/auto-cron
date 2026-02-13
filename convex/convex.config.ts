import crons from "@convex-dev/crons/convex.config";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import autumn from "@useautumn/convex/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(autumn);
app.use(crons);
app.use(workOSAuthKit);

export default app;
