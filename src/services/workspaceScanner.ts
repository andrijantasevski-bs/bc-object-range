import * as vscode from "vscode";
import * as path from "path";
import { minimatch } from "minimatch";
import {
  ALProject,
  ALObject,
  ALObjectTypeWithId,
  IdRange,
  SharedIdGap,
  IdConflict,
  ALObjectWithFields,
  FieldConflict,
  EnumValueConflict,
} from "../types/index.js";
import { parseAppJson } from "../models/schemas.js";
import { alObjectParser } from "../parsers/alObjectParser.js";

/**
 * Extended AL project that stores objects with field/value information
 */
export interface ALProjectWithFields extends Omit<ALProject, "objects"> {
  objects: ALObjectWithFields[];
}

/**
 * Scans the workspace for AL projects and parses their objects.
 * Supports multi-root workspaces and detects projects via app.json.
 */
export class WorkspaceScanner {
  /**
   * Scan all workspace folders for AL projects
   */
  public async scanWorkspace(): Promise<ALProject[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const projects: ALProject[] = [];

    // Find all app.json files in the workspace
    const appJsonFiles = await vscode.workspace.findFiles(
      "**/app.json",
      this.getExcludePattern(),
    );

    for (const appJsonUri of appJsonFiles) {
      // Check if this project should be excluded based on its path
      if (this.shouldExcludeProject(appJsonUri.fsPath)) {
        continue;
      }

      const project = await this.scanProject(appJsonUri);
      if (project) {
        projects.push(project);
      }
    }

    // Sort projects by name
    projects.sort((a, b) => a.name.localeCompare(b.name));

    return projects;
  }

