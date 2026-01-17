import * as vscode from "vscode";
import {
  ALProject,
  ALObject,
  ObjectsByType,
  IdConflict,
  ALObjectWithFields,
  ALField,
  ALEnumValue,
  FieldConflict,
  EnumValueConflict,
} from "../types/index.js";
import {
  workspaceScanner,
  ALProjectWithFields,
} from "../services/workspaceScanner.js";

/**
 * Tree item types for the Used IDs view
 */
type TreeItemType =
  | "project"
  | "objectType"
  | "object"
  | "conflictsRoot"
  | "conflict"
  | "fieldConflictsRoot"
  | "fieldConflict"
  | "enumValueConflictsRoot"
  | "enumValueConflict"
  | "baseTable"
  | "baseEnum"
  | "extensionObject"
  | "field"
  | "enumValue";

/**
 * Base tree item for the Used IDs view
 */
interface UsedIdsTreeItemData {
  type: TreeItemType;
  label: string;
  project?: ALProject;
  objectType?: string;
  object?: ALObject | ALObjectWithFields;
  conflict?: IdConflict;
  fieldConflict?: FieldConflict;
  enumValueConflict?: EnumValueConflict;
  baseObjectName?: string;
  field?: ALField & { projectName?: string; extensionName?: string };
  enumValue?: ALEnumValue & { projectName?: string; extensionName?: string };
}

/**
 * TreeDataProvider for displaying used object IDs organized by project and object type.
 * Hierarchy: App → Object Type → Objects (ID + name)
 * In shared mode, also shows ID conflicts across projects, including field/enum value conflicts.
 */
