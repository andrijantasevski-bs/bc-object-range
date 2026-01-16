import * as vscode from "vscode";
import { ALProject, IdGap } from "../types/index.js";
import { workspaceScanner } from "../services/workspaceScanner.js";

/**
 * Tree item types for the Unused IDs view
 */
type TreeItemType = "project" | "gap" | "noRanges" | "noGaps";

/**
 * Base tree item for the Unused IDs view
 */
interface UnusedIdsTreeItemData {
  type: TreeItemType;
  label: string;
  project?: ALProject;
  gap?: IdGap;
}

/**
 * TreeDataProvider for displaying unused ID gaps within configured ranges.
 * Shows available ID ranges that can be used for new objects.
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
    if (
      element.type === "gap" ||
      element.type === "noRanges" ||
      element.type === "noGaps"
    ) {
      return {
        type: "project",
        label: element.project!.name,
        project: element.project,
      };
    }

    return null;
  }

  /**
   * Get the next available ID across all projects
   */
  public getNextAvailableId(project: ALProject): number | null {
    const gaps = this.getProjectGaps(project);
    if (gaps.length === 0) {
      return null;
    }
    return gaps[0].start;
  }
}
