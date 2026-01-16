import * as vscode from "vscode";
import { workspaceScanner } from "./services/workspaceScanner.js";
import { ALFileWatcher } from "./services/fileWatcher.js";
import { UsedIdsTreeProvider } from "./providers/usedIdsTreeProvider.js";
import { UnusedIdsTreeProvider } from "./providers/unusedIdsTreeProvider.js";
import { ALObject, IdGap } from "./types/index.js";

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
    async (gap: IdGap) => {
      if (gap && gap.start) {
        await vscode.env.clipboard.writeText(gap.start.toString());
        vscode.window.showInformationMessage(
          `Copied ID ${gap.start} to clipboard`
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

  // Add to subscriptions
  context.subscriptions.push(
    usedIdsView,
    unusedIdsView,
    fileWatcher,
    analyzeCommand,
    refreshCommand,
    copyNextIdCommand,
    openFileCommand
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
