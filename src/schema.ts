import { z } from "zod";

// TODO: Port every interface from yc_company.d.ts into zod objects below.
// Carry each existing JSDoc comment over as a `.describe("...")` call on the
// corresponding zod field/object so the semantic context isn't lost.
//
// Interfaces to port, in order: YcSeed, Scenario, Source, Justification,
// DatabaseMigration, Hosting, ComponentSource, DataShape (as a z.enum),
// Provenance, and the top-level StartupDatasetSchema.
//
// Once this is done, delete yc_company.d.ts — this file becomes the single
// source of truth, with types derived via z.infer (see the export below).

export const startupDatasetSchema = z.object({});

export type StartupDatasetSchema = z.infer<typeof startupDatasetSchema>;
