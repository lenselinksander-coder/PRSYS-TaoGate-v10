// server/middleware/index.ts
//
// Public API van de middleware laag.
//
// Importeer vanuit routes via:
//   import { testudoShield, testudoContentLengthGuard, testudoStatus } from "../middleware"
//
// Interne implementatiedetails (rate-buckets, validatielogica) zijn niet publiek.

/** Express middleware: blokkeer oversized requests vóór body-parse. */
export { testudoContentLengthGuard } from "./testudo";

/** Express middleware: rate limiting, security headers en input-sanitisation. */
export { testudoShield } from "./testudo";

/** Diagnostische snapshot van de Testudo-shield (versie, actieve buckets, limieten). */
export { testudoStatus } from "./testudo";
