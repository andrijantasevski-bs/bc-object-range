# BC Object Range Analyzer

A Visual Studio Code extension for analyzing AL object ID range usage in Business Central projects.

## Features

- **Object Range Overview**: Scans all AL projects in your workspace and displays used object IDs organized by app and object type
- **Unused ID Detection**: Shows gaps in your configured ID ranges so you can easily find available IDs
- **Multi-Project Support**: Works with multi-root workspaces containing multiple AL apps
- **Auto-Refresh**: Automatically updates when AL files change (configurable)
- **Click to Navigate**: Click on any object to open its source file at the declaration line
- **Copy Next ID**: Quickly copy the next available ID to your clipboard

## Supported Object Types

The extension recognizes all AL object types that require numeric IDs:

| Object Type            | Example                                                 |
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

## Usage

### Views

The extension adds a new icon in the Activity Bar (sidebar) with two views:

1. **Used Object IDs**: Shows all detected AL objects organized by:

   - App (from app.json name)
     - Object Type (Table, Page, Codeunit, etc.)
       - Individual objects (ID + Name)

2. **Unused IDs / Gaps**: Shows available ID ranges within your configured `idRanges` from app.json

### Commands

Available from the Command Palette (`Ctrl+Shift+P`):

- **BC Object Range: Analyze Object Ranges** - Manually trigger a full workspace scan
- **BC Object Range: Refresh** - Force refresh the views

### Configuration

| Setting                          | Default                                                              | Description                                |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `bcObjectRange.autoRefresh`      | `true`                                                               | Automatically refresh when AL files change |
| `bcObjectRange.autoRefreshDelay` | `300`                                                                | Delay in milliseconds before auto-refresh  |
| `bcObjectRange.excludePatterns`  | `["**/node_modules/**", "**/.altestrunner/**", "**/.alpackages/**"]` | Glob patterns to exclude                   |

## How It Works

1. The extension detects AL projects by looking for `app.json` files
2. It reads `idRanges` (or `idRange`) from app.json to know your configured ranges
3. All `.al` files are parsed to extract object declarations
4. Comments (both `//` and `/* */`) are properly handled to avoid false positives
5. Objects are sorted by ID and grouped by type

## Project Detection

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

## Comment Handling

The parser correctly ignores commented-out object declarations:

```al
// table 50000 "Commented Out" { }  -- Ignored

/*
page 50001 "Also Commented" { }     -- Ignored
*/

table 50002 "Real Object" { }       -- Detected
```

## Multiple Objects Per File

The extension handles files containing multiple object declarations:

```al
table 50000 "First Table" { }
table 50001 "Second Table" { }
page 50000 "My Page" { }
```

All three objects will be detected and listed.

## Requirements

- Visual Studio Code 1.74.0 or higher
- AL projects with valid `app.json` files

## Known Limitations

- Objects without IDs (interface, controladdin, profile, etc.) are not tracked
- The extension only reads `idRanges` from app.json; it doesn't validate if objects are within range

## Release Notes

### 0.0.1

- Initial release
- Support for all 13 AL object types with IDs
- Two-view interface (Used IDs, Unused Gaps)
- Auto-refresh with configurable debounce
- Comment-aware parsing
- Multi-project workspace support

## Contributing

Found a bug or have a feature request? Please open an issue on the repository.

## License

MIT
