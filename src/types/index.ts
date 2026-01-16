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
