# Change Log

All notable changes to the "BC Object Range Analyzer" extension will be documented in this file.

## [0.2.0] - 2026-01-16

### Added

- **Shared Range Mode** for multi-app scenarios with shared ID ranges (OnPrem licensing)
- **Conflict Detection** when same object type + ID is used across different projects
- **Per-object-type gap calculation** in shared mode
- **Quick pick for object type selection** when copying next available ID in shared mode

### Improved

- Settings now have proper scopes for multi-root workspace support:
  - `autoRefresh`, `autoRefreshDelay`, `excludePatterns`: Resource scope (per-folder)
  - `sharedRangeMode`: Window scope (workspace-wide)
- Comprehensive documentation with examples

### Configuration Options

- `bcObjectRange.sharedRangeMode`: Enable shared range mode for multi-app scenarios

## [0.0.1] - Initial Release

### Added

- Two-view interface in the Activity Bar:
  - **Used Object IDs**: Hierarchical view showing all AL objects organized by App → Object Type → Object (ID + Name)
  - **Unused IDs / Gaps**: Shows available ID ranges within configured `idRanges`
- Support for all 13 AL object types that require numeric IDs:
  - table, tableextension, page, pageextension
  - report, reportextension, codeunit, query, xmlport
  - enum, enumextension, permissionset, permissionsetextension
- Comment-aware parsing (handles `//` and `/* */` comments correctly)
- Support for multiple objects defined in a single file
- Auto-refresh with configurable debounce delay
- Manual refresh command
- Click-to-navigate: click any object to open its source file
- Copy Next ID: copy the next available ID from a gap
- Multi-root workspace support
- Configurable exclude patterns

### Configuration Options

- `bcObjectRange.autoRefresh`: Enable/disable automatic refresh on file changes
- `bcObjectRange.autoRefreshDelay`: Debounce delay in milliseconds (100-2000)
- `bcObjectRange.excludePatterns`: Glob patterns to exclude from scanning
