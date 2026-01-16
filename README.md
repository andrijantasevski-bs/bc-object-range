# BC Object Range Analyzer

A Visual Studio Code extension for analyzing AL object ID range usage in Business Central projects. It helps you track which object IDs are in use, find available IDs, and detect conflicts when multiple apps share the same ID range.

## Features

- **Object Range Overview**: Scans all AL projects in your workspace and displays used object IDs organized by app and object type
- **Unused ID Detection**: Shows gaps in your configured ID ranges so you can easily find available IDs for new objects
- **Multi-Project Support**: Works with multi-root workspaces containing multiple AL apps
- **Shared Range Mode**: Special mode for OnPrem scenarios where multiple apps share the same ID range (see [Shared Range Mode](#shared-range-mode))
- **Conflict Detection**: Identifies when the same object type + ID is used in multiple projects
- **Auto-Refresh**: Automatically updates when AL files change (configurable)
- **Click to Navigate**: Click on any object to open its source file at the declaration line
- **Copy Next ID**: Quickly copy the next available ID to your clipboard

---

## Table of Contents

- [Supported Object Types](#supported-object-types)
- [Getting Started](#getting-started)
- [Views](#views)
- [Commands](#commands)
- [Configuration](#configuration)
- [Normal Mode vs Shared Range Mode](#normal-mode-vs-shared-range-mode)
- [Shared Range Mode](#shared-range-mode)
- [How It Works](#how-it-works)
- [Examples](#examples)
- [Known Limitations](#known-limitations)
- [FAQ](#faq)

---

## Supported Object Types

The extension recognizes all 13 AL object types that require numeric IDs:

| Object Type            | Example Declaration                                     |
| ---------------------- | ------------------------------------------------------- |
| table                  | `table 50000 "My Table" { }`                            |
| tableextension         | `tableextension 50000 "Ext" extends "Base" { }`         |
| page                   | `page 50000 "My Page" { }`                              |
| pageextension          | `pageextension 50000 "Ext" extends "Base" { }`          |
| report                 | `report 50000 "My Report" { }`                          |
| reportextension        | `reportextension 50000 "Ext" extends "Base" { }`        |
| codeunit               | `codeunit 50000 "My Codeunit" { }`                      |
| query                  | `query 50000 "My Query" { }`                            |
| xmlport                | `xmlport 50000 "My XMLport" { }`                        |
| enum                   | `enum 50000 "My Enum" { }`                              |
| enumextension          | `enumextension 50000 "Ext" extends "Base" { }`          |
| permissionset          | `permissionset 50000 "My PermSet" { }`                  |
| permissionsetextension | `permissionsetextension 50000 "Ext" extends "Base" { }` |

> **Note:** Object types that don't require IDs (interface, controladdin, profile, pagecustomization, entitlement, dotnet) are not tracked.

---

## Getting Started

1. **Install the extension** from the VS Code marketplace
2. **Open a workspace** containing one or more AL projects (folders with `app.json` files)
3. The extension automatically activates and scans your workspace
4. **Look for the "BC Object Range" icon** in the Activity Bar (left sidebar)
5. Explore the two views: "Used Object IDs" and "Unused IDs / Gaps"

---

## Views

The extension adds a new icon in the Activity Bar with two tree views:

### 1. Used Object IDs

Shows all detected AL objects organized hierarchically:

```
📁 My App Name (42 objects)
├── 📄 Table (5)
│   ├── 50000 Customer Extended
│   ├── 50001 Sales Header Extended
│   └── ...
├── 📄 Page (10)
│   ├── 50000 Customer Card Extended
│   └── ...
└── 📄 Codeunit (27)
    └── ...
```

- **Click on any object** to open its source file at the declaration line
- Objects are sorted by ID within each type

### 2. Unused IDs / Gaps

Shows available ID ranges within your configured `idRanges`:

```
📁 My App Name (58 IDs available)
├── ⭕ 50005 - 50010 (6 IDs)
├── ⭕ 50025 (1 ID)
└── ⭕ 50050 - 50099 (50 IDs)
```

- **Click on any gap** to copy the first ID in that range to your clipboard
- Shows how many IDs are available in each gap

---

## Commands

Available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command                                     | Description                                              |
| ------------------------------------------- | -------------------------------------------------------- |
| **BC Object Range: Analyze Object Ranges**  | Manually trigger a full workspace scan                   |
| **BC Object Range: Refresh**                | Force refresh the views                                  |
| **BC Object Range: Copy Next Available ID** | Copy the next available ID (shows picker in shared mode) |

---

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for "bcObjectRange":

| Setting                          | Type    | Default     | Scope    | Description                                                   |
| -------------------------------- | ------- | ----------- | -------- | ------------------------------------------------------------- |
| `bcObjectRange.autoRefresh`      | boolean | `true`      | Resource | Automatically refresh when `.al` files change                 |
| `bcObjectRange.autoRefreshDelay` | number  | `300`       | Resource | Delay in milliseconds before auto-refresh triggers (100-2000) |
| `bcObjectRange.excludePatterns`  | array   | (see below) | Resource | Glob patterns to exclude from scanning                        |
| `bcObjectRange.sharedRangeMode`  | boolean | `false`     | Window   | Enable shared range mode for multi-app scenarios (see below)  |

**Default exclude patterns:**

```json
["**/node_modules/**", "**/.altestrunner/**", "**/.alpackages/**"]
```

### Setting Scopes Explained

- **Resource scope** (`autoRefresh`, `autoRefreshDelay`, `excludePatterns`): Can be configured per workspace folder. In a multi-root workspace, you can set different values for each folder.
- **Window scope** (`sharedRangeMode`): Applies to the entire VS Code window/workspace. This setting must be configured at the workspace level (`.code-workspace` file) or user level, not in individual folder `.vscode/settings.json` files.

> **Note:** The `sharedRangeMode` setting is window-scoped because it conceptually applies to all projects in the workspace simultaneously—it determines whether projects share ID ranges across the entire workspace.

### Where to Configure Settings

| Location                                  | Resource-scoped settings | Window-scoped settings |
| ----------------------------------------- | ------------------------ | ---------------------- |
| User settings (`settings.json`)           | ✅ Yes                   | ✅ Yes                 |
| Workspace settings (`.code-workspace`)    | ✅ Yes                   | ✅ Yes                 |
| Folder settings (`.vscode/settings.json`) | ✅ Yes                   | ❌ No                  |

### Example: Workspace Settings (`.code-workspace` file)

For multi-root workspaces, configure settings in your `.code-workspace` file:

```json
{
  "folders": [
    { "path": "core-app" },
    { "path": "sales-app" },
    { "path": "inventory-app" }
  ],
  "settings": {
    "bcObjectRange.sharedRangeMode": true,
    "bcObjectRange.autoRefresh": true,
    "bcObjectRange.autoRefreshDelay": 500
  }
}
```

### Example: User/Workspace settings.json

```json
{
  "bcObjectRange.autoRefresh": true,
  "bcObjectRange.autoRefreshDelay": 500,
  "bcObjectRange.sharedRangeMode": true,
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",
    "**/TestApps/**"
  ]
}
```

---

## Normal Mode vs Shared Range Mode

The extension operates in one of two modes:

| Aspect                        | Normal Mode (default)                   | Shared Range Mode                              |
| ----------------------------- | --------------------------------------- | ---------------------------------------------- |
| **Use case**                  | Each app has its own dedicated ID range | Multiple apps share the same ID range (OnPrem) |
| **Gap calculation**           | Per-project                             | Per-object-type across all projects            |
| **Same ID in different apps** | OK (they have different ranges)         | **Conflict** (shows warning)                   |
| **"Next available ID"**       | Per project                             | Per object type across all projects            |

### When to use Shared Range Mode

Enable `bcObjectRange.sharedRangeMode` when:

- You have **OnPrem licensing** that allocates a single ID range to multiple apps
- Multiple apps in your workspace **must not use the same object type + ID combination**
- You want to see **conflicts** when two apps accidentally use the same ID for the same object type

---

## Shared Range Mode

When `bcObjectRange.sharedRangeMode` is enabled, the extension behavior changes to support scenarios where multiple apps share a single ID range.

### Unused IDs View (Shared Mode)

Instead of showing gaps per project, gaps are shown **per object type**:

```
📁 Shared Range (50000-50119)
├── 📄 Table
│   ├── ⭕ 50005 - 50010 (6 IDs)
│   └── ⭕ 50050 - 50099 (50 IDs)
├── 📄 Page
│   ├── ⭕ 50000 - 50004 (5 IDs)
│   └── ⭕ 50020 - 50099 (80 IDs)
├── 📄 Codeunit
│   └── ⭕ 50000 - 50099 (100 IDs)
└── ... (all 13 object types)
```

This is because in AL, different object types can share the same ID number. For example:

- `table 50000 "My Table"` and `page 50000 "My Page"` can coexist ✅
- But `table 50000` in App1 and `table 50000` in App2 would be a **conflict** ❌

### Conflict Detection

When two projects have objects with the same type AND same ID, the extension shows warnings:

**In the Used IDs view:**

```
⚠️ ID Conflicts (2 conflicts)
├── ❌ table 50000 — App1, App2
└── ❌ page 50005 — App1, App3

📁 App1 (15 objects)
├── 📄 Table (3)
│   ├── ⚠️ 50000 Customer Extended  ← Warning icon
│   └── ...
```

Objects involved in conflicts show a warning icon and tooltip explaining the conflict.

### Copy Next ID (Shared Mode)

When you run the "Copy Next Available ID" command in shared mode:

1. A **quick pick menu** appears listing all object types
2. Each type shows its next available ID
3. Select a type to copy that ID to your clipboard

```
┌─────────────────────────────────────────────────────┐
│ Select object type to get next available ID         │
├─────────────────────────────────────────────────────┤
│ Table                              Next: 50005      │
│ Tableextension                     Next: 50000      │
│ Page                               Next: 50000      │
│ Codeunit                           Next: 50012      │
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

---

## How It Works

### Project Detection

An AL project is identified by the presence of an `app.json` file. The extension reads:

```json
{
  "name": "My Extension",
  "idRanges": [
    { "from": 50000, "to": 50099 },
    { "from": 50100, "to": 50199 }
  ]
}
```

Both `idRanges` (array) and legacy `idRange` (single object) are supported.

### Shared Range Calculation

In shared mode, ranges from all projects are **merged**:

```
App1: idRanges: [{ from: 50000, to: 50050 }]
App2: idRanges: [{ from: 50025, to: 50099 }]
App3: idRanges: [{ from: 50000, to: 50099 }]

Merged shared range: 50000 - 50099
```

Overlapping and adjacent ranges are automatically combined.

### Comment Handling

The parser correctly ignores commented-out object declarations:

```al
// table 50000 "Commented Out" { }  -- Ignored

/*
page 50001 "Also Commented" { }     -- Ignored
*/

table 50002 "Real Object" { }       -- Detected
```

### Multiple Objects Per File

The extension handles files containing multiple object declarations:

```al
table 50000 "First Table" { }
table 50001 "Second Table" { }
page 50000 "My Page" { }
```

All three objects will be detected and listed separately.

---

## Examples

### Example 1: Single App (Normal Mode)

**Workspace structure:**

```
my-extension/
├── app.json          ← idRanges: [{ from: 50000, to: 50099 }]
├── Tables/
│   ├── Tab50000.MyTable.al
│   └── Tab50001.OtherTable.al
└── Pages/
    └── Pag50000.MyPage.al
```

**Used IDs view:**

```
📁 My Extension (3 objects)
├── 📄 Table (2)
│   ├── 50000 My Table
│   └── 50001 Other Table
└── 📄 Page (1)
    └── 50000 My Page
```

**Unused IDs view:**

```
📁 My Extension (97 IDs available)
└── ⭕ 50002 - 50099 (98 IDs)
```

---

### Example 2: Multiple Apps with Shared Range

**Workspace structure:**

```
workspace/
├── core-app/
│   ├── app.json      ← idRanges: [{ from: 50000, to: 50119 }]
│   └── Tab50000.Customer.al
├── sales-app/
│   ├── app.json      ← idRanges: [{ from: 50000, to: 50119 }]
│   └── Tab50001.SalesHeader.al
└── inventory-app/
    ├── app.json      ← idRanges: [{ from: 50000, to: 50119 }]
    └── Tab50002.Item.al
```

**settings.json:**

```json
{
  "bcObjectRange.sharedRangeMode": true
}
```

**Unused IDs view (shared mode):**

```
📁 Shared Range (50000-50119)
├── 📄 Table
│   └── ⭕ 50003 - 50119 (117 IDs)    ← 50000, 50001, 50002 used across apps
├── 📄 Page
│   └── ⭕ 50000 - 50119 (120 IDs)    ← No pages yet
└── 📄 Codeunit
    └── ⭕ 50000 - 50119 (120 IDs)    ← No codeunits yet
```

---

### Example 3: Conflict Detection

If `sales-app` accidentally creates `table 50000` (same as `core-app`):

**Used IDs view:**

```
⚠️ ID Conflicts (1 conflict)
└── ❌ table 50000 — core-app, sales-app

📁 core-app (1 objects)
└── 📄 Table (1)
    └── ⚠️ 50000 Customer          ← Conflict warning

📁 sales-app (2 objects)
└── 📄 Table (2)
    ├── ⚠️ 50000 SalesCustomer     ← Conflict warning
    └── 50001 SalesHeader
```

---

## Known Limitations

| Limitation               | Description                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| **No ID validation**     | The extension doesn't validate if objects are within the configured range. It only reports what's found.  |
| **No field ID tracking** | Table field IDs and enum value IDs are not tracked, only top-level object IDs.                            |
| **No real-time sync**    | Changes are detected via file watching, but there may be a brief delay.                                   |
| **Objects without IDs**  | `interface`, `controladdin`, `profile`, `pagecustomization`, `entitlement`, and `dotnet` are not tracked. |
| **Extension objects**    | Extension objects use their own ID namespace; base object IDs are not resolved.                           |
| **Symbol references**    | The extension only parses local `.al` files. It doesn't read symbols from `.alpackages` or dependencies.  |

---

## FAQ

### Q: Why don't I see any projects?

**A:** The extension looks for `app.json` files to identify AL projects. Make sure:

- Your project has a valid `app.json` file
- The folder is included in your workspace
- The folder isn't excluded by `bcObjectRange.excludePatterns`

### Q: Why are some objects missing?

**A:** Check if:

- The object file has a `.al` extension
- The object declaration follows standard AL syntax
- The object isn't commented out
- The file isn't in an excluded folder (node_modules, .alpackages, etc.)

### Q: When should I enable shared range mode?

**A:** Enable it when multiple apps in your workspace share the same ID range allocation (common with OnPrem licensing). If each app has its own dedicated range, keep it disabled.

### Q: How do I resolve conflicts?

**A:** When you see a conflict:

1. Click on the conflict item to open one of the conflicting files
2. Change the object ID in one of the apps to an unused ID
3. The conflict will disappear after the next refresh

### Q: Why can't I set `sharedRangeMode` in my folder's settings.json?

**A:** The `sharedRangeMode` setting has **window scope**, which means it applies to the entire VS Code window and cannot be set per-folder. This is by design because shared range mode is a workspace-wide concept that affects how all projects are analyzed together.

To configure `sharedRangeMode`:

- **Multi-root workspace**: Add it to your `.code-workspace` file under `"settings"`
- **Single folder**: Add it to your user settings or the folder's `.vscode/settings.json`
- **User-wide**: Add it to your VS Code user settings

### Q: Can I use this with AL:Go?

**A:** Yes! The extension works with any AL project structure. It scans based on `app.json` files and `.al` file content.

### Q: Does this work with the Vjeko AL Object ID Ninja extension?

**A:** This extension is independent and uses only local file scanning. It doesn't integrate with external ID management services, but it can be used alongside other extensions.

---

## Requirements

- Visual Studio Code 1.74.0 or higher
- AL projects with valid `app.json` files

---

## Release Notes

### 0.2.0

- **IMPROVED:** Settings now have proper scopes for multi-root workspace support
  - `autoRefresh`, `autoRefreshDelay`, `excludePatterns`: Resource scope (per-folder)
  - `sharedRangeMode`: Window scope (workspace-wide)
- **IMPROVED:** Documentation updated with setting scope explanations

### 0.1.0

- **NEW:** Shared Range Mode for multi-app scenarios with shared ID ranges
- **NEW:** Conflict detection when same type+ID is used across projects
- **NEW:** Per-object-type gap calculation in shared mode
- **NEW:** Quick pick for object type selection when copying next ID

### 0.0.1

- Initial release
- Support for all 13 AL object types with IDs
- Two-view interface (Used IDs, Unused Gaps)
- Auto-refresh with configurable debounce
- Comment-aware parsing
- Multi-project workspace support

---

## Contributing

Found a bug or have a feature request? Please open an issue on the repository.

---

## License

MIT
