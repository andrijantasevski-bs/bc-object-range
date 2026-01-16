import * as vscode from "vscode";
import { ALProject, ALObject, ObjectsByType, IdConflict } from "../types/index.js";
import { workspaceScanner } from "../services/workspaceScanner.js";

/**
 * Tree item types for the Used IDs view
 */
type TreeItemType = "project" | "objectType" | "object" | "conflictsRoot" | "conflict";

/**
 * Base tree item for the Used IDs view
 */
interface UsedIdsTreeItemData {
  type: TreeItemType;
  label: string;
  project?: ALProject;
  objectType?: string;
  object?: ALObject;
  conflict?: IdConflict;
}

/**
 * TreeDataProvider for displaying used object IDs organized by project and object type.
 * Hierarchy: App → Object Type → Objects (ID + name)
 * In shared mode, also shows ID conflicts across projects.
 */
export class UsedIdsTreeProvider
  implements vscode.TreeDataProvider<UsedIdsTreeItemData>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    UsedIdsTreeItemData | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projects: ALProject[] = [];
  private conflicts: IdConflict[] = [];

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
    // Detect conflicts in shared mode
    if (this.isSharedRangeMode()) {
      this.conflicts = workspaceScanner.detectConflicts(projects);
    } else {
      this.conflicts = [];
    }
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
  public getTreeItem(element: UsedIdsTreeItemData): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);

    switch (element.type) {
      case "conflictsRoot":
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        treeItem.iconPath = new vscode.ThemeIcon(
          "warning",
          new vscode.ThemeColor("editorWarning.foreground")
        );
        treeItem.tooltip = "Objects with the same type and ID exist in multiple projects";
        treeItem.description = `${this.conflicts.length} conflicts`;
        treeItem.contextValue = "conflictsRoot";
        break;

      case "conflict": {
        const conflict = element.conflict!;
        const projectNames = [
          ...new Set(
            conflict.objects.map((o) => {
              const project = this.projects.find((p) =>
                o.filePath.startsWith(p.rootPath)
              );
              return project?.name || "Unknown";
            })
          ),
        ].join(", ");
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("editorError.foreground")
        );
        treeItem.tooltip = new vscode.MarkdownString(
          `**Conflict:** ${conflict.type} ${conflict.id}\n\n` +
            `Used in: ${projectNames}\n\n` +
            conflict.objects
              .map((o) => `- ${o.name} (${o.filePath})`)
              .join("\n")
        );
        treeItem.description = projectNames;
        treeItem.contextValue = "conflict";
        // Open first conflicting file on click
        treeItem.command = {
          command: "bcObjectRange.openFile",
          title: "Open File",
          arguments: [conflict.objects[0]],
        };
        break;
      }

      case "project":
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        treeItem.iconPath = new vscode.ThemeIcon("folder-library");
        treeItem.tooltip = element.project?.rootPath;
        treeItem.description = `${
          element.project?.objects.length ?? 0
        } objects`;
        treeItem.contextValue = "project";
        break;

      case "objectType": {
        const objectCount =
          element.project?.objects.filter(
            (obj) => obj.type === element.objectType
          ).length ?? 0;
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        treeItem.iconPath = this.getObjectTypeIcon(element.objectType!);
        treeItem.description = `${objectCount}`;
        treeItem.contextValue = "objectType";
        break;
      }

      case "object": {
        const obj = element.object!;
        // Check if this object has a conflict in shared mode
        const hasConflict =
          this.isSharedRangeMode() &&
          this.conflicts.some(
            (c) => c.type === obj.type && c.id === obj.id
          );

        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = hasConflict
          ? new vscode.ThemeIcon(
              "warning",
              new vscode.ThemeColor("editorWarning.foreground")
            )
          : this.getObjectTypeIcon(obj.type);
        treeItem.tooltip = new vscode.MarkdownString(
          `**${obj.type}** ${obj.id} "${obj.name}"\n\n` +
            `File: ${obj.filePath}\n\n` +
            `Line: ${obj.lineNumber}` +
            (hasConflict
              ? "\n\n⚠️ **Conflict:** This ID is used by another project"
              : "")
        );
        treeItem.command = {
          command: "bcObjectRange.openFile",
          title: "Open File",
          arguments: [obj],
        };
        treeItem.contextValue = hasConflict ? "objectConflict" : "object";
        break;
      }
    }

    return treeItem;
  }

  /**
   * Get children for a tree item
   */
  public getChildren(element?: UsedIdsTreeItemData): UsedIdsTreeItemData[] {
    if (!element) {
      // Root level
      const items: UsedIdsTreeItemData[] = [];

      // In shared mode, show conflicts section first if there are any
      if (this.isSharedRangeMode() && this.conflicts.length > 0) {
        items.push({
          type: "conflictsRoot" as const,
          label: "⚠️ ID Conflicts",
        });
      }

      // Then show projects
      items.push(
        ...this.projects.map((project) => ({
          type: "project" as const,
          label: project.name,
          project,
        }))
      );

      return items;
    }

    if (element.type === "conflictsRoot") {
      // Show individual conflicts
      return this.conflicts.map((conflict) => ({
        type: "conflict" as const,
        label: `${this.formatObjectTypeName(conflict.type)} ${conflict.id}`,
        conflict,
      }));
    }

    if (element.type === "project") {
      // Project level: return object types that have objects
      const objectsByType = this.groupObjectsByType(element.project!.objects);
      const types = Object.keys(objectsByType).sort();

      return types.map((objectType) => ({
        type: "objectType" as const,
        label: this.formatObjectTypeName(objectType),
        project: element.project,
        objectType,
      }));
    }

    if (element.type === "objectType") {
      // Object type level: return individual objects sorted by ID
      const objects = element
        .project!.objects.filter((obj) => obj.type === element.objectType)
        .sort((a, b) => a.id - b.id);

      return objects.map((obj) => ({
        type: "object" as const,
        label: `${obj.id} ${obj.name}`,
        project: element.project,
        object: obj,
      }));
    }

    return [];
  }

  /**
   * Group objects by their type
   */
  private groupObjectsByType(objects: ALObject[]): ObjectsByType {
    const grouped: ObjectsByType = {};

    for (const obj of objects) {
      if (!grouped[obj.type]) {
        grouped[obj.type] = [];
      }
      grouped[obj.type].push(obj);
    }

    return grouped;
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
   * Get the parent of an element (for reveal functionality)
   */
  public getParent(element: UsedIdsTreeItemData): UsedIdsTreeItemData | null {
    if (element.type === "object") {
      return {
        type: "objectType",
        label: this.formatObjectTypeName(element.object!.type),
        project: element.project,
        objectType: element.object!.type,
      };
    }

    if (element.type === "objectType") {
      return {
        type: "project",
        label: element.project!.name,
        project: element.project,
      };
    }

    return null;
  }
}
