import * as vscode from "vscode";
import { workspaceScanner } from "./services/workspaceScanner.js";
import { ALFileWatcher } from "./services/fileWatcher.js";
import { UsedIdsTreeProvider } from "./providers/usedIdsTreeProvider.js";
import { UnusedIdsTreeProvider } from "./providers/unusedIdsTreeProvider.js";
import {
  ALObject,
  IdGap,
  AL_OBJECT_TYPES_WITH_ID,
  ALObjectTypeWithId,
} from "./types/index.js";

let usedIdsProvider: UsedIdsTreeProvider;
let unusedIdsProvider: UnusedIdsTreeProvider;
let fileWatcher: ALFileWatcher;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log("BC Object Range Analyzer is now active");

  // Create tree data providers
  usedIdsProvider = new UsedIdsTreeProvider();
  unusedIdsProvider = new UnusedIdsTreeProvider();

  // Register tree views
  const usedIdsView = vscode.window.createTreeView("bcObjectRange.usedIds", {
    treeDataProvider: usedIdsProvider,
    showCollapseAll: true,
  });

  const unusedIdsView = vscode.window.createTreeView(
    "bcObjectRange.unusedIds",
    {
      treeDataProvider: unusedIdsProvider,
      showCollapseAll: true,
    }
  );

  // Create file watcher with refresh callback
  fileWatcher = new ALFileWatcher(() => {
    refreshAnalysis();
  });

  // Register commands
  const analyzeCommand = vscode.commands.registerCommand(
    "bcObjectRange.analyze",
    () => {
      refreshAnalysis();
    }
  );

  const refreshCommand = vscode.commands.registerCommand(
    "bcObjectRange.refresh",
    () => {
      fileWatcher.forceRefresh();
    }
  );

  const copyNextIdCommand = vscode.commands.registerCommand(
    "bcObjectRange.copyNextId",
    async (gap?: IdGap) => {
      const config = vscode.workspace.getConfiguration("bcObjectRange");
      const sharedMode = config.get<boolean>("sharedRangeMode", false);

      if (gap && gap.start) {
        // Called from tree view with a specific gap
        await vscode.env.clipboard.writeText(gap.start.toString());
        vscode.window.showInformationMessage(
          `Copied ID ${gap.start} to clipboard`
        );
      } else if (sharedMode) {
        // In shared mode without a gap, show quick pick for object type
        const items = AL_OBJECT_TYPES_WITH_ID.map((type) => {
          const nextId = unusedIdsProvider.getNextAvailableIdForType(type);
          return {
            label: type.charAt(0).toUpperCase() + type.slice(1),
            description: nextId ? `Next: ${nextId}` : "No IDs available",
            objectType: type as ALObjectTypeWithId,
            nextId,
          };
        }).filter((item) => item.nextId !== null);

        if (items.length === 0) {
          vscode.window.showWarningMessage(
            "No available IDs in the shared range"
          );
          return;
        }

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Select object type to get next available ID",
          title: "Copy Next Available ID (Shared Mode)",
        });

        if (selected && selected.nextId) {
          await vscode.env.clipboard.writeText(selected.nextId.toString());
          vscode.window.showInformationMessage(
            `Copied ID ${selected.nextId} for ${selected.label} to clipboard`
          );
        }
      } else {
        vscode.window.showInformationMessage(
          "Click on a gap in the Unused IDs view to copy its ID"
        );
      }
    }
  );

  const openFileCommand = vscode.commands.registerCommand(
    "bcObjectRange.openFile",
    async (object: ALObject) => {
      if (object && object.filePath) {
        const doc = await vscode.workspace.openTextDocument(object.filePath);
        const editor = await vscode.window.showTextDocument(doc);

        // Move cursor to the line where the object is declared
        const position = new vscode.Position(object.lineNumber - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    }
  );

  // Listen for configuration changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(
    (e) => {
      if (e.affectsConfiguration("bcObjectRange.sharedRangeMode")) {
        refreshAnalysis();
      }
    }
  );

  // Add to subscriptions
  context.subscriptions.push(
    usedIdsView,
    unusedIdsView,
    fileWatcher,
    analyzeCommand,
    refreshCommand,
    copyNextIdCommand,
    openFileCommand,
    configChangeListener
  );

  // Perform initial analysis
  refreshAnalysis();
}

/**
 * Refresh the workspace analysis
 */
async function refreshAnalysis(): Promise<void> {
  try {
    const projects = await workspaceScanner.scanWorkspace();
    usedIdsProvider.setProjects(projects);
    unusedIdsProvider.setProjects(projects);

    // Show summary message if there are projects
    if (projects.length > 0) {
      const totalObjects = projects.reduce(
        (sum, p) => sum + p.objects.length,
        0
      );
      console.log(
        `BC Object Range: Found ${totalObjects} objects in ${projects.length} project(s)`
      );
    }
  } catch (error) {
    console.error("Error refreshing BC Object Range analysis:", error);
    vscode.window.showErrorMessage(
      "Failed to analyze AL projects. See console for details."
    );
  }
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log("BC Object Range Analyzer is now deactivated");
}
