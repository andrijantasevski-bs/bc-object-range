import * as vscode from "vscode";
import {
  ALProject,
  ALObjectTypeWithId,
  AL_OBJECT_TYPES_WITH_ID,
} from "../types/index.js";
import { WorkspaceScanner } from "../services/workspaceScanner.js";

/**
 * Provides IntelliSense completions for AL object IDs.
 * Suggests the next available ID when the user types an AL object type keyword.
 */
export class ObjectIdCompletionProvider
  implements vscode.CompletionItemProvider
{
  private projects: ALProject[] = [];
  private workspaceScanner: WorkspaceScanner;

  constructor(workspaceScanner: WorkspaceScanner) {
    this.workspaceScanner = workspaceScanner;
  }

  /**
   * Update the list of projects used for ID suggestions
   */
  public setProjects(projects: ALProject[]): void {
    this.projects = projects;
  }

  /**
   * Provide completion items for AL object IDs
   */
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] | undefined {
    // Get the text on the current line up to the cursor position
    const lineText = document.lineAt(position.line).text;
    const textBeforeCursor = lineText.substring(0, position.character);

    // Check if the text before cursor matches an AL object type pattern
    const objectTypeMatch = this.matchObjectType(textBeforeCursor);
    if (!objectTypeMatch) {
      return undefined;
    }

    const objectType = objectTypeMatch.toLowerCase() as ALObjectTypeWithId;

    // Get configuration for shared mode
    const config = vscode.workspace.getConfiguration("bcObjectRange");
    const sharedMode = config.get<boolean>("sharedRangeMode", false);

    let nextId: number | null = null;
    let projectName: string | undefined;

    if (sharedMode) {
      // In shared mode, get the next available ID for this object type across all projects
      nextId = this.workspaceScanner.getNextAvailableIdForType(
        this.projects,
        objectType
      );
      projectName = "Shared Range";
    } else {
      // In normal mode, find the project for the current document
      const project = this.findProjectForDocument(document);
      if (project) {
        nextId = this.workspaceScanner.getNextAvailableId(project);
        projectName = project.name;
      }
    }

    if (nextId === null) {
      // No IDs available - show a warning completion item
      const warningItem = new vscode.CompletionItem(
        "⚠️ No available IDs",
        vscode.CompletionItemKind.Issue
      );
      warningItem.detail = sharedMode
        ? "All IDs in the shared range are used"
        : projectName
        ? `All IDs in "${projectName}" ranges are used`
        : "Could not determine project for this file";
      warningItem.documentation = new vscode.MarkdownString(
        "No available object IDs found in the configured ranges. " +
          "Please extend your ID ranges in app.json or remove unused objects."
      );
      warningItem.sortText = "0"; // Show at top
      return [warningItem];
    }

    // Create completion item with the next available ID
    const completionItem = new vscode.CompletionItem(
      nextId.toString(),
      vscode.CompletionItemKind.Value
    );

    completionItem.detail = `Next available ${objectType} ID`;
    completionItem.documentation = new vscode.MarkdownString(
      `**Next Available ID: ${nextId}**\n\n` +
        `Object Type: \`${objectType}\`\n\n` +
        (sharedMode
          ? `Mode: Shared Range (all projects)\n\n`
          : `Project: ${projectName}\n\n`) +
        `This ID is the first available ID in the configured ranges.`
    );

    // Insert just the ID number
    completionItem.insertText = nextId.toString();

    // Make it appear at the top of the completion list
    completionItem.sortText = "0";

    // Preselect this item
    completionItem.preselect = true;

    return [completionItem];
  }

  /**
   * Match an AL object type keyword at the end of the text
   * Returns the matched object type or null if no match
   */
  private matchObjectType(text: string): string | null {
    // Trim the text and check if it ends with an object type keyword followed by optional whitespace
    const trimmed = text.trimEnd();

    // Pattern: starts with optional whitespace, then an object type keyword
    // The keyword should be at the end (possibly followed by spaces which we already trimmed)
    for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
      // Check if the trimmed text ends with the object type (case insensitive)
      const regex = new RegExp(`^\\s*${objectType}\\s*$`, "i");
      if (regex.test(trimmed)) {
        return objectType;
      }
    }

    return null;
  }

  /**
   * Find the AL project that contains the given document
   * When multiple projects match (nested paths), prefer the longest/most specific match
   */
  private findProjectForDocument(
    document: vscode.TextDocument
  ): ALProject | undefined {
    const documentPath = document.uri.fsPath;

    // Find the project whose rootPath is a prefix of the document path
    // Prefer the longest matching path (most specific project)
    let bestMatch: ALProject | undefined;
    let bestMatchLength = 0;

    for (const project of this.projects) {
      if (documentPath.startsWith(project.rootPath)) {
        if (project.rootPath.length > bestMatchLength) {
          bestMatch = project;
          bestMatchLength = project.rootPath.length;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get the next available ID for a specific object type and document.
   * This is a utility method that can be used for testing.
   */
  public getNextAvailableId(
    documentPath: string,
    objectType: ALObjectTypeWithId,
    sharedMode: boolean
  ): number | null {
    if (sharedMode) {
      return this.workspaceScanner.getNextAvailableIdForType(
        this.projects,
        objectType
      );
    } else {
      // Find project by path
      for (const project of this.projects) {
        if (documentPath.startsWith(project.rootPath)) {
          return this.workspaceScanner.getNextAvailableId(project);
        }
      }
      return null;
    }
  }

  /**
   * Check if the given text matches an AL object type that requires an ID
   */
  public static matchesObjectTypeWithId(
    text: string
  ): ALObjectTypeWithId | null {
    const trimmed = text.trim().toLowerCase();
    for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
      if (trimmed === objectType) {
        return objectType;
      }
    }
    return null;
  }
}
