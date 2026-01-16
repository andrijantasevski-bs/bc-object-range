import * as vscode from "vscode";
import * as path from "path";
import { ALProject, ALObject } from "../types/index.js";
import { parseAppJson } from "../models/schemas.js";
import { alObjectParser } from "../parsers/alObjectParser.js";

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
      this.getExcludePattern()
    );

    for (const appJsonUri of appJsonFiles) {
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
   * Scan a single AL project given its app.json URI
   */
  private async scanProject(appJsonUri: vscode.Uri): Promise<ALProject | null> {
    try {
      // Read and parse app.json
      const appJsonContent = await vscode.workspace.fs.readFile(appJsonUri);
      const appJson = parseAppJson(
        Buffer.from(appJsonContent).toString("utf-8")
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
    projectRoot: string
  ): Promise<vscode.Uri[]> {
    // Create a relative pattern for this specific project
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      vscode.Uri.file(projectRoot)
    );
    if (!workspaceFolder) {
      return [];
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, projectRoot);
    const pattern = relativePath
      ? new vscode.RelativePattern(
          workspaceFolder,
          `${relativePath.replace(/\\/g, "/")}/**/*.al`
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
    project: ALProject
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
}

// Export singleton instance
export const workspaceScanner = new WorkspaceScanner();
