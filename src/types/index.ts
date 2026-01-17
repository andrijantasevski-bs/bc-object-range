/**
 * Type definitions for AL objects in Business Central
 */

/**
 * AL object types that require a numeric ID
 */
export const AL_OBJECT_TYPES_WITH_ID = [
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
] as const;

/**
 * AL object types that don't require an ID (name-only)
 */
export const AL_OBJECT_TYPES_WITHOUT_ID = [
  "interface",
  "controladdin",
  "profile",
  "pagecustomization",
  "entitlement",
  "dotnet",
] as const;

export type ALObjectTypeWithId = (typeof AL_OBJECT_TYPES_WITH_ID)[number];
export type ALObjectTypeWithoutId = (typeof AL_OBJECT_TYPES_WITHOUT_ID)[number];
export type ALObjectType = ALObjectTypeWithId | ALObjectTypeWithoutId;

/**
 * Represents a parsed AL object with an ID
 */
export interface ALObject {
  /** The type of AL object (table, page, codeunit, etc.) */
  type: ALObjectTypeWithId;
  /** The numeric ID of the object */
  id: number;
  /** The name of the object */
  name: string;
  /** The line number where the object is declared (1-based) */
  lineNumber: number;
  /** The absolute file path where the object is defined */
  filePath: string;
}

/**
 * Represents an ID range as defined in app.json
 */
export interface IdRange {
  from: number;
  to: number;
}

/**
 * Represents app.json configuration
 */
export interface AppJson {
  id: string;
  name: string;
  publisher: string;
  version: string;
  idRanges?: IdRange[];
  /** Legacy single range support */
  idRange?: IdRange;
}

/**
 * Represents an AL project (app) in the workspace
 */
export interface ALProject {
  /** The name of the app from app.json */
  name: string;
  /** The root folder path of the project */
  rootPath: string;
  /** The configured ID ranges from app.json */
  idRanges: IdRange[];
  /** All parsed AL objects in this project */
  objects: ALObject[];
}

/**
 * Represents a gap (unused range) in object IDs
 */
export interface IdGap {
  /** Start of the unused range */
  start: number;
  /** End of the unused range (inclusive) */
  end: number;
  /** Number of available IDs in this gap */
  count: number;
  /** The project this gap belongs to */
  projectName: string;
  /** The project root path */
  projectPath: string;
}

/**
 * Groups AL objects by their type
 */
export interface ObjectsByType {
  [objectType: string]: ALObject[];
}

/**
 * Result of workspace analysis
 */
export interface WorkspaceAnalysis {
  /** All detected AL projects */
  projects: ALProject[];
  /** Timestamp of the analysis */
  timestamp: Date;
}

/**
 * Represents a gap in shared range mode (per object type)
 */
export interface SharedIdGap {
  /** Start of the unused range */
  start: number;
  /** End of the unused range (inclusive) */
  end: number;
  /** Number of available IDs in this gap */
  count: number;
  /** The object type this gap is for */
  objectType: ALObjectTypeWithId;
}

/**
 * Represents a conflict where the same ID+type is used in multiple projects
 */
export interface IdConflict {
  /** The conflicting ID */
  id: number;
  /** The object type */
  type: ALObjectTypeWithId;
  /** Objects from different projects using this ID */
  objects: ALObject[];
}

/**
 * Represents a field declaration inside a table or tableextension
 */
export interface ALField {
  /** The numeric ID of the field */
  id: number;
  /** The name of the field */
  name: string;
  /** The data type of the field */
  dataType: string;
  /** The line number where the field is declared (1-based) */
  lineNumber: number;
  /** The absolute file path where the field is defined */
  filePath: string;
}

/**
 * Represents an enum value declaration inside an enum or enumextension
 */
export interface ALEnumValue {
  /** The ordinal ID of the enum value */
  id: number;
  /** The name of the enum value */
  name: string;
  /** The line number where the value is declared (1-based) */
  lineNumber: number;
  /** The absolute file path where the value is defined */
  filePath: string;
}

/**
 * Extended AL object that includes fields (for table/tableextension) or values (for enum/enumextension)
 */
export interface ALObjectWithFields extends ALObject {
  /** For tableextension/enumextension: the name of the base object being extended */
  extendsObject?: string;
  /** Fields declared in this object (for table/tableextension) */
  fields?: ALField[];
  /** Values declared in this object (for enum/enumextension) */
  enumValues?: ALEnumValue[];
}

/**
 * Represents a field ID conflict where the same field ID is used in multiple
 * tableextensions extending the same base table
 */
export interface FieldConflict {
  /** The conflicting field ID */
  fieldId: number;
  /** The name of the base table being extended */
  baseTable: string;
  /** The fields from different extensions using this ID */
  fields: Array<
    ALField & {
      projectName: string;
      extensionId: number;
      extensionName: string;
    }
  >;
}

/**
 * Represents an enum value ID conflict where the same ordinal ID is used in multiple
 * enumextensions extending the same base enum
 */
export interface EnumValueConflict {
  /** The conflicting enum value ID */
  valueId: number;
  /** The name of the base enum being extended */
  baseEnum: string;
  /** The values from different extensions using this ID */
  values: Array<
    ALEnumValue & {
      projectName: string;
      extensionId: number;
      extensionName: string;
    }
  >;
}
