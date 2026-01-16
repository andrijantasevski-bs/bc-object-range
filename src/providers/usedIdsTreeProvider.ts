import * as vscode from "vscode";
import { ALProject, ALObject, ObjectsByType } from "../types/index.js";

/**
 * Tree item types for the Used IDs view
 */
type TreeItemType = "project" | "objectType" | "object";

/**
 * Base tree item for the Used IDs view
 */
interface UsedIdsTreeItemData {
  type: TreeItemType;
  label: string;
  project?: ALProject;
  objectType?: string;
  object?: ALObject;
}

/**
 * TreeDataProvider for displaying used object IDs organized by project and object type.
 * Hierarchy: App → Object Type → Objects (ID + name)
 */
export class UsedIdsTreeProvider
  implements vscode.TreeDataProvider<UsedIdsTreeItemData>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    UsedIdsTreeItemData | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projects: ALProject[] = [];

  constructor() {}

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
  public getTreeItem(element: UsedIdsTreeItemData): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);

    switch (element.type) {
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

      case "object":
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = this.getObjectTypeIcon(element.object!.type);
        treeItem.tooltip = new vscode.MarkdownString(
          `**${element.object!.type}** ${element.object!.id} "${
            element.object!.name
          }"\n\n` +
            `File: ${element.object!.filePath}\n\n` +
            `Line: ${element.object!.lineNumber}`
        );
        treeItem.command = {
          command: "bcObjectRange.openFile",
          title: "Open File",
          arguments: [element.object],
        };
        treeItem.contextValue = "object";
        break;
    }

    return treeItem;
  }

  /**
   * Get children for a tree item
   */
  public getChildren(element?: UsedIdsTreeItemData): UsedIdsTreeItemData[] {
    if (!element) {
      // Root level: return projects
      return this.projects.map((project) => ({
        type: "project" as const,
        label: project.name,
        project,
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
