# BC Object Range Analyzer

A Visual Studio Code extension for analyzing AL object ID range usage in Business Central projects. It helps you track which object IDs are in use, find available IDs, and detect conflicts when multiple apps share the same ID range.

## Features

- **Object Range Overview**: Scans all AL projects in your workspace and displays used object IDs organized by app and object type
- **Unused ID Detection**: Shows gaps in your configured ID ranges so you can easily find available IDs for new objects
- **IntelliSense ID Suggestions**: Get automatic suggestions for the next available object ID when typing AL object declarations (see [IntelliSense ID Suggestions](#intellisense-id-suggestions))
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
- [IntelliSense ID Suggestions](#intellisense-id-suggestions)
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

## IntelliSense ID Suggestions

The extension provides automatic IntelliSense completions that suggest the next available object ID when you're creating new AL objects.

### How It Works

1. Start typing an AL object declaration (e.g., `codeunit`, `table`, `page`)
2. Press `Space` after the object type keyword, or trigger IntelliSense manually with `Ctrl+Space`
3. The extension suggests the next available ID from your configured ranges

### Example

```al
codeunit |  ← Press Space or Ctrl+Space here
```

You'll see a completion item like:

```
┌─────────────────────────────────────────────────────┐
│ 50003                                               │
│ Next available codeunit ID                          │
│ Project: My Extension                               │
└─────────────────────────────────────────────────────┘
```

Select the suggestion to insert the ID directly into your code.

### Supported Object Types

IntelliSense suggestions work for all 13 object types that require IDs:

- `table`, `tableextension`
- `page`, `pageextension`
- `report`, `reportextension`
- `codeunit`
- `query`
- `xmlport`
- `enum`, `enumextension`
- `permissionset`, `permissionsetextension`

> **Note:** Object types that don't require IDs (`interface`, `controladdin`, `profile`, `pagecustomization`, `entitlement`, `dotnet`) do not trigger ID suggestions.

### Normal Mode vs Shared Mode

| Mode        | Behavior                                                                            |
| ----------- | ----------------------------------------------------------------------------------- |
| Normal Mode | Suggests the next available ID from the **current project's** ID ranges             |
| Shared Mode | Suggests the next available ID for the **specific object type** across all projects |

In **shared mode**, the suggested ID is type-specific because different object types can share the same ID number, but the same type + ID combination must be unique across all projects.

### Edge Cases

- **No project detected**: If the file is not within a known AL project, no suggestion is shown
- **No available IDs**: If all IDs in the configured ranges are used, a warning message is shown instead
- **Nested projects**: If projects are nested, the most specific (deepest) project is used

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
| `bcObjectRange.excludeFolders`   | array   | `[]`        | Resource | Folder names to exclude (simple alternative to glob patterns) |
| `bcObjectRange.sharedRangeMode`  | boolean | `false`     | Window   | Enable shared range mode for multi-app scenarios (see below)  |

**Default exclude patterns:**

```json
["**/node_modules/**", "**/.altestrunner/**", "**/.alpackages/**"]
```

### Excluding Projects from Analysis

The extension provides two complementary ways to exclude projects from being analyzed:

1. **`excludeFolders`** — Simple folder name matching (recommended for workspace root folders)
2. **`excludePatterns`** — Glob patterns for more complex exclusion rules

#### excludeFolders Setting (Recommended for Workspace Root Folders)

The `bcObjectRange.excludeFolders` setting provides a simple way to exclude projects by folder name. This is **the recommended approach** for excluding workspace root folders (folders added via "Add Folder to Workspace").

**Why use `excludeFolders`?**

When you add a folder to your workspace using "Add Folder to Workspace", VS Code treats it as a workspace root. The `excludePatterns` glob patterns are evaluated _relative to each workspace root_, which means patterns like `**/App_FaultyItems/**` won't match the folder itself—only subfolders with that name.

The `excludeFolders` setting solves this by matching folder names directly anywhere in the path.

**Example:**

```json
{
  "bcObjectRange.excludeFolders": ["App_FaultyItems", "TestApps", "Archive"]
}
```

This will exclude any project whose path contains folders named `App_FaultyItems`, `TestApps`, or `Archive`.

**Key characteristics:**

- ✅ Matches folder names **anywhere in the path** (root or nested)
- ✅ **Case-insensitive** matching
- ✅ Matches **exact folder names only** (not partial matches)
- ✅ Works with workspace root folders
- ✅ Simple and intuitive

**Examples of what gets excluded with `["TestApp"]`:**

| Path                                     | Excluded? | Why                                     |
| ---------------------------------------- | --------- | --------------------------------------- |
| `C:/workspace/TestApp/app.json`          | ✅ Yes    | Exact folder name match                 |
| `C:/workspace/Projects/TestApp/app.json` | ✅ Yes    | Exact folder name match (nested)        |
| `C:/workspace/TestAppV2/app.json`        | ❌ No     | "TestAppV2" ≠ "TestApp" (partial match) |
| `C:/workspace/MyTestApp/app.json`        | ❌ No     | "MyTestApp" ≠ "TestApp" (partial match) |

### excludePatterns Setting (Glob Patterns)

The `bcObjectRange.excludePatterns` setting allows you to exclude specific files, folders, or entire projects from being analyzed by the extension using glob patterns. This is particularly useful when you have test projects, dependencies, or other AL projects in your workspace that you don't want to include in the object range analysis.

#### How Exclude Patterns Work

Exclude patterns use **glob pattern syntax** and are applied when the extension:

1. Searches for `app.json` files to detect projects
2. Searches for `.al` files within detected projects
3. **Post-filters projects by their full path** (this enables workspace root folder exclusion)

The patterns are combined with the `{pattern1,pattern2,...}` syntax and applied to both searches.

#### Glob Pattern Syntax

| Pattern    | Description                                            | Example Matches                                     |
| ---------- | ------------------------------------------------------ | --------------------------------------------------- |
| `*`        | Matches any number of characters within a folder name  | `*.al` matches all AL files                         |
| `**`       | Matches zero or more directories                       | `**/test/**` matches any `test` folder at any level |
| `?`        | Matches a single character                             | `file?.al` matches `file1.al`, `fileA.al`           |
| `[abc]`    | Matches any character in the brackets                  | `file[123].al` matches `file1.al`, `file2.al`       |
| `{a,b}`    | Matches any of the comma-separated patterns            | `*.{al,json}` matches `.al` and `.json` files       |
| `!pattern` | Negates the pattern (NOT supported in excludePatterns) | N/A - use separate patterns instead                 |

> **Important:** All patterns are case-insensitive.

#### Common Use Cases

##### 1. Excluding Test Projects

If you have test or demo projects that you don't want included in the analysis:

```json
{
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",
    "**/TestApps/**",
    "**/DemoApps/**"
  ]
}
```

This excludes:

- All folders named `TestApps` at any level
- All folders named `DemoApps` at any level

##### 2. Excluding Specific Project by Name

To exclude a specific project folder:

```json
{
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",
    "**/Backup_Project/**",
    "**/Legacy_Extension/**"
  ]
}
```

##### 3. Excluding Multiple Projects with a Pattern

If your test projects follow a naming convention:

```json
{
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",
    "**/*Test*/**",
    "**/*Demo*/**",
    "**/*_old/**"
  ]
}
```

This excludes any folder containing:

- `Test` in its name (e.g., `MyTest`, `TestProject`, `IntegrationTests`)
- `Demo` in its name (e.g., `DemoApp`, `CustomerDemo`)
- `_old` in its name (e.g., `Project_old`, `Extension_old`)

##### 4. Excluding Top-Level Folders Only

To exclude only top-level folders (not nested ones):

```json
{
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",
    "archive/**",
    "backup/**"
  ]
}
```

> **Note:** Without the leading `**/`, the pattern only matches folders at the workspace root level.

##### 5. Excluding by File Pattern

To exclude specific AL files:

```json
{
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",
    "**/*.Test.al",
    "**/Temp*.al"
  ]
}
```

This excludes:

- Any AL file ending with `.Test.al` (e.g., `MyTable.Test.al`)
- Any AL file starting with `Temp` (e.g., `TempFile.al`, `Temporary.al`)

##### 6. Complex Multi-Root Workspace Scenario

For a workspace with multiple apps where you want to exclude specific ones:

**Workspace structure:**

```
workspace/
├── CoreApp/                ← Include ✅
├── SalesExtension/         ← Include ✅
├── InventoryExtension/     ← Include ✅
├── TestApps/              ← Exclude ❌
│   ├── CoreApp.Test/
│   └── SalesExtension.Test/
└── Archive/               ← Exclude ❌
    └── OldSalesExtension/
```

**Configuration:**

```json
{
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",
    "TestApps/**",
    "Archive/**"
  ]
}
```

#### Per-Folder Configuration (Multi-Root Workspaces)

Since `excludePatterns` has **resource scope**, you can configure different exclusions for each folder in a multi-root workspace:

**.code-workspace file:**

```json
{
  "folders": [
    {
      "path": "CoreApp",
      "settings": {
        "bcObjectRange.excludePatterns": [
          "**/node_modules/**",
          "**/.alpackages/**"
        ]
      }
    },
    {
      "path": "Extensions",
      "settings": {
        "bcObjectRange.excludePatterns": [
          "**/node_modules/**",
          "**/.alpackages/**",
          "**/Archived/**",
          "**/Test/**"
        ]
      }
    }
  ]
}
```

This allows the `CoreApp` folder to analyze everything, while the `Extensions` folder excludes archived and test projects.

#### Troubleshooting Exclude Patterns

##### Issue: Workspace Root Folder Not Being Excluded

**Problem:** You added a folder to your workspace using "Add Folder to Workspace" and patterns like `**/App_FaultyItems/**` don't exclude it.

**Solution:** Use the `excludeFolders` setting instead:

```json
{
  "bcObjectRange.excludeFolders": ["App_FaultyItems"]
}
```

**Why this happens:** VS Code's `findFiles` API evaluates glob patterns relative to each workspace root. When `App_FaultyItems` is a workspace root, the path to its `app.json` is just `app.json` (not `App_FaultyItems/app.json`), so the pattern doesn't match.

The `excludeFolders` setting solves this by checking folder names anywhere in the absolute path.

##### Issue: Project Still Appearing After Exclusion

**Solution:** Try these approaches in order:

1. **First, try `excludeFolders`** (simplest for folder names):

   ```json
   { "bcObjectRange.excludeFolders": ["FolderName"] }
   ```

2. **If that doesn't work, check your glob pattern:**
   - Use `**/` prefix for folders at any level
   - Test with a simpler pattern first (e.g., `**/FolderName/**`)

**Example:**

```
Workspace root: C:\Users\...\MyWorkspace\
Project path:   C:\Users\...\MyWorkspace\Apps\TestApp\

Correct pattern:   "**/TestApp/**" or "Apps/TestApp/**"
Incorrect pattern: "TestApp/**" (won't match as it's not at root)
```

##### Issue: Too Many Projects Excluded

**Solution:** Be more specific with your patterns:

```json
// ❌ Too broad - excludes all folders with "Test" anywhere
"**/*Test*/**"

// ✅ More specific - only excludes folders ending with "Test"
"**/*Test/"
```

##### Issue: Exclude Pattern Not Working

**Checklist:**

1. ✅ Pattern uses forward slashes (`/`) not backslashes (`\`)
2. ✅ Pattern is in a JSON array (`["pattern1", "pattern2"]`)
3. ✅ VS Code settings are saved
4. ✅ Extension has been refreshed (run "BC Object Range: Refresh" command)

#### Verification

After configuring exclude patterns, verify they work correctly:

1. Open the **BC Object Range** view in the Activity Bar
2. Check which projects appear under "Used Object IDs"
3. If a project still appears but shouldn't:
   - Right-click the project folder → **Copy Path**
   - Compare the path with your exclude pattern
   - Adjust the pattern to match the actual folder structure

#### Performance Tip

Excluding unnecessary folders improves scan performance, especially for large workspaces:

```json
{
  "bcObjectRange.excludePatterns": [
    // Standard exclusions
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**",

    // Build outputs
    "**/.output/**",
    "**/bin/**",
    "**/obj/**",

    // Archives and backups
    "**/archive/**",
    "**/backup/**",
    "**/.git/**"
  ]
}
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
    { "path": "inventory-app" },
    { "path": "test-app" }
  ],
  "settings": {
    "bcObjectRange.sharedRangeMode": true,
    "bcObjectRange.autoRefresh": true,
    "bcObjectRange.autoRefreshDelay": 500,
    "bcObjectRange.excludeFolders": ["test-app"]
  }
}
```

### Example: User/Workspace settings.json

```json
{
  "bcObjectRange.autoRefresh": true,
  "bcObjectRange.autoRefreshDelay": 500,
  "bcObjectRange.sharedRangeMode": true,
  "bcObjectRange.excludeFolders": ["App_FaultyItems", "TestApps"],
  "bcObjectRange.excludePatterns": [
    "**/node_modules/**",
    "**/.altestrunner/**",
    "**/.alpackages/**"
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

### Field and Enum Value Conflict Detection

In shared mode, the extension also detects conflicts within **tableextension fields** and **enumextension values**. This is crucial for OnPrem scenarios where multiple apps extend the same base table or enum.

#### Why Field/Value Conflicts Matter

In AL, when multiple apps extend the same base object:

- **Tableextension fields**: Each field ID within extensions of the same base table must be unique across all apps
- **Enumextension values**: Each value ID within extensions of the same base enum must be unique across all apps

For example, if App1 and App2 both extend `"Customer"` table:

- App1: `tableextension 50000 extends "Customer" { fields { field(50100; "Custom Field 1"; Text[50]) } }`
- App2: `tableextension 50001 extends "Customer" { fields { field(50100; "Custom Field 2"; Text[50]) } }` ← **Conflict!**

Both use field ID `50100` in extensions of the same base table — this will cause a runtime conflict.

#### Field Conflicts View

The extension detects and displays these conflicts in the Used IDs view:

```
⚠️ Field Conflicts (2 conflicts)
├── ❌ field 50100 in "Customer" extensions
│   ├── 📄 App1.CustomerExt (50000) → "Custom Field 1"
│   └── 📄 App2.CustomerExt (50001) → "Custom Field 2"
└── ❌ field 50200 in "Sales Header" extensions
    ├── 📄 App1.SalesExt (50010) → "Extra Field"
    └── 📄 App3.SalesExt (50011) → "Another Field"

⚠️ Enum Value Conflicts (1 conflict)
└── ❌ value 5 in "Sales Document Type" extensions
    ├── 📄 App1.DocTypeExt (50000) → "Custom Type 1"
    └── 📄 App2.DocTypeExt (50001) → "Custom Type 2"
```

#### How It Works

1. **Field Parsing**: The extension parses `fields { }` blocks in tables and tableextensions to extract field IDs, names, and data types
2. **Value Parsing**: The extension parses `value()` declarations in enums and enumextensions to extract value IDs and names
3. **Extends Detection**: For tableextensions and enumextensions, the extension detects which base object is being extended (e.g., `extends "Customer"`)
4. **Cross-Project Analysis**: Fields and values are grouped by `baseObject:fieldId` or `baseEnum:valueId`
5. **Conflict Detection**: A conflict is flagged when the same ID is used in extensions from different projects that extend the same base object

#### Supported Declarations

**Table/Tableextension fields:**

```al
table 50000 "My Table" {
    fields {
        field(1; "Primary Key"; Code[20]) { }
        field(50100; "Custom Field"; Text[100]) { }
    }
}

tableextension 50000 "Customer Ext" extends "Customer" {
    fields {
        field(50100; "Custom Field"; Text[100]) { }
    }
}
```

**Enum/Enumextension values:**

```al
enum 50000 "My Enum" {
    value(0; "None") { }
    value(1; "Option A") { }
}

enumextension 50000 "Doc Type Ext" extends "Sales Document Type" {
    value(50; "Custom Document") { }
}
```

> **Note:** Field and enum value conflict detection is only active in **Shared Range Mode** (`bcObjectRange.sharedRangeMode: true`).

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
- The folder isn't excluded by `bcObjectRange.excludeFolders` or `bcObjectRange.excludePatterns`

### Q: How do I exclude a workspace root folder?

**A:** Use the `excludeFolders` setting with the folder name:

```json
{
  "bcObjectRange.excludeFolders": ["App_FaultyItems"]
}
```

This is more reliable than glob patterns for workspace root folders. See the [Excluding Projects from Analysis](#excluding-projects-from-analysis) section for details.

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

### 0.5.0

- **NEW:** `excludeFolders` setting - Simple folder name exclusion for workspace root folders
  - Matches folder names anywhere in the path (case-insensitive)
  - Ideal for excluding workspace root folders added via "Add Folder to Workspace"
  - Simpler alternative to glob patterns for common use cases
- **IMPROVED:** `excludePatterns` now works for workspace root folders via post-filtering
  - Uses `minimatch` for reliable glob pattern matching
  - Patterns are matched against the full absolute path
- **IMPROVED:** Comprehensive documentation for exclusion settings with examples

### 0.3.0

- **NEW:** IntelliSense ID Suggestions - Automatic completion suggestions for the next available object ID when typing AL object declarations
  - Triggers on space after object type keyword or with manual IntelliSense (`Ctrl+Space`)
  - Works in both normal mode and shared mode
  - Supports all 13 object types that require IDs
- **IMPROVED:** Extension now activates on `onLanguage:al` for immediate IntelliSense support
- **IMPROVED:** Project detection prefers the most specific project for nested paths

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
