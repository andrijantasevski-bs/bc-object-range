import { z } from "zod";

/**
 * Schema for ID range validation
 */
export const IdRangeSchema = z
  .object({
    from: z.number().int().positive(),
    to: z.number().int().positive(),
  })
  .refine((data) => data.to >= data.from, {
    message: "'to' must be greater than or equal to 'from'",
  });

/**
 * Schema for app.json validation
 */
export const AppJsonSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    publisher: z.string().min(1),
    version: z.string().min(1),
    idRanges: z.array(IdRangeSchema).optional(),
    idRange: IdRangeSchema.optional(),
  })
  .transform((data) => {
    // Normalize idRange to idRanges array
    const ranges = data.idRanges ?? (data.idRange ? [data.idRange] : []);
    return {
      id: data.id,
      name: data.name,
      publisher: data.publisher,
      version: data.version,
      idRanges: ranges,
    };
  });

/**
 * Schema for parsed AL object
 */
export const ALObjectSchema = z.object({
  type: z.enum([
    "table",
    "tableextension",
    "page",
    "pageextension",
    "report",
    "reportextension",
    "codeunit",
    "query",
    "xmlport",
    "enum",
    "enumextension",
    "permissionset",
    "permissionsetextension",
  ]),
  id: z.number().int().positive(),
  name: z.string().min(1),
  lineNumber: z.number().int().positive(),
  filePath: z.string().min(1),
});

/**
 * Schema for AL project
 */
export const ALProjectSchema = z.object({
  name: z.string().min(1),
  rootPath: z.string().min(1),
  idRanges: z.array(IdRangeSchema),
  objects: z.array(ALObjectSchema),
});

/**
 * Validate and parse app.json content
 */
export function parseAppJson(
  content: string
): z.infer<typeof AppJsonSchema> | null {
  try {
    const json = JSON.parse(content);
    return AppJsonSchema.parse(json);
  } catch {
    return null;
  }
}

/**
 * Validate an AL object
 */
export function validateALObject(
  obj: unknown
): z.infer<typeof ALObjectSchema> | null {
  try {
    return ALObjectSchema.parse(obj);
  } catch {
    return null;
  }
}

export type ValidatedAppJson = z.infer<typeof AppJsonSchema>;
export type ValidatedALObject = z.infer<typeof ALObjectSchema>;
export type ValidatedALProject = z.infer<typeof ALProjectSchema>;
