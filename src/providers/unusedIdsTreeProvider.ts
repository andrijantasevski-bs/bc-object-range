import * as vscode from "vscode";
import {
  ALProject,
  IdGap,
  SharedIdGap,
  ALObjectTypeWithId,
  AL_OBJECT_TYPES_WITH_ID,
} from "../types/index.js";
import { workspaceScanner } from "../services/workspaceScanner.js";

/**
 * Tree item types for the Unused IDs view
 */
type TreeItemType =
  | "project"
  | "gap"
  | "noRanges"
  | "noGaps"
  | "sharedRoot"
  | "objectType"
  | "sharedGap";

/**
 * Base tree item for the Unused IDs view
 */
interface UnusedIdsTreeItemData {
  type: TreeItemType;
  label: string;
  project?: ALProject;
  gap?: IdGap;
  sharedGap?: SharedIdGap;
  objectType?: ALObjectTypeWithId;
}

/**
 * TreeDataProvider for displaying unused ID gaps within configured ranges.
 * Shows available ID ranges that can be used for new objects.
 * Supports both per-project mode and shared range mode.
 */
export class UnusedIdsTreeProvider
  implements vscode.TreeDataProvider<UnusedIdsTreeItemData>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    UnusedIdsTreeItemData | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projects: ALProject[] = [];

  constructor() {}

  /**
   * Check if shared range mode is enabled
   */
  private isSharedRangeMode(): boolean {
    const config = vscode.workspace.getConfiguration("bcObjectRange");
    return config.get<boolean>("sharedRangeMode", false);
  }

  /**
   * Update the projects data and refresh the tree
   */
  public setProjects(projects: ALProject[]): void {
    this.projects = projects;
    this.refresh();
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the tree item representation
   */
  public getTreeItem(element: UnusedIdsTreeItemData): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);

    switch (element.type) {
      case "sharedRoot": {
        const sharedRanges = workspaceScanner.getSharedRanges(this.projects);
        const rangeStr = sharedRanges
          .map((r) => `${r.from}-${r.to}`)
          .join(", ");
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        treeItem.iconPath = new vscode.ThemeIcon("layers");
        treeItem.tooltip = `Shared range mode: IDs are shared across all projects\nRanges: ${rangeStr}`;
        treeItem.description = `${this.projects.length} projects`;
        treeItem.contextValue = "sharedRoot";
        break;
      }

      case "objectType": {
        const gaps = workspaceScanner.calculateSharedGaps(
          this.projects,
          element.objectType!
        );
        const totalAvailable = gaps.reduce((sum, gap) => sum + gap.count, 0);
        treeItem.collapsibleState =
          gaps.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = this.getObjectTypeIcon(element.objectType!);
        treeItem.description =
          totalAvailable > 0 ? `${totalAvailable} IDs available` : "No gaps";
        treeItem.contextValue = "objectType";
        break;
      }

      case "sharedGap": {
        const gap = element.sharedGap!;
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon("circle-outline");
        treeItem.tooltip = `IDs ${gap.start} to ${gap.end} are unused for ${gap.objectType}\nClick to copy ${gap.start}`;
        treeItem.description = gap.count === 1 ? "1 ID" : `${gap.count} IDs`;
        treeItem.contextValue = "gapItem";
        treeItem.command = {
          command: "bcObjectRange.copyNextId",
          title: "Copy Next Available ID",
          arguments: [{ start: gap.start, end: gap.end, count: gap.count }],
        };
        break;
      }

      case "project": {
        const gaps = this.getProjectGaps(element.project!);
        const totalAvailable = gaps.reduce((sum, gap) => sum + gap.count, 0);
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        treeItem.iconPath = new vscode.ThemeIcon("folder-library");
        treeItem.tooltip = this.formatProjectTooltip(element.project!);
        treeItem.description = `${totalAvailable} IDs available`;
        treeItem.contextValue = "project";
        break;
      }

      case "gap": {
        const gap = element.gap!;
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon("circle-outline");
        treeItem.tooltip = `IDs ${gap.start} to ${gap.end} are unused\nClick to copy ${gap.start}`;
        treeItem.description = gap.count === 1 ? "1 ID" : `${gap.count} IDs`;
        treeItem.contextValue = "gapItem";
        treeItem.command = {
          command: "bcObjectRange.copyNextId",
          title: "Copy Next Available ID",
          arguments: [gap],
        };
        break;
      }

      case "noRanges":
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon("warning");
        treeItem.tooltip = "No idRanges defined in app.json";
        treeItem.contextValue = "info";
        break;

      case "noGaps":
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon("check");
        treeItem.tooltip = "All IDs in the configured ranges are used";
        treeItem.contextValue = "info";
        break;
    }

    return treeItem;
  }

  /**
   * Get children for a tree item
   */
  public getChildren(element?: UnusedIdsTreeItemData): UnusedIdsTreeItemData[] {
    // Handle shared range mode
    if (this.isSharedRangeMode()) {
      return this.getChildrenSharedMode(element);
    }

    // Normal per-project mode
    return this.getChildrenNormalMode(element);
  }

  /**
   * Get children in normal (per-project) mode
   */
  private getChildrenNormalMode(
    element?: UnusedIdsTreeItemData
  ): UnusedIdsTreeItemData[] {
    if (!element) {
      // Root level: return projects
      return this.projects.map((project) => ({
        type: "project" as const,
        label: project.name,
        project,
      }));
    }

    if (element.type === "project") {
      const project = element.project!;

      // Check if project has configured ranges
      if (project.idRanges.length === 0) {
        return [
          {
            type: "noRanges" as const,
            label: "No ID ranges configured",
            project,
          },
        ];
      }

      // Calculate gaps
      const gaps = this.getProjectGaps(project);

      if (gaps.length === 0) {
        return [
          {
            type: "noGaps" as const,
            label: "All IDs are used",
            project,
          },
        ];
      }

      return gaps.map((gap) => ({
        type: "gap" as const,
        label:
          gap.start === gap.end ? `${gap.start}` : `${gap.start} - ${gap.end}`,
        project,
        gap,
      }));
    }

    return [];
  }

  /**
   * Get children in shared range mode
   */
  private getChildrenSharedMode(
    element?: UnusedIdsTreeItemData
  ): UnusedIdsTreeItemData[] {
    if (!element) {
      // Root level: show "Shared Range" root node
      const sharedRanges = workspaceScanner.getSharedRanges(this.projects);
      if (sharedRanges.length === 0) {
        return [
          {
            type: "noRanges" as const,
            label: "No ID ranges configured in any project",
          },
        ];
      }

      const rangeStr = sharedRanges
        .map((r) => `${r.from}-${r.to}`)
        .join(", ");

      return [
        {
          type: "sharedRoot" as const,
          label: `Shared Range (${rangeStr})`,
        },
      ];
    }

    if (element.type === "sharedRoot") {
      // Show object types that have gaps
      return AL_OBJECT_TYPES_WITH_ID.map((objectType) => ({
        type: "objectType" as const,
        label: this.formatObjectTypeName(objectType),
        objectType,
      }));
    }

    if (element.type === "objectType") {
      // Show gaps for this object type
      const gaps = workspaceScanner.calculateSharedGaps(
        this.projects,
        element.objectType!
      );

      if (gaps.length === 0) {
        return [
          {
            type: "noGaps" as const,
            label: "All IDs are used",
            objectType: element.objectType,
          },
        ];
      }

      return gaps.map((gap) => ({
        type: "sharedGap" as const,
        label:
          gap.start === gap.end ? `${gap.start}` : `${gap.start} - ${gap.end}`,
        sharedGap: gap,
        objectType: element.objectType,
      }));
    }

    return [];
  }

  /**
   * Get gaps for a project
   */
  private getProjectGaps(project: ALProject): IdGap[] {
    const rawGaps = workspaceScanner.calculateGaps(project);
    return rawGaps.map((gap) => ({
      ...gap,
      projectName: project.name,
      projectPath: project.rootPath,
    }));
  }

  /**
   * Format object type name for display (capitalize first letter)
   */
  private formatObjectTypeName(objectType: string): string {
    return objectType.charAt(0).toUpperCase() + objectType.slice(1);
  }

  /**
   * Get icon for an object type
   */
  private getObjectTypeIcon(objectType: string): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      table: "database",
      tableextension: "database",
      page: "window",
      pageextension: "window",
      report: "file-text",
      reportextension: "file-text",
      codeunit: "code",
      query: "search",
      xmlport: "file-code",
      enum: "symbol-enum",
      enumextension: "symbol-enum",
      permissionset: "shield",
      permissionsetextension: "shield",
    };

    return new vscode.ThemeIcon(
      iconMap[objectType.toLowerCase()] || "symbol-class"
    );
  }

  /**
   * Format tooltip for a project showing configured ranges
   */
  private formatProjectTooltip(project: ALProject): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${project.name}**\n\n`);
    md.appendMarkdown(`Path: ${project.rootPath}\n\n`);

    if (project.idRanges.length > 0) {
      md.appendMarkdown("**Configured Ranges:**\n");
      for (const range of project.idRanges) {
        md.appendMarkdown(`- ${range.from} - ${range.to}\n`);
      }
    } else {
      md.appendMarkdown("*No ID ranges configured in app.json*");
    }

    return md;
  }

  /**
   * Get the parent of an element
   */
  public getParent(
    element: UnusedIdsTreeItemData
  ): UnusedIdsTreeItemData | null {
    // Shared mode parent relationships
    if (element.type === "sharedGap") {
      return {
        type: "objectType",
        label: this.formatObjectTypeName(element.objectType!),
        objectType: element.objectType,
      };
    }

    if (element.type === "objectType") {
      const sharedRanges = workspaceScanner.getSharedRanges(this.projects);
      const rangeStr = sharedRanges
        .map((r) => `${r.from}-${r.to}`)
        .join(", ");
      return {
        type: "sharedRoot",
        label: `Shared Range (${rangeStr})`,
      };
    }

    if (element.type === "sharedRoot") {
      return null;
    }

    // Normal mode parent relationships
    if (
      element.type === "gap" ||
      element.type === "noRanges" ||
      element.type === "noGaps"
    ) {
      if (element.project) {
        return {
          type: "project",
          label: element.project.name,
          project: element.project,
        };
      }
    }

    return null;
  }

  /**
   * Get the next available ID for a project (normal mode)
   */
  public getNextAvailableId(project: ALProject): number | null {
    const gaps = this.getProjectGaps(project);
    if (gaps.length === 0) {
      return null;
    }
    return gaps[0].start;
  }

  /**
   * Get the next available ID for a specific object type (shared mode)
   */
  public getNextAvailableIdForType(
    objectType: ALObjectTypeWithId
  ): number | null {
    return workspaceScanner.getNextAvailableIdForType(this.projects, objectType);
  }

  /**
   * Get all projects (for external access in shared mode)
   */
  public getProjects(): ALProject[] {
    return this.projects;
  }
}