  /**
   * Determine if a project should be excluded based on its file path.
   * This handles both excludePatterns (glob patterns) and excludeFolders (folder names)
   * and properly excludes workspace root folders that vscode.workspace.findFiles cannot.
   *
   * @param projectPath - The absolute path to the app.json file or project root
   * @returns true if the project should be excluded, false otherwise
   */
  public shouldExcludeProject(projectPath: string): boolean {
    const config = vscode.workspace.getConfiguration("bcObjectRange");

    // Normalize path for consistent matching (use forward slashes)
    const normalizedPath = projectPath.replace(/\\/g, "/");

    // Check excludeFolders (simple folder name matching)
    const excludeFolders = config.get<string[]>("excludeFolders", []);
    if (excludeFolders.length > 0) {
      // Get all path segments
      const pathSegments = normalizedPath
        .split("/")
        .filter((s) => s.length > 0);

      for (const folderName of excludeFolders) {
        // Check if any segment matches the folder name (case-insensitive on Windows)
        const normalizedFolderName = folderName.toLowerCase();
        if (
          pathSegments.some(
            (segment) => segment.toLowerCase() === normalizedFolderName,
          )
        ) {
          return true;
        }
      }
    }

    // Check excludePatterns (glob pattern matching against full path)
    const excludePatterns = config.get<string[]>("excludePatterns", [
      "**/node_modules/**",
      "**/.altestrunner/**",
      "**/.alpackages/**",
    ]);

    for (const pattern of excludePatterns) {
      if (minimatch(normalizedPath, pattern, { dot: true, nocase: true })) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scan a single AL project given its app.json URI
   */
  private async scanProject(appJsonUri: vscode.Uri): Promise<ALProject | null> {
    try {
      // Read and parse app.json
      const appJsonContent = await vscode.workspace.fs.readFile(appJsonUri);
      const appJson = parseAppJson(
        Buffer.from(appJsonContent).toString("utf-8"),
      );

      if (!appJson) {
        console.warn(`Failed to parse app.json at ${appJsonUri.fsPath}`);
        return null;
      }

      const projectRoot = path.dirname(appJsonUri.fsPath);

      // Find all .al files in this project
      const alFiles = await this.findALFilesInProject(projectRoot);

      // Parse all AL files
      const objects = await this.parseALFiles(alFiles);

      // Sort objects by type, then by ID
      objects.sort((a, b) => {
        const typeCompare = a.type.localeCompare(b.type);
        if (typeCompare !== 0) {
          return typeCompare;
        }
        return a.id - b.id;
      });

      return {
        name: appJson.name,
        rootPath: projectRoot,
        idRanges: appJson.idRanges,
        objects,
      };
    } catch (error) {
      console.error(`Error scanning project at ${appJsonUri.fsPath}:`, error);
      return null;
    }
  }

  /**
   * Find all .al files within a project directory
   */
  private async findALFilesInProject(
    projectRoot: string,
  ): Promise<vscode.Uri[]> {
    // Create a relative pattern for this specific project
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(projectRoot),
    );
    if (!workspaceFolder) {
      return [];
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, projectRoot);
    const pattern = relativePath
      ? new vscode.RelativePattern(
          workspaceFolder,
          `${relativePath.replace(/\\/g, "/")}/**/*.al`,
        )
      : new vscode.RelativePattern(workspaceFolder, "**/*.al");

    return vscode.workspace.findFiles(pattern, this.getExcludePattern());
  }

  /**
   * Parse multiple AL files and extract objects
   */
  private async parseALFiles(fileUris: vscode.Uri[]): Promise<ALObject[]> {
    const allObjects: ALObject[] = [];

    // Process files in parallel for better performance
    const parsePromises = fileUris.map(async (uri) => {
      try {
        const content = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString("utf-8");
        return alObjectParser.parseContent(text, uri.fsPath);
      } catch (error) {
        console.error(`Error parsing ${uri.fsPath}:`, error);
        return [];
      }
    });

    const results = await Promise.all(parsePromises);
    for (const objects of results) {
      allObjects.push(...objects);
    }

    return allObjects;
  }

  /**
   * Get the exclude pattern from configuration
   */
  private getExcludePattern(): string {
    const config = vscode.workspace.getConfiguration("bcObjectRange");
    const excludePatterns = config.get<string[]>("excludePatterns", [
      "**/node_modules/**",
      "**/.altestrunner/**",
      "**/.alpackages/**",
    ]);

    return `{${excludePatterns.join(",")}}`;
  }

  /**
   * Calculate unused ID gaps within configured ranges for a project
   */
  public calculateGaps(
    project: ALProject,
  ): { start: number; end: number; count: number }[] {
    const gaps: { start: number; end: number; count: number }[] = [];

    if (project.idRanges.length === 0) {
      return gaps;
    }

    // Get all used IDs
    const usedIds = new Set(project.objects.map((obj) => obj.id));

    // For each configured range, find gaps
    for (const range of project.idRanges) {
      let gapStart: number | null = null;

      for (let id = range.from; id <= range.to; id++) {
        if (!usedIds.has(id)) {
          // This ID is unused
          if (gapStart === null) {
            gapStart = id;
          }
        } else {
          // This ID is used - close any open gap
          if (gapStart !== null) {
            gaps.push({
              start: gapStart,
              end: id - 1,
              count: id - gapStart,
            });
            gapStart = null;
          }
        }
      }

      // Close any gap that extends to the end of the range
      if (gapStart !== null) {
        gaps.push({
          start: gapStart,
          end: range.to,
          count: range.to - gapStart + 1,
        });
      }
    }

    return gaps;
  }

  /**
   * Get the next available ID in a project's ranges
   */
  public getNextAvailableId(project: ALProject): number | null {
    const gaps = this.calculateGaps(project);
    if (gaps.length === 0) {
      return null;
    }
    return gaps[0].start;
  }

  /**
   * Get the union of all ID ranges across all projects (for shared mode)
   */
  public getSharedRanges(projects: ALProject[]): IdRange[] {
    // Collect all ranges from all projects
    const allRanges: IdRange[] = [];
    for (const project of projects) {
      allRanges.push(...project.idRanges);
    }

    if (allRanges.length === 0) {
      return [];
    }

    // Sort ranges by 'from' value
    allRanges.sort((a, b) => a.from - b.from);

    // Merge overlapping/adjacent ranges
    const merged: IdRange[] = [{ ...allRanges[0] }];

    for (let i = 1; i < allRanges.length; i++) {
      const current = allRanges[i];
      const last = merged[merged.length - 1];

      if (current.from <= last.to + 1) {
        // Ranges overlap or are adjacent - merge them
        last.to = Math.max(last.to, current.to);
      } else {
        // No overlap - add as new range
        merged.push({ ...current });
      }
    }

    return merged;
  }

  /**
   * Calculate gaps for a specific object type across all projects (shared mode)
   */
  public calculateSharedGaps(
    projects: ALProject[],
    objectType: ALObjectTypeWithId,
  ): SharedIdGap[] {
    const gaps: SharedIdGap[] = [];
    const sharedRanges = this.getSharedRanges(projects);

    if (sharedRanges.length === 0) {
      return gaps;
    }

    // Collect all used IDs of this object type across all projects
    const usedIds = new Set<number>();
    for (const project of projects) {
      for (const obj of project.objects) {
        if (obj.type === objectType) {
          usedIds.add(obj.id);
        }
      }
    }

    // Find gaps in the shared ranges
    for (const range of sharedRanges) {
      let gapStart: number | null = null;

      for (let id = range.from; id <= range.to; id++) {
        if (!usedIds.has(id)) {
          if (gapStart === null) {
            gapStart = id;
          }
        } else {
          if (gapStart !== null) {
            gaps.push({
              start: gapStart,
              end: id - 1,
              count: id - gapStart,
              objectType,
            });
            gapStart = null;
          }
        }
      }

      // Close any gap that extends to the end of the range
      if (gapStart !== null) {
        gaps.push({
          start: gapStart,
          end: range.to,
          count: range.to - gapStart + 1,
          objectType,
        });
      }
    }

    return gaps;
  }

  /**
   * Get the next available ID for a specific object type across all projects (shared mode)
   */
  public getNextAvailableIdForType(
    projects: ALProject[],
    objectType: ALObjectTypeWithId,
  ): number | null {
    const gaps = this.calculateSharedGaps(projects, objectType);
    if (gaps.length === 0) {
      return null;
    }
    return gaps[0].start;
  }

  /**
   * Detect ID conflicts across projects (same object type + ID in multiple projects)
   */
  public detectConflicts(projects: ALProject[]): IdConflict[] {
    const conflicts: IdConflict[] = [];

    // Map: "type:id" -> ALObject[]
    const objectMap = new Map<string, ALObject[]>();

    for (const project of projects) {
      for (const obj of project.objects) {
        const key = `${obj.type}:${obj.id}`;
        const existing = objectMap.get(key) || [];
        existing.push(obj);
        objectMap.set(key, existing);
      }
    }

    // Find entries with multiple objects (conflicts)
    for (const [, objects] of objectMap) {
      if (objects.length > 1) {
        // Check if objects are from different projects (by file path)
        const uniquePaths = new Set(
          objects.map((o) => path.dirname(o.filePath)),
        );
        if (uniquePaths.size > 1) {
          conflicts.push({
            id: objects[0].id,
            type: objects[0].type,
            objects,
          });
        }
      }
    }

    // Sort by type, then by ID
    conflicts.sort((a, b) => {
      const typeCompare = a.type.localeCompare(b.type);
      return typeCompare !== 0 ? typeCompare : a.id - b.id;
    });

    return conflicts;
  }

  /**
   * Detect field ID conflicts in tableextensions extending the same base table
   * across multiple projects (shared mode).
   *
   * @param projects - The projects to analyze (must have objects with fields parsed)
   * @returns Array of field conflicts grouped by base table
   */
  public detectFieldConflicts(
    projects: ALProjectWithFields[],
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    // Map: "baseTable:fieldId" -> field info array
    const fieldMap = new Map<
      string,
      Array<{
        field: ALObjectWithFields["fields"] extends (infer T)[] | undefined
          ? T
          : never;
        projectName: string;
        extensionId: number;
        extensionName: string;
      }>
    >();

    for (const project of projects) {
      for (const obj of project.objects) {
        // Only process tableextensions with an extends clause and fields
        if (
          obj.type === "tableextension" &&
          obj.extendsObject &&
          obj.fields &&
          obj.fields.length > 0
        ) {
          for (const field of obj.fields) {
            const key = `${obj.extendsObject}:${field.id}`;
            const existing = fieldMap.get(key) || [];
            existing.push({
              field,
              projectName: project.name,
              extensionId: obj.id,
              extensionName: obj.name,
            });
            fieldMap.set(key, existing);
          }
        }
      }
    }

    // Find entries with multiple fields (conflicts)
    for (const [key, fieldInfos] of fieldMap) {
      if (fieldInfos.length > 1) {
        // Check if fields are from different projects
        const uniqueProjects = new Set(fieldInfos.map((f) => f.projectName));
        if (uniqueProjects.size > 1) {
          const baseTable = key.split(":")[0];
          const fieldId = parseInt(key.split(":")[1], 10);

          conflicts.push({
            fieldId,
            baseTable,
            fields: fieldInfos.map((info) => ({
              ...info.field,
              projectName: info.projectName,
              extensionId: info.extensionId,
              extensionName: info.extensionName,
            })),
          });
        }
      }
    }

    // Sort by base table, then by field ID
    conflicts.sort((a, b) => {
      const tableCompare = a.baseTable.localeCompare(b.baseTable);
      return tableCompare !== 0 ? tableCompare : a.fieldId - b.fieldId;
    });

    return conflicts;
  }

  /**
   * Detect enum value ID conflicts in enumextensions extending the same base enum
   * across multiple projects (shared mode).
   *
   * @param projects - The projects to analyze (must have objects with enumValues parsed)
   * @returns Array of enum value conflicts grouped by base enum
   */
  public detectEnumValueConflicts(
    projects: ALProjectWithFields[],
  ): EnumValueConflict[] {
    const conflicts: EnumValueConflict[] = [];

    // Map: "baseEnum:valueId" -> value info array
    const valueMap = new Map<
      string,
      Array<{
        value: ALObjectWithFields["enumValues"] extends (infer T)[] | undefined
          ? T
          : never;
        projectName: string;
        extensionId: number;
        extensionName: string;
      }>
    >();

    for (const project of projects) {
      for (const obj of project.objects) {
        // Only process enumextensions with an extends clause and values
        if (
          obj.type === "enumextension" &&
          obj.extendsObject &&
          obj.enumValues &&
          obj.enumValues.length > 0
        ) {
          for (const value of obj.enumValues) {
            const key = `${obj.extendsObject}:${value.id}`;
            const existing = valueMap.get(key) || [];
            existing.push({
              value,
              projectName: project.name,
              extensionId: obj.id,
              extensionName: obj.name,
            });
            valueMap.set(key, existing);
          }
        }
      }
    }

    // Find entries with multiple values (conflicts)
    for (const [key, valueInfos] of valueMap) {
      if (valueInfos.length > 1) {
        // Check if values are from different projects
        const uniqueProjects = new Set(valueInfos.map((v) => v.projectName));
        if (uniqueProjects.size > 1) {
          const baseEnum = key.split(":")[0];
          const valueId = parseInt(key.split(":")[1], 10);

          conflicts.push({
            valueId,
            baseEnum,
            values: valueInfos.map((info) => ({
              ...info.value,
              projectName: info.projectName,
              extensionId: info.extensionId,
              extensionName: info.extensionName,
            })),
          });
        }
      }
    }

    // Sort by base enum, then by value ID
    conflicts.sort((a, b) => {
      const enumCompare = a.baseEnum.localeCompare(b.baseEnum);
      return enumCompare !== 0 ? enumCompare : a.valueId - b.valueId;
    });

    return conflicts;
  }

  /**
   * Get all tableextensions grouped by the base table they extend.
   * Useful for displaying in tree views.
   *
   * @param projects - The projects to analyze
   * @returns Map of base table name to list of extensions with their project info
   */
  public getTableExtensionsByBase(
    projects: ALProjectWithFields[],
  ): Map<
    string,
    Array<{ obj: ALObjectWithFields; projectName: string; projectPath: string }>
  > {
    const result = new Map<
      string,
      Array<{
        obj: ALObjectWithFields;
        projectName: string;
        projectPath: string;
      }>
    >();

    for (const project of projects) {
      for (const obj of project.objects) {
        if (obj.type === "tableextension" && obj.extendsObject) {
          const existing = result.get(obj.extendsObject) || [];
          existing.push({
            obj,
            projectName: project.name,
            projectPath: project.rootPath,
          });
          result.set(obj.extendsObject, existing);
        }
      }
    }

    return result;
  }

  /**
   * Get all enumextensions grouped by the base enum they extend.
   * Useful for displaying in tree views.
   *
   * @param projects - The projects to analyze
   * @returns Map of base enum name to list of extensions with their project info
   */
  public getEnumExtensionsByBase(
    projects: ALProjectWithFields[],
  ): Map<
    string,
    Array<{ obj: ALObjectWithFields; projectName: string; projectPath: string }>
  > {
    const result = new Map<
      string,
      Array<{
        obj: ALObjectWithFields;
        projectName: string;
        projectPath: string;
      }>
    >();

    for (const project of projects) {
      for (const obj of project.objects) {
        if (obj.type === "enumextension" && obj.extendsObject) {
          const existing = result.get(obj.extendsObject) || [];
          existing.push({
            obj,
            projectName: project.name,
            projectPath: project.rootPath,
          });
          result.set(obj.extendsObject, existing);
        }
      }
    }

    return result;
  }
}

// Export singleton instance
export const workspaceScanner = new WorkspaceScanner();
