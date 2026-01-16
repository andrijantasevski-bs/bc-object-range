import * as assert from "assert";
import { minimatch } from "minimatch";

/**
 * Standalone exclusion logic for unit testing.
 * This mirrors the logic in WorkspaceScanner.shouldExcludeProject()
 * but without VS Code dependencies.
 */
class ExclusionTester {
  private excludePatterns: string[];
  private excludeFolders: string[];

  constructor(excludePatterns: string[] = [], excludeFolders: string[] = []) {
    this.excludePatterns = excludePatterns;
    this.excludeFolders = excludeFolders;
  }

  /**
   * Determine if a project should be excluded based on its file path.
   * This handles both excludePatterns (glob patterns) and excludeFolders (folder names).
   *
   * @param projectPath - The absolute path to the app.json file or project root
   * @returns true if the project should be excluded, false otherwise
   */
  public shouldExcludeProject(projectPath: string): boolean {
    // Normalize path for consistent matching (use forward slashes)
    const normalizedPath = projectPath.replace(/\\/g, "/");

    // Check excludeFolders (simple folder name matching)
    if (this.excludeFolders.length > 0) {
      // Get all path segments
      const pathSegments = normalizedPath
        .split("/")
        .filter((s) => s.length > 0);

      for (const folderName of this.excludeFolders) {
        // Check if any segment matches the folder name (case-insensitive)
        const normalizedFolderName = folderName.toLowerCase();
        if (
          pathSegments.some(
            (segment) => segment.toLowerCase() === normalizedFolderName,
          )
        ) {
          return true;
        }
      }
    }

    // Check excludePatterns (glob pattern matching against full path)
    for (const pattern of this.excludePatterns) {
      if (minimatch(normalizedPath, pattern, { dot: true, nocase: true })) {
        return true;
      }
    }

    return false;
  }
}