export class UsedIdsTreeProvider implements vscode.TreeDataProvider<UsedIdsTreeItemData> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    UsedIdsTreeItemData | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projects: ALProjectWithFields[] = [];
  private conflicts: IdConflict[] = [];
  private fieldConflicts: FieldConflict[] = [];
  private enumValueConflicts: EnumValueConflict[] = [];

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
    // Cast to ALProjectWithFields since the parser now returns objects with fields
    this.projects = projects as ALProjectWithFields[];
    // Detect conflicts in shared mode
    if (this.isSharedRangeMode()) {
      this.conflicts = workspaceScanner.detectConflicts(projects);
      this.fieldConflicts = workspaceScanner.detectFieldConflicts(
        this.projects,
      );
      this.enumValueConflicts = workspaceScanner.detectEnumValueConflicts(
        this.projects,
      );
    } else {
      this.conflicts = [];
      this.fieldConflicts = [];
      this.enumValueConflicts = [];
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
          new vscode.ThemeColor("editorWarning.foreground"),
        );
        treeItem.tooltip =
          "Objects with the same type and ID exist in multiple projects";
        treeItem.description = `${this.conflicts.length} conflicts`;
        treeItem.contextValue = "conflictsRoot";
        break;

      case "fieldConflictsRoot":
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        treeItem.iconPath = new vscode.ThemeIcon(
          "warning",
          new vscode.ThemeColor("editorWarning.foreground"),
        );
        treeItem.tooltip =
          "Fields with the same ID exist in multiple tableextensions for the same base table";
        treeItem.description = `${this.fieldConflicts.length} conflicts`;
        treeItem.contextValue = "fieldConflictsRoot";
        break;

      case "enumValueConflictsRoot":
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        treeItem.iconPath = new vscode.ThemeIcon(
          "warning",
          new vscode.ThemeColor("editorWarning.foreground"),
        );
        treeItem.tooltip =
          "Enum values with the same ID exist in multiple enumextensions for the same base enum";
        treeItem.description = `${this.enumValueConflicts.length} conflicts`;
        treeItem.contextValue = "enumValueConflictsRoot";
        break;

      case "conflict": {
        const conflict = element.conflict!;
        const projectNames = [
          ...new Set(
            conflict.objects.map((o) => {
              const project = this.projects.find((p) =>
                o.filePath.startsWith(p.rootPath),
              );
              return project?.name || "Unknown";
            }),
          ),
        ].join(", ");
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("editorError.foreground"),
        );
        treeItem.tooltip = new vscode.MarkdownString(
          `**Conflict:** ${conflict.type} ${conflict.id}\n\n` +
            `Used in: ${projectNames}\n\n` +
            conflict.objects
              .map((o) => `- ${o.name} (${o.filePath})`)
              .join("\n"),
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

      case "fieldConflict": {
        const fieldConflict = element.fieldConflict!;
        const projectNames = [
          ...new Set(fieldConflict.fields.map((f) => f.projectName)),
        ].join(", ");
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        treeItem.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("editorError.foreground"),
        );
        treeItem.tooltip = new vscode.MarkdownString(
          `**Field Conflict:** ID ${fieldConflict.fieldId} in "${fieldConflict.baseTable}" extensions\n\n` +
            `Used in: ${projectNames}\n\n` +
            fieldConflict.fields
              .map(
                (f) => `- ${f.name} (${f.extensionName} from ${f.projectName})`,
              )
              .join("\n"),
        );
        treeItem.description = `extends "${fieldConflict.baseTable}"`;
        treeItem.contextValue = "fieldConflict";
        break;
      }

      case "enumValueConflict": {
        const enumConflict = element.enumValueConflict!;
        const projectNames = [
          ...new Set(enumConflict.values.map((v) => v.projectName)),
        ].join(", ");
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        treeItem.iconPath = new vscode.ThemeIcon(
          "error",
          new vscode.ThemeColor("editorError.foreground"),
        );
        treeItem.tooltip = new vscode.MarkdownString(
          `**Enum Value Conflict:** ID ${enumConflict.valueId} in "${enumConflict.baseEnum}" extensions\n\n` +
            `Used in: ${projectNames}\n\n` +
            enumConflict.values
              .map(
                (v) => `- ${v.name} (${v.extensionName} from ${v.projectName})`,
              )
              .join("\n"),
        );
        treeItem.description = `extends "${enumConflict.baseEnum}"`;
        treeItem.contextValue = "enumValueConflict";
        break;
      }

      case "field": {
        const field = element.field!;
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon(
          "symbol-field",
          new vscode.ThemeColor("editorError.foreground"),
        );
        treeItem.tooltip = new vscode.MarkdownString(
          `**Field:** ${field.id} "${field.name}"\n\n` +
            `Type: ${field.dataType}\n\n` +
            `Extension: ${field.extensionName || "Unknown"}\n\n` +
            `Project: ${field.projectName || "Unknown"}\n\n` +
            `File: ${field.filePath}\n\n` +
            `Line: ${field.lineNumber}`,
        );
        treeItem.description = `${field.projectName} / ${field.extensionName}`;
        treeItem.contextValue = "field";
        treeItem.command = {
          command: "bcObjectRange.openFile",
          title: "Open File",
          arguments: [
            { filePath: field.filePath, lineNumber: field.lineNumber },
          ],
        };
        break;
      }

      case "enumValue": {
        const enumValue = element.enumValue!;
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        treeItem.iconPath = new vscode.ThemeIcon(
          "symbol-enum-member",
          new vscode.ThemeColor("editorError.foreground"),
        );
        treeItem.tooltip = new vscode.MarkdownString(
          `**Enum Value:** ${enumValue.id} "${enumValue.name}"\n\n` +
            `Extension: ${enumValue.extensionName || "Unknown"}\n\n` +
            `Project: ${enumValue.projectName || "Unknown"}\n\n` +
            `File: ${enumValue.filePath}\n\n` +
            `Line: ${enumValue.lineNumber}`,
        );
        treeItem.description = `${enumValue.projectName} / ${enumValue.extensionName}`;
        treeItem.contextValue = "enumValue";
        treeItem.command = {
          command: "bcObjectRange.openFile",
          title: "Open File",
          arguments: [
            { filePath: enumValue.filePath, lineNumber: enumValue.lineNumber },
          ],
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
            (obj) => obj.type === element.objectType,
          ).length ?? 0;
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        treeItem.iconPath = this.getObjectTypeIcon(element.objectType!);
        treeItem.description = `${objectCount}`;
        treeItem.contextValue = "objectType";
        break;
      }

      case "object": {
        const obj = element.object! as ALObjectWithFields;
        // Check if this object has a conflict in shared mode
        const hasConflict =
          this.isSharedRangeMode() &&
          this.conflicts.some((c) => c.type === obj.type && c.id === obj.id);

        // Check if any fields/values have conflicts
        const hasFieldConflicts =
          this.isSharedRangeMode() &&
          obj.type === "tableextension" &&
          obj.extendsObject &&
          obj.fields &&
          obj.fields.some((f) =>
            this.fieldConflicts.some(
              (fc) => fc.baseTable === obj.extendsObject && fc.fieldId === f.id,
            ),
          );

        const hasEnumValueConflicts =
          this.isSharedRangeMode() &&
          obj.type === "enumextension" &&
          obj.extendsObject &&
          obj.enumValues &&
          obj.enumValues.some((v) =>
            this.enumValueConflicts.some(
              (ec) => ec.baseEnum === obj.extendsObject && ec.valueId === v.id,
            ),
          );

        // Determine collapsibility based on whether object has fields/values
        const hasChildren =
          (obj.fields && obj.fields.length > 0) ||
          (obj.enumValues && obj.enumValues.length > 0);
        treeItem.collapsibleState = hasChildren
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None;

        treeItem.iconPath =
          hasConflict || hasFieldConflicts || hasEnumValueConflicts
            ? new vscode.ThemeIcon(
                "warning",
                new vscode.ThemeColor("editorWarning.foreground"),
              )
            : this.getObjectTypeIcon(obj.type);

        let tooltipText =
          `**${obj.type}** ${obj.id} "${obj.name}"\n\n` +
          `File: ${obj.filePath}\n\n` +
          `Line: ${obj.lineNumber}`;

        if (obj.extendsObject) {
          tooltipText += `\n\nExtends: "${obj.extendsObject}"`;
        }

        if (obj.fields && obj.fields.length > 0) {
          tooltipText += `\n\n**Fields:** ${obj.fields.length}`;
        }

        if (obj.enumValues && obj.enumValues.length > 0) {
          tooltipText += `\n\n**Values:** ${obj.enumValues.length}`;
        }

        if (hasConflict) {
          tooltipText +=
            "\n\n⚠️ **Conflict:** This object ID is used by another project";
        }

        if (hasFieldConflicts) {
          tooltipText +=
            "\n\n⚠️ **Field Conflicts:** Some fields have conflicting IDs with other extensions";
        }

        if (hasEnumValueConflicts) {
          tooltipText +=
            "\n\n⚠️ **Value Conflicts:** Some values have conflicting IDs with other extensions";
        }

        treeItem.tooltip = new vscode.MarkdownString(tooltipText);
        treeItem.command = {
          command: "bcObjectRange.openFile",
          title: "Open File",
          arguments: [obj],
        };
        treeItem.contextValue =
          hasConflict || hasFieldConflicts || hasEnumValueConflicts
            ? "objectConflict"
            : "object";
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

      // In shared mode, show conflicts sections first if there are any
      if (this.isSharedRangeMode() && this.conflicts.length > 0) {
        items.push({
          type: "conflictsRoot" as const,
          label: "⚠️ ID Conflicts",
        });
      }

      if (this.isSharedRangeMode() && this.fieldConflicts.length > 0) {
        items.push({
          type: "fieldConflictsRoot" as const,
          label: "⚠️ Field ID Conflicts",
        });
      }

      if (this.isSharedRangeMode() && this.enumValueConflicts.length > 0) {
        items.push({
          type: "enumValueConflictsRoot" as const,
          label: "⚠️ Enum Value ID Conflicts",
        });
      }

      // Then show projects
      items.push(
        ...this.projects.map((project) => ({
          type: "project" as const,
          label: project.name,
          project,
        })),
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

    if (element.type === "fieldConflictsRoot") {
      // Show individual field conflicts
      return this.fieldConflicts.map((fieldConflict) => ({
        type: "fieldConflict" as const,
        label: `Field ${fieldConflict.fieldId}`,
        fieldConflict,
      }));
    }

    if (element.type === "enumValueConflictsRoot") {
      // Show individual enum value conflicts
      return this.enumValueConflicts.map((enumValueConflict) => ({
        type: "enumValueConflict" as const,
        label: `Value ${enumValueConflict.valueId}`,
        enumValueConflict,
      }));
    }

    if (element.type === "fieldConflict") {
      // Show the individual fields that are conflicting
      const fieldConflict = element.fieldConflict!;
      return fieldConflict.fields.map((field) => ({
        type: "field" as const,
        label: `${field.id} ${field.name}`,
        field,
      }));
    }

    if (element.type === "enumValueConflict") {
      // Show the individual enum values that are conflicting
      const enumValueConflict = element.enumValueConflict!;
      return enumValueConflict.values.map((value) => ({
        type: "enumValue" as const,
        label: `${value.id} ${value.name}`,
        enumValue: value,
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

    if (element.type === "object") {
      // Object level: show fields for tableextension, values for enumextension
      const obj = element.object as ALObjectWithFields;
      const items: UsedIdsTreeItemData[] = [];

      if (
        (obj.type === "table" || obj.type === "tableextension") &&
        obj.fields &&
        obj.fields.length > 0
      ) {
        for (const field of obj.fields.sort((a, b) => a.id - b.id)) {
          items.push({
            type: "field" as const,
            label: `${field.id} ${field.name}`,
            field: {
              ...field,
              projectName: element.project?.name,
              extensionName: obj.name,
            },
          });
        }
      }

      if (
        (obj.type === "enum" || obj.type === "enumextension") &&
        obj.enumValues &&
        obj.enumValues.length > 0
      ) {
        for (const value of obj.enumValues.sort((a, b) => a.id - b.id)) {
          items.push({
            type: "enumValue" as const,
            label: `${value.id} ${value.name}`,
            enumValue: {
              ...value,
              projectName: element.project?.name,
              extensionName: obj.name,
            },
          });
        }
      }

      return items;
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
      iconMap[objectType.toLowerCase()] || "symbol-class",
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
