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
 * Schema for a field declaration in table/tableextension
 */
export const ALFieldSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  dataType: z.string().min(1),
  lineNumber: z.number().int().positive(),
  filePath: z.string().min(1),
});

/**
 * Schema for an enum value declaration in enum/enumextension
 */
export const ALEnumValueSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  lineNumber: z.number().int().positive(),
  filePath: z.string().min(1),
});

/**
 * Schema for extended AL object with fields/values
 */
export const ALObjectWithFieldsSchema = ALObjectSchema.extend({
  extendsObject: z.string().optional(),
  fields: z.array(ALFieldSchema).optional(),
  enumValues: z.array(ALEnumValueSchema).optional(),
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
  content: string,
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
  obj: unknown,
): z.infer<typeof ALObjectSchema> | null {
  try {
    return ALObjectSchema.parse(obj);
  } catch {
    return null;
  }
}

/**
 * Validate an AL field
 */
export function validateALField(
  field: unknown,
): z.infer<typeof ALFieldSchema> | null {
  try {
    return ALFieldSchema.parse(field);
  } catch {
    return null;
  }
}

/**
 * Validate an AL enum value
 */
export function validateALEnumValue(
  value: unknown,
): z.infer<typeof ALEnumValueSchema> | null {
  try {
    return ALEnumValueSchema.parse(value);
  } catch {
    return null;
  }
}

export type ValidatedAppJson = z.infer<typeof AppJsonSchema>;
export type ValidatedALObject = z.infer<typeof ALObjectSchema>;
export type ValidatedALProject = z.infer<typeof ALProjectSchema>;
export type ValidatedALField = z.infer<typeof ALFieldSchema>;
export type ValidatedALEnumValue = z.infer<typeof ALEnumValueSchema>;
export type ValidatedALObjectWithFields = z.infer<
  typeof ALObjectWithFieldsSchema
>;