suite("Exclusion Logic Test Suite", () => {
  suite("excludeFolders Setting", () => {
    test("should exclude project by exact folder name", () => {
      const tester = new ExclusionTester([], ["App_FaultyItems"]);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/App_FaultyItems/app.json"),
        true,
        "Should exclude project with matching folder name",
      );
    });

    test("should exclude project by folder name (case-insensitive)", () => {
      const tester = new ExclusionTester([], ["app_faultyitems"]);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/App_FaultyItems/app.json"),
        true,
        "Should match case-insensitively",
      );
    });

    test("should NOT exclude project with non-matching folder name", () => {
      const tester = new ExclusionTester([], ["App_FaultyItems"]);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/CoreApp/app.json"),
        false,
        "Should not exclude project with different folder name",
      );
    });

    test("should exclude nested project matching folder name", () => {
      const tester = new ExclusionTester([], ["TestApps"]);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/TestApps/MyTest/app.json"),
        true,
        "Should exclude nested projects under matching folder",
      );
    });

    test("should exclude project when folder appears anywhere in path", () => {
      const tester = new ExclusionTester([], ["Archive"]);

      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/workspace/Projects/Archive/OldApp/app.json",
        ),
        true,
        "Should exclude when folder name appears in middle of path",
      );
    });

    test("should handle multiple excludeFolders", () => {
      const tester = new ExclusionTester(
        [],
        ["App_FaultyItems", "TestApp", "Archive"],
      );

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/App_FaultyItems/app.json"),
        true,
        "Should exclude first folder",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/TestApp/app.json"),
        true,
        "Should exclude second folder",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/Archive/old/app.json"),
        true,
        "Should exclude third folder",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/CoreApp/app.json"),
        false,
        "Should not exclude non-matching folder",
      );
    });

    test("should handle empty excludeFolders array", () => {
      const tester = new ExclusionTester([], []);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/AnyFolder/app.json"),
        false,
        "Should not exclude anything with empty excludeFolders",
      );
    });

    test("should handle Windows-style paths with backslashes", () => {
      const tester = new ExclusionTester([], ["App_FaultyItems"]);

      assert.strictEqual(
        tester.shouldExcludeProject("C:\\workspace\\App_FaultyItems\\app.json"),
        true,
        "Should handle backslash path separators",
      );
    });

    test("should NOT match partial folder names", () => {
      const tester = new ExclusionTester([], ["Test"]);

      // "Test" should not match "TestApp" or "MyTest"
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/TestApp/app.json"),
        false,
        "Should not match partial folder name (prefix)",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/MyTest/app.json"),
        false,
        "Should not match partial folder name (suffix)",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/Test/app.json"),
        true,
        "Should match exact folder name",
      );
    });
  });

  suite("excludePatterns Setting", () => {
    test("should exclude with double-star glob pattern", () => {
      const tester = new ExclusionTester(["**/App_FaultyItems/**"], []);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/App_FaultyItems/app.json"),
        true,
        "Should match **/ pattern for workspace root folder",
      );
    });

    test("should exclude nested folders with glob pattern", () => {
      const tester = new ExclusionTester(["**/node_modules/**"], []);

      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/workspace/project/node_modules/dep/app.json",
        ),
        true,
        "Should match nested node_modules",
      );
    });

    test("should exclude with folder-only glob pattern", () => {
      const tester = new ExclusionTester(["**/TestApps/**"], []);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/TestApps/MyTest/app.json"),
        true,
        "Should match folder pattern",
      );
    });

    test("should exclude with wildcard in folder name", () => {
      const tester = new ExclusionTester(["**/*Test*/**"], []);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/MyTestApp/app.json"),
        true,
        "Should match wildcard in folder name",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/IntegrationTests/app.json"),
        true,
        "Should match wildcard in folder name",
      );
    });

    test("should handle multiple excludePatterns", () => {
      const tester = new ExclusionTester(
        ["**/node_modules/**", "**/.alpackages/**", "**/TestApps/**"],
        [],
      );

      assert.strictEqual(
        tester.shouldExcludeProject("C:/proj/node_modules/x/app.json"),
        true,
        "Should exclude node_modules",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/proj/.alpackages/y/app.json"),
        true,
        "Should exclude .alpackages",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/proj/TestApps/z/app.json"),
        true,
        "Should exclude TestApps",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/proj/CoreApp/app.json"),
        false,
        "Should not exclude valid project",
      );
    });

    test("should handle glob patterns case-insensitively", () => {
      const tester = new ExclusionTester(["**/testapps/**"], []);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/TestApps/app.json"),
        true,
        "Should match case-insensitively",
      );
    });

    test("should handle dot files and folders", () => {
      const tester = new ExclusionTester(["**/.altestrunner/**"], []);

      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/workspace/project/.altestrunner/app.json",
        ),
        true,
        "Should match dot folders",
      );
    });
  });

  suite("Combined excludePatterns and excludeFolders", () => {
    test("should exclude if matching excludeFolders", () => {
      const tester = new ExclusionTester(
        ["**/node_modules/**"],
        ["App_FaultyItems"],
      );

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/App_FaultyItems/app.json"),
        true,
        "Should exclude based on excludeFolders",
      );
    });

    test("should exclude if matching excludePatterns", () => {
      const tester = new ExclusionTester(
        ["**/node_modules/**"],
        ["App_FaultyItems"],
      );

      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/workspace/CoreApp/node_modules/dep/app.json",
        ),
        true,
        "Should exclude based on excludePatterns",
      );
    });

    test("should NOT exclude if neither matches", () => {
      const tester = new ExclusionTester(
        ["**/node_modules/**"],
        ["App_FaultyItems"],
      );

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/CoreApp/app.json"),
        false,
        "Should not exclude valid project",
      );
    });

    test("should check excludeFolders before excludePatterns", () => {
      const tester = new ExclusionTester([], ["CoreApp"]);

      // Even though there's no pattern matching, excludeFolders should still work
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/CoreApp/app.json"),
        true,
        "Should exclude based on excludeFolders even without patterns",
      );
    });
  });

  suite("Edge Cases", () => {
    test("should handle empty path", () => {
      const tester = new ExclusionTester(["**/node_modules/**"], ["TestApp"]);

      assert.strictEqual(
        tester.shouldExcludeProject(""),
        false,
        "Should not crash on empty path",
      );
    });

    test("should handle path with only file name", () => {
      const tester = new ExclusionTester([], ["app.json"]);

      assert.strictEqual(
        tester.shouldExcludeProject("app.json"),
        true,
        "Should handle simple file path",
      );
    });

    test("should handle root path", () => {
      const tester = new ExclusionTester(["**/TestApp/**"], []);

      assert.strictEqual(
        tester.shouldExcludeProject("/app.json"),
        false,
        "Should not crash on root path",
      );
    });

    test("should handle path with special characters", () => {
      const tester = new ExclusionTester([], ["My App (Test)"]);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/My App (Test)/app.json"),
        true,
        "Should handle special characters in folder name",
      );
    });

    test("should handle very long paths", () => {
      const tester = new ExclusionTester([], ["deep"]);
      const longPath =
        "C:/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/deep/app.json";

      assert.strictEqual(
        tester.shouldExcludeProject(longPath),
        true,
        "Should handle long paths",
      );
    });

    test("should handle mixed path separators", () => {
      const tester = new ExclusionTester([], ["TestApp"]);

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace\\TestApp/sub\\app.json"),
        true,
        "Should handle mixed path separators",
      );
    });

    test("should handle UNC paths", () => {
      const tester = new ExclusionTester([], ["TestApp"]);

      assert.strictEqual(
        tester.shouldExcludeProject(
          "//server/share/workspace/TestApp/app.json",
        ),
        true,
        "Should handle UNC paths",
      );
    });

    test("should handle drive letters", () => {
      const tester = new ExclusionTester([], ["TestApp"]);

      assert.strictEqual(
        tester.shouldExcludeProject("D:/projects/TestApp/app.json"),
        true,
        "Should handle different drive letters",
      );
    });
  });

  suite("Real-World Scenarios", () => {
    test("Scenario: Multi-root workspace with test apps", () => {
      // User has: CoreApp, SalesExtension, TestApps/CoreApp.Test, TestApps/Sales.Test
      const tester = new ExclusionTester(
        ["**/node_modules/**", "**/.alpackages/**"],
        ["TestApps"],
      );

      // Include these
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/CoreApp/app.json"),
        false,
        "Should include CoreApp",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/SalesExtension/app.json"),
        false,
        "Should include SalesExtension",
      );

      // Exclude these
      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/workspace/TestApps/CoreApp.Test/app.json",
        ),
        true,
        "Should exclude CoreApp.Test under TestApps",
      );
      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/workspace/TestApps/Sales.Test/app.json",
        ),
        true,
        "Should exclude Sales.Test under TestApps",
      );
    });

    test("Scenario: Excluding specific workspace root folder", () => {
      // User's original issue: Want to exclude App_FaultyItems workspace root
      const tester = new ExclusionTester(
        ["**/node_modules/**", "**/.alpackages/**"],
        ["App_FaultyItems"],
      );

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/CoreApp/app.json"),
        false,
        "Should include CoreApp",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/App_FaultyItems/app.json"),
        true,
        "Should exclude App_FaultyItems",
      );
    });

    test("Scenario: Excluding archived projects", () => {
      const tester = new ExclusionTester(
        ["**/node_modules/**", "**/_archive/**", "**/*_old/**"],
        [],
      );

      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/CoreApp/app.json"),
        false,
        "Should include active project",
      );
      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/workspace/_archive/OldProject/app.json",
        ),
        true,
        "Should exclude _archive folder",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/SalesExtension_old/app.json"),
        true,
        "Should exclude *_old folder",
      );
    });

    test("Scenario: OnPrem with shared ranges and demo apps", () => {
      const tester = new ExclusionTester(
        ["**/node_modules/**", "**/.alpackages/**", "**/.altestrunner/**"],
        ["DemoApps", "Sandbox", "Archive"],
      );

      // Production apps - include
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/Core/app.json"),
        false,
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/Sales/app.json"),
        false,
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/Inventory/app.json"),
        false,
      );

      // Demo/test apps - exclude
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/DemoApps/Demo1/app.json"),
        true,
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/Sandbox/Test/app.json"),
        true,
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/workspace/Archive/OldCore/app.json"),
        true,
      );
    });

    test("Scenario: Default patterns should work", () => {
      const tester = new ExclusionTester(
        ["**/node_modules/**", "**/.altestrunner/**", "**/.alpackages/**"],
        [],
      );

      assert.strictEqual(
        tester.shouldExcludeProject("C:/project/node_modules/dep/app.json"),
        true,
        "Should exclude node_modules",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/project/.altestrunner/cache/app.json"),
        true,
        "Should exclude .altestrunner",
      );
      assert.strictEqual(
        tester.shouldExcludeProject(
          "C:/project/.alpackages/Microsoft/app.json",
        ),
        true,
        "Should exclude .alpackages",
      );
      assert.strictEqual(
        tester.shouldExcludeProject("C:/project/src/app.json"),
        false,
        "Should include normal src folder",
      );
    });
  });
});
