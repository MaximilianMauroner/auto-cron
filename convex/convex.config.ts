import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import autumn from "@useautumn/convex/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(autumn);
app.use(workOSAuthKit);

export default app;
