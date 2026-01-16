import * as vscode from "vscode";

/**
 * File watcher for AL files with configurable debounced refresh.
 * Supports automatic and manual refresh modes via configuration.
 */
export class ALFileWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private debounceTimer: NodeJS.Timeout | undefined;
  private configListener: vscode.Disposable | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly onFilesChanged: () => void) {
    this.setupConfigListener();
    this.applyConfiguration();
  }

  /**
   * Listen for configuration changes
   */
  private setupConfigListener(): void {
    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("bcObjectRange.autoRefresh")) {
        this.applyConfiguration();
      }
    });
    this.disposables.push(this.configListener);
  }

  /**
   * Apply current configuration (start or stop watching)
   */
  private applyConfiguration(): void {
    const config = vscode.workspace.getConfiguration("bcObjectRange");
    const autoRefresh = config.get<boolean>("autoRefresh", true);

    if (autoRefresh) {
      this.startWatching();
    } else {
      this.stopWatching();
    }
  }

  /**
   * Start watching AL files for changes
   */
  public startWatching(): void {
    if (this.watcher) {
      return; // Already watching
    }

    // Watch for .al file changes
    this.watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.al",
      false, // Don't ignore creates
      false, // Don't ignore changes
      false // Don't ignore deletes
    );

    // Subscribe to file events
    this.watcher.onDidCreate(() => this.handleChange(), this, this.disposables);
    this.watcher.onDidChange(() => this.handleChange(), this, this.disposables);
    this.watcher.onDidDelete(() => this.handleChange(), this, this.disposables);

    // Also watch app.json changes
    const appJsonWatcher = vscode.workspace.createFileSystemWatcher(
      "**/app.json",
      false,
      false,
      false
    );
    appJsonWatcher.onDidCreate(
      () => this.handleChange(),
      this,
      this.disposables
    );
    appJsonWatcher.onDidChange(
      () => this.handleChange(),
      this,
      this.disposables
    );
    appJsonWatcher.onDidDelete(
      () => this.handleChange(),
      this,
      this.disposables
    );

    this.disposables.push(this.watcher, appJsonWatcher);
  }

  /**
   * Stop watching files
   */
  public stopWatching(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }
  }

  /**
   * Handle file change with debouncing
   */
  private handleChange(): void {
    const config = vscode.workspace.getConfiguration("bcObjectRange");
    const delay = config.get<number>("autoRefreshDelay", 300);

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounced timer
    this.debounceTimer = setTimeout(() => {
      this.onFilesChanged();
    }, delay);
  }

  /**
   * Force an immediate refresh (for manual refresh command)
   */
  public forceRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.onFilesChanged();
  }

  /**
   * Check if auto-refresh is enabled
   */
  public isAutoRefreshEnabled(): boolean {
    const config = vscode.workspace.getConfiguration("bcObjectRange");
    return config.get<boolean>("autoRefresh", true);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
    this.watcher = undefined;
  }
}
