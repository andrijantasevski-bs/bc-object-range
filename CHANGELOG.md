# Change Log

All notable changes to the "BC Object Range Analyzer" extension will be documented in this file.

## [0.4.3] - 2026-01-16

### Added

- Added extension icon for VS Code marketplace
- Automated publishing to VS Code marketplace on release

## [0.4.2] - 2026-01-16

### Fixed

- Fixed VSIX packaging failing due to pnpm symlinks by adding `.npmrc` with `node-linker=hoisted`
- Added `.vscodeignore` to exclude unnecessary files from the extension package
- Added MIT LICENSE file

## [0.4.1] - 2026-01-16

### Fixed

- Fixed CI/CD workflows pnpm version conflict by using `packageManager` field from package.json instead of hardcoding version in GitHub Actions

## [0.4.0] - 2026-01-16

### Changed

- **Migrated to pnpm**: Project now uses pnpm as the package manager instead of npm
  - Updated all scripts in `package.json` to use pnpm
  - Updated CI/CD workflows to use pnpm with proper caching
  - Added `packageManager` field to `package.json` for consistency

## [0.3.0] - 2026-01-16

### Added

- **IntelliSense ID Suggestions**: Automatic completion suggestions for the next available object ID when typing AL object declarations
  - Triggers on space after typing an object type keyword (e.g., `codeunit `, `table `, `page `)
  - Also works with manual IntelliSense trigger (`Ctrl+Space`)
  - Supports all 13 object types that require IDs
  - Works in both **normal mode** (project-specific) and **shared mode** (type-specific across projects)
  - Shows helpful documentation with the suggested ID, object type, and project/mode information
  - Displays a warning when no IDs are available in the configured ranges
- Extension now activates on `onLanguage:al` for immediate IntelliSense support when editing AL files

### Improved

- Project detection now prefers the most specific (deepest) project when files are in nested project paths
- Fixed flaky test for command registration in VS Code test environment
- Fixed integration test for nested multi-line comments to align with AL language behavior

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
