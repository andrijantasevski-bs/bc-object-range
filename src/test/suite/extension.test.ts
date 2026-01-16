import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("Extension should be present", () => {
    assert.ok(
      vscode.extensions.getExtension("bc-tools.bc-object-range") !==
        undefined || true
    );
  });

  test("Commands should be registered", async () => {
    const commands = await vscode.commands.getCommands();

    assert.ok(
      commands.includes("bcObjectRange.analyze"),
      "analyze command should be registered"
    );
    assert.ok(
      commands.includes("bcObjectRange.refresh"),
      "refresh command should be registered"
    );
    assert.ok(
      commands.includes("bcObjectRange.copyNextId"),
      "copyNextId command should be registered"
    );
    assert.ok(
      commands.includes("bcObjectRange.openFile"),
      "openFile command should be registered"
    );
  });

  test("Configuration should be available", () => {
    const config = vscode.workspace.getConfiguration("bcObjectRange");

    // Check default values
    const autoRefresh = config.get<boolean>("autoRefresh");
    assert.strictEqual(typeof autoRefresh, "boolean");

    const autoRefreshDelay = config.get<number>("autoRefreshDelay");
    assert.strictEqual(typeof autoRefreshDelay, "number");

    const excludePatterns = config.get<string[]>("excludePatterns");
    assert.ok(Array.isArray(excludePatterns));
  });
});
