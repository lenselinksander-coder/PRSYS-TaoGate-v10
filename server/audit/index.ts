// server/audit/index.ts
//
// Publieke API van het audit-subsysteem.
// Importeer vanuit andere subsystemen altijd via deze index:
//   import { appendWormEntry, auditLog } from "../audit"
//
// Directe imports van wormChain.ts zijn alleen toegestaan
// vanuit server/ rootniveau (routes.ts, storage.ts).

export {
  appendWormEntry,
  auditLog,
  initWormChain,
} from "./wormChain";

export type {
  WormEntry,
  AppendWormParams,
  AuditLogParams,
} from "./wormChain";
