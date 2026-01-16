import * as assert from "assert";
import {
  ALProject,
  ALObject,
  IdRange,
  ALObjectTypeWithId,
  AL_OBJECT_TYPES_WITH_ID,
  AL_OBJECT_TYPES_WITHOUT_ID,
} from "../../types/index.js";

/**
 * Mock WorkspaceScanner for testing the completion provider logic
 */
class MockWorkspaceScanner {
  /**
   * Calculate unused ID gaps within configured ranges for a project
   */
  public calculateGaps(
    project: ALProject
  ): { start: number; end: number; count: number }[] {
    const gaps: { start: number; end: number; count: number }[] = [];

    if (project.idRanges.length === 0) {
      return gaps;
    }

    const usedIds = new Set(project.objects.map((obj) => obj.id));

    for (const range of project.idRanges) {
      let gapStart: number | null = null;

      for (let id = range.from; id <= range.to; id++) {
        if (!usedIds.has(id)) {
          if (gapStart === null) {
            gapStart = id;
          }
        } else {
          if (gapStart !== null) {
            gaps.push({
              start: gapStart,
              end: id - 1,
              count: id - gapStart,
            });
            gapStart = null;
          }
        }
      }

      if (gapStart !== null) {
        gaps.push({
          start: gapStart,
          end: range.to,
          count: range.to - gapStart + 1,
        });
      }
    }

    return gaps;
  }

  /**
   * Get the next available ID in a project's ranges
   */
  public getNextAvailableId(project: ALProject): number | null {
    const gaps = this.calculateGaps(project);
    if (gaps.length === 0) {
      return null;
    }
    return gaps[0].start;
  }

  /**
   * Get the union of all ID ranges across all projects
   */
  public getSharedRanges(projects: ALProject[]): IdRange[] {
    const allRanges: IdRange[] = [];
    for (const project of projects) {
      allRanges.push(...project.idRanges);
    }

    if (allRanges.length === 0) {
      return [];
    }

    allRanges.sort((a, b) => a.from - b.from);

    const merged: IdRange[] = [{ ...allRanges[0] }];

    for (let i = 1; i < allRanges.length; i++) {
      const current = allRanges[i];
      const last = merged[merged.length - 1];

      if (current.from <= last.to + 1) {
        last.to = Math.max(last.to, current.to);
      } else {
        merged.push({ ...current });
      }
    }

    return merged;
  }

  /**
   * Calculate gaps for a specific object type across all projects (shared mode)
   */
  public calculateSharedGaps(
    projects: ALProject[],
    objectType: ALObjectTypeWithId
  ): {
    start: number;
    end: number;
    count: number;
    objectType: ALObjectTypeWithId;
  }[] {
    const gaps: {
      start: number;
      end: number;
      count: number;
      objectType: ALObjectTypeWithId;
    }[] = [];
    const sharedRanges = this.getSharedRanges(projects);

    if (sharedRanges.length === 0) {
      return gaps;
    }

    const usedIds = new Set<number>();
    for (const project of projects) {
      for (const obj of project.objects) {
        if (obj.type === objectType) {
          usedIds.add(obj.id);
        }
      }
    }

    for (const range of sharedRanges) {
      let gapStart: number | null = null;

      for (let id = range.from; id <= range.to; id++) {
        if (!usedIds.has(id)) {
          if (gapStart === null) {
            gapStart = id;
          }
        } else {
          if (gapStart !== null) {
            gaps.push({
              start: gapStart,
              end: id - 1,
              count: id - gapStart,
              objectType,
            });
            gapStart = null;
          }
        }
      }

      if (gapStart !== null) {
        gaps.push({
          start: gapStart,
          end: range.to,
          count: range.to - gapStart + 1,
          objectType,
        });
      }
    }

    return gaps;
  }

  /**
   * Get the next available ID for a specific object type across all projects (shared mode)
   */
  public getNextAvailableIdForType(
    projects: ALProject[],
    objectType: ALObjectTypeWithId
  ): number | null {
    const gaps = this.calculateSharedGaps(projects, objectType);
    if (gaps.length === 0) {
      return null;
    }
    return gaps[0].start;
  }
}

/**
 * Simplified completion provider logic for testing
 * (without VS Code dependencies)
 */
class TestableCompletionProvider {
  private projects: ALProject[] = [];
  private scanner: MockWorkspaceScanner;

  constructor() {
    this.scanner = new MockWorkspaceScanner();
  }

  public setProjects(projects: ALProject[]): void {
    this.projects = projects;
  }

  /**
   * Match an AL object type keyword at the end of the text
   * Also checks indentation - real object declarations should have minimal indentation.
   */
  public matchObjectType(text: string): string | null {
    const trimmed = text.trimEnd();

    // Check indentation - real object declarations should have minimal indentation
    // (0-3 spaces or no tabs). Content inside objects is typically indented more.
    const leadingWhitespace = text.match(/^(\s*)/)?.[1] || "";
    const spaceCount = leadingWhitespace.replace(/\t/g, "    ").length;
    if (spaceCount > 3) {
      return null;
    }

    for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
      const regex = new RegExp(`^\\s*${objectType}\\s*$`, "i");
      if (regex.test(trimmed)) {
        return objectType;
      }
    }

    return null;
  }

  /**
   * Check if the cursor position is at file root level (not inside an object body).
   * This is determined by counting unmatched opening braces in preceding lines.
   *
   * @param documentLines Array of lines in the document
   * @param currentLine The current line number (0-based)
   * @returns true if at file root level, false if inside an object body
   */
  public isAtFileRootLevel(
    documentLines: string[],
    currentLine: number
  ): boolean {
    let braceDepth = 0;

    // Limit scan to prevent performance issues on large files
    const maxLinesToScan = Math.min(currentLine, 500);
    const startLine = currentLine - maxLinesToScan;

    for (let i = startLine; i < currentLine; i++) {
      braceDepth += this.countBraceBalance(documentLines[i]);
    }

    // If brace depth is 0, we're at file root level
    return braceDepth === 0;
  }

  /**
   * Count the brace balance for a line of text.
   * Returns positive for more opening braces, negative for more closing braces.
   * Ignores braces inside strings and comments.
   */
  public countBraceBalance(line: string): number {
    let balance = 0;
    let inString = false;
    let inSingleLineComment = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      // Check for single-line comment start
      if (!inString && char === "/" && nextChar === "/") {
        inSingleLineComment = true;
        break; // Rest of line is comment
      }

      // Check for string delimiter (AL uses single quotes for strings)
      if (!inSingleLineComment && char === "'") {
        inString = !inString;
        continue;
      }

      // Count braces only when not in string or comment
      if (!inString && !inSingleLineComment) {
        if (char === "{") {
          balance++;
        } else if (char === "}") {
          balance--;
        }
      }
    }

    return balance;
  }

  /**
   * Simulate the full completion check including scope detection
   * Returns true if completion should be provided, false otherwise
   */
  public shouldProvideCompletion(
    documentLines: string[],
    currentLine: number,
    textBeforeCursor: string
  ): boolean {
    const objectTypeMatch = this.matchObjectType(textBeforeCursor);
    if (!objectTypeMatch) {
      return false;
    }
    return this.isAtFileRootLevel(documentLines, currentLine);
  }

  /**
   * Find the project for a document path
   * When multiple projects match (nested paths), prefer the longest/most specific match
   */
  public findProjectForPath(documentPath: string): ALProject | undefined {
    let bestMatch: ALProject | undefined;
    let bestMatchLength = 0;

    for (const project of this.projects) {
      if (documentPath.startsWith(project.rootPath)) {
        if (project.rootPath.length > bestMatchLength) {
          bestMatch = project;
          bestMatchLength = project.rootPath.length;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get the next available ID for normal mode
   */
  public getNextAvailableId(project: ALProject): number | null {
    return this.scanner.getNextAvailableId(project);
  }

  /**
   * Get the next available ID for shared mode
   */
  public getNextAvailableIdForType(
    objectType: ALObjectTypeWithId
  ): number | null {
    return this.scanner.getNextAvailableIdForType(this.projects, objectType);
  }

  /**
   * Check if the given text matches an AL object type that requires an ID
   */
  public static matchesObjectTypeWithId(
    text: string
  ): ALObjectTypeWithId | null {
    const trimmed = text.trim().toLowerCase();
    for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
      if (trimmed === objectType) {
        return objectType;
      }
    }
    return null;
  }
}

suite("Completion Provider Test Suite", () => {
  let provider: TestableCompletionProvider;

  setup(() => {
    provider = new TestableCompletionProvider();
  });

  /**
   * Helper to create a test project
   */
  function createTestProject(
    name: string,
    rootPath: string,
    idRanges: IdRange[],
    objects: Partial<ALObject>[] = []
  ): ALProject {
    return {
      name,
      rootPath,
      idRanges,
      objects: objects.map((obj, index) => ({
        type: (obj.type || "table") as ALObjectTypeWithId,
        id: obj.id || 50000 + index,
        name: obj.name || `Object${index}`,
        lineNumber: obj.lineNumber || 1,
        filePath: obj.filePath || `${rootPath}/obj${index}.al`,
      })),
    };
  }

  suite("Object Type Matching", () => {
    test("should match 'codeunit' keyword", () => {
      const result = provider.matchObjectType("codeunit");
      assert.strictEqual(result, "codeunit");
    });

    test("should match 'Codeunit' keyword (case insensitive)", () => {
      const result = provider.matchObjectType("Codeunit");
      assert.strictEqual(result, "codeunit");
    });

    test("should match 'CODEUNIT' keyword (case insensitive)", () => {
      const result = provider.matchObjectType("CODEUNIT");
      assert.strictEqual(result, "codeunit");
    });

    test("should match 'table' keyword", () => {
      const result = provider.matchObjectType("table");
      assert.strictEqual(result, "table");
    });

    test("should match 'page' keyword", () => {
      const result = provider.matchObjectType("page");
      assert.strictEqual(result, "page");
    });

    test("should match 'report' keyword", () => {
      const result = provider.matchObjectType("report");
      assert.strictEqual(result, "report");
    });

    test("should match 'xmlport' keyword", () => {
      const result = provider.matchObjectType("xmlport");
      assert.strictEqual(result, "xmlport");
    });

    test("should match 'query' keyword", () => {
      const result = provider.matchObjectType("query");
      assert.strictEqual(result, "query");
    });

    test("should match 'enum' keyword", () => {
      const result = provider.matchObjectType("enum");
      assert.strictEqual(result, "enum");
    });

    test("should match 'tableextension' keyword", () => {
      const result = provider.matchObjectType("tableextension");
      assert.strictEqual(result, "tableextension");
    });

    test("should match 'pageextension' keyword", () => {
      const result = provider.matchObjectType("pageextension");
      assert.strictEqual(result, "pageextension");
    });

    test("should match 'reportextension' keyword", () => {
      const result = provider.matchObjectType("reportextension");
      assert.strictEqual(result, "reportextension");
    });

    test("should match 'enumextension' keyword", () => {
      const result = provider.matchObjectType("enumextension");
      assert.strictEqual(result, "enumextension");
    });

    test("should match 'permissionset' keyword", () => {
      const result = provider.matchObjectType("permissionset");
      assert.strictEqual(result, "permissionset");
    });

    test("should match 'permissionsetextension' keyword", () => {
      const result = provider.matchObjectType("permissionsetextension");
      assert.strictEqual(result, "permissionsetextension");
    });

    test("should match keyword with leading whitespace", () => {
      const result = provider.matchObjectType("   codeunit");
      assert.strictEqual(result, "codeunit");
    });

    test("should match keyword with trailing whitespace", () => {
      const result = provider.matchObjectType("codeunit   ");
      assert.strictEqual(result, "codeunit");
    });

    test("should match keyword with leading and trailing whitespace", () => {
      const result = provider.matchObjectType("   codeunit   ");
      assert.strictEqual(result, "codeunit");
    });

    test("should not match partial keyword", () => {
      const result = provider.matchObjectType("code");
      assert.strictEqual(result, null);
    });

    test("should not match keyword with extra text", () => {
      const result = provider.matchObjectType("codeunit 50000");
      assert.strictEqual(result, null);
    });

    test("should not match empty string", () => {
      const result = provider.matchObjectType("");
      assert.strictEqual(result, null);
    });

    test("should not match whitespace only", () => {
      const result = provider.matchObjectType("   ");
      assert.strictEqual(result, null);
    });

    test("should not match object types without IDs (interface)", () => {
      const result = provider.matchObjectType("interface");
      assert.strictEqual(result, null);
    });

    test("should not match object types without IDs (profile)", () => {
      const result = provider.matchObjectType("profile");
      assert.strictEqual(result, null);
    });

    test("should not match object types without IDs (controladdin)", () => {
      const result = provider.matchObjectType("controladdin");
      assert.strictEqual(result, null);
    });

    test("should not match object types without IDs (pagecustomization)", () => {
      const result = provider.matchObjectType("pagecustomization");
      assert.strictEqual(result, null);
    });

    test("should not match object types without IDs (entitlement)", () => {
      const result = provider.matchObjectType("entitlement");
      assert.strictEqual(result, null);
    });

    test("should not match object types without IDs (dotnet)", () => {
      const result = provider.matchObjectType("dotnet");
      assert.strictEqual(result, null);
    });
  });

  suite("Static matchesObjectTypeWithId", () => {
    test("should return the object type for valid types", () => {
      for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
        const result =
          TestableCompletionProvider.matchesObjectTypeWithId(objectType);
        assert.strictEqual(
          result,
          objectType,
          `Failed for type: ${objectType}`
        );
      }
    });

    test("should return null for object types without IDs", () => {
      for (const objectType of AL_OBJECT_TYPES_WITHOUT_ID) {
        const result =
          TestableCompletionProvider.matchesObjectTypeWithId(objectType);
        assert.strictEqual(result, null, `Should not match: ${objectType}`);
      }
    });

    test("should handle case insensitivity", () => {
      const result =
        TestableCompletionProvider.matchesObjectTypeWithId("CODEUNIT");
      assert.strictEqual(result, "codeunit");
    });

    test("should handle whitespace", () => {
      const result =
        TestableCompletionProvider.matchesObjectTypeWithId("  codeunit  ");
      assert.strictEqual(result, "codeunit");
    });

    test("should return null for invalid types", () => {
      const result =
        TestableCompletionProvider.matchesObjectTypeWithId("invalidtype");
      assert.strictEqual(result, null);
    });
  });

  suite("Project Detection", () => {
    test("should find project for document in project root", () => {
      const project = createTestProject("TestApp", "/workspace/TestApp", [
        { from: 50000, to: 50100 },
      ]);
      provider.setProjects([project]);

      const found = provider.findProjectForPath(
        "/workspace/TestApp/src/MyCodeunit.al"
      );
      assert.strictEqual(found?.name, "TestApp");
    });

    test("should find correct project in multi-project workspace", () => {
      const project1 = createTestProject("App1", "/workspace/App1", [
        { from: 50000, to: 50100 },
      ]);
      const project2 = createTestProject("App2", "/workspace/App2", [
        { from: 60000, to: 60100 },
      ]);
      provider.setProjects([project1, project2]);

      const found = provider.findProjectForPath(
        "/workspace/App2/src/MyTable.al"
      );
      assert.strictEqual(found?.name, "App2");
    });

    test("should return undefined for document outside any project", () => {
      const project = createTestProject("TestApp", "/workspace/TestApp", [
        { from: 50000, to: 50100 },
      ]);
      provider.setProjects([project]);

      const found = provider.findProjectForPath(
        "/other/location/MyCodeunit.al"
      );
      assert.strictEqual(found, undefined);
    });

    test("should return undefined when no projects are loaded", () => {
      provider.setProjects([]);

      const found = provider.findProjectForPath(
        "/workspace/TestApp/src/MyCodeunit.al"
      );
      assert.strictEqual(found, undefined);
    });
  });

  suite("Normal Mode - Next Available ID", () => {
    test("should return first ID when range is empty", () => {
      const project = createTestProject("TestApp", "/workspace/TestApp", [
        { from: 50000, to: 50100 },
      ]);
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, 50000);
    });

    test("should return next available ID after used IDs", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50100 }],
        [
          { id: 50000, type: "table" },
          { id: 50001, type: "page" },
          { id: 50002, type: "codeunit" },
        ]
      );
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, 50003);
    });

    test("should find gap in the middle of range", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50010 }],
        [
          { id: 50000, type: "table" },
          { id: 50001, type: "page" },
          { id: 50005, type: "codeunit" },
        ]
      );
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, 50002);
    });

    test("should return null when all IDs are used", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50002 }],
        [
          { id: 50000, type: "table" },
          { id: 50001, type: "page" },
          { id: 50002, type: "codeunit" },
        ]
      );
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, null);
    });

    test("should work with multiple ID ranges", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [
          { from: 50000, to: 50002 },
          { from: 60000, to: 60002 },
        ],
        [
          { id: 50000, type: "table" },
          { id: 50001, type: "page" },
          { id: 50002, type: "codeunit" },
        ]
      );
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, 60000);
    });

    test("should return null when no ranges are configured", () => {
      const project = createTestProject("TestApp", "/workspace/TestApp", []);
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, null);
    });
  });

  suite("Shared Mode - Next Available ID by Type", () => {
    test("should return first ID when no objects of type exist", () => {
      const project = createTestProject("TestApp", "/workspace/TestApp", [
        { from: 50000, to: 50100 },
      ]);
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, 50000);
    });

    test("should return next ID after used IDs of same type", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50100 }],
        [
          { id: 50000, type: "codeunit" },
          { id: 50001, type: "codeunit" },
        ]
      );
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, 50002);
    });

    test("should not consider IDs of different types", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50100 }],
        [
          { id: 50000, type: "table" },
          { id: 50001, type: "page" },
          { id: 50002, type: "report" },
        ]
      );
      provider.setProjects([project]);

      // Codeunit should still get 50000 since no codeunits are used
      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, 50000);
    });

    test("should merge ranges from multiple projects", () => {
      const project1 = createTestProject(
        "App1",
        "/workspace/App1",
        [{ from: 50000, to: 50010 }],
        [{ id: 50000, type: "codeunit" }]
      );
      const project2 = createTestProject(
        "App2",
        "/workspace/App2",
        [{ from: 50005, to: 50015 }],
        [{ id: 50001, type: "codeunit" }]
      );
      provider.setProjects([project1, project2]);

      // Next available codeunit ID should be 50002 (50000 and 50001 are used)
      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, 50002);
    });

    test("should return null when all IDs are used for type", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50002 }],
        [
          { id: 50000, type: "codeunit" },
          { id: 50001, type: "codeunit" },
          { id: 50002, type: "codeunit" },
        ]
      );
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, null);
    });

    test("should work independently for each object type", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50100 }],
        [
          { id: 50000, type: "codeunit" },
          { id: 50001, type: "codeunit" },
          { id: 50000, type: "table" },
        ]
      );
      provider.setProjects([project]);

      const codeunitId = provider.getNextAvailableIdForType("codeunit");
      const tableId = provider.getNextAvailableIdForType("table");

      assert.strictEqual(codeunitId, 50002); // After 50000, 50001 codeunits
      assert.strictEqual(tableId, 50001); // After 50000 table
    });

    test("should return null when no projects", () => {
      provider.setProjects([]);

      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, null);
    });
  });

  suite("All Object Types With ID", () => {
    // Test that all 13 object types are properly supported
    for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
      test(`should suggest ID for ${objectType}`, () => {
        const project = createTestProject("TestApp", "/workspace/TestApp", [
          { from: 50000, to: 50100 },
        ]);
        provider.setProjects([project]);

        const matched = provider.matchObjectType(objectType);
        assert.strictEqual(matched, objectType, `Should match ${objectType}`);

        const nextId = provider.getNextAvailableIdForType(objectType);
        assert.strictEqual(
          nextId,
          50000,
          `Should have next ID for ${objectType}`
        );
      });
    }
  });

  suite("Object Types Without ID Should Not Trigger Completion", () => {
    for (const objectType of AL_OBJECT_TYPES_WITHOUT_ID) {
      test(`should not suggest ID for ${objectType}`, () => {
        const matched = provider.matchObjectType(objectType);
        assert.strictEqual(matched, null, `Should not match ${objectType}`);
      });
    }
  });

  suite("Edge Cases", () => {
    test("should handle project with single ID range of size 1", () => {
      const project = createTestProject("TestApp", "/workspace/TestApp", [
        { from: 50000, to: 50000 },
      ]);
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, 50000);
    });

    test("should return null for single ID range when ID is used", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [{ from: 50000, to: 50000 }],
        [{ id: 50000, type: "table" }]
      );
      provider.setProjects([project]);

      const nextId = provider.getNextAvailableId(project);
      assert.strictEqual(nextId, null);
    });

    test("should handle overlapping ranges in multi-project workspace", () => {
      const project1 = createTestProject(
        "App1",
        "/workspace/App1",
        [{ from: 50000, to: 50050 }],
        [{ id: 50000, type: "codeunit" }]
      );
      const project2 = createTestProject(
        "App2",
        "/workspace/App2",
        [{ from: 50025, to: 50075 }],
        [{ id: 50025, type: "codeunit" }]
      );
      provider.setProjects([project1, project2]);

      // In shared mode, ranges merge: 50000-50075
      // Used codeunits: 50000, 50025
      // Next available: 50001
      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, 50001);
    });

    test("should handle non-contiguous ranges", () => {
      const project = createTestProject(
        "TestApp",
        "/workspace/TestApp",
        [
          { from: 50000, to: 50005 },
          { from: 60000, to: 60005 },
        ],
        [
          { id: 50000, type: "codeunit" },
          { id: 50001, type: "codeunit" },
          { id: 50002, type: "codeunit" },
          { id: 50003, type: "codeunit" },
          { id: 50004, type: "codeunit" },
          { id: 50005, type: "codeunit" },
        ]
      );
      provider.setProjects([project]);

      // All IDs in first range are used, should get 60000
      const nextId = provider.getNextAvailableIdForType("codeunit");
      assert.strictEqual(nextId, 60000);
    });

    test("should handle Windows-style paths", () => {
      const project = createTestProject("TestApp", "C:\\workspace\\TestApp", [
        { from: 50000, to: 50100 },
      ]);
      provider.setProjects([project]);

      const found = provider.findProjectForPath(
        "C:\\workspace\\TestApp\\src\\MyCodeunit.al"
      );
      assert.strictEqual(found?.name, "TestApp");
    });

    test("should handle nested project paths", () => {
      const project1 = createTestProject("Outer", "/workspace", [
        { from: 50000, to: 50100 },
      ]);
      const project2 = createTestProject("Inner", "/workspace/subdir/app", [
        { from: 60000, to: 60100 },
      ]);
      provider.setProjects([project1, project2]);

      // File in inner project should match inner project
      const foundInner = provider.findProjectForPath(
        "/workspace/subdir/app/src/test.al"
      );
      assert.strictEqual(foundInner?.name, "Inner");

      // File in outer project but not in inner should match outer
      const foundOuter = provider.findProjectForPath(
        "/workspace/other/test.al"
      );
      assert.strictEqual(foundOuter?.name, "Outer");
    });
  });

  suite("Indentation Check - False Positive Prevention", () => {
    test("should match keyword with no indentation", () => {
      const result = provider.matchObjectType("codeunit");
      assert.strictEqual(result, "codeunit");
    });

    test("should match keyword with 1 space indentation", () => {
      const result = provider.matchObjectType(" codeunit");
      assert.strictEqual(result, "codeunit");
    });

    test("should match keyword with 2 spaces indentation", () => {
      const result = provider.matchObjectType("  codeunit");
      assert.strictEqual(result, "codeunit");
    });

    test("should match keyword with 3 spaces indentation", () => {
      const result = provider.matchObjectType("   codeunit");
      assert.strictEqual(result, "codeunit");
    });

    test("should NOT match keyword with 4 spaces indentation", () => {
      const result = provider.matchObjectType("    codeunit");
      assert.strictEqual(result, null);
    });

    test("should NOT match keyword with 8 spaces indentation", () => {
      const result = provider.matchObjectType("        table");
      assert.strictEqual(result, null);
    });

    test("should NOT match keyword with tab indentation (counts as 4 spaces)", () => {
      const result = provider.matchObjectType("\tcodeunit");
      assert.strictEqual(result, null);
    });

    test("should NOT match keyword with multiple tabs", () => {
      const result = provider.matchObjectType("\t\tpage");
      assert.strictEqual(result, null);
    });
  });

  suite("Brace Balance Calculation", () => {
    test("should return 0 for empty line", () => {
      const balance = provider.countBraceBalance("");
      assert.strictEqual(balance, 0);
    });

    test("should return 1 for line with opening brace", () => {
      const balance = provider.countBraceBalance("codeunit 50000 MyCodeunit {");
      assert.strictEqual(balance, 1);
    });

    test("should return -1 for line with closing brace", () => {
      const balance = provider.countBraceBalance("}");
      assert.strictEqual(balance, -1);
    });

    test("should return 0 for balanced braces on same line", () => {
      const balance = provider.countBraceBalance("{ }");
      assert.strictEqual(balance, 0);
    });

    test("should ignore braces in single-line comments", () => {
      const balance = provider.countBraceBalance(
        "// this { comment } has braces"
      );
      assert.strictEqual(balance, 0);
    });

    test("should count braces before comment starts", () => {
      const balance = provider.countBraceBalance(
        "codeunit 50000 MyCodeunit { // comment with }"
      );
      assert.strictEqual(balance, 1);
    });

    test("should ignore braces in strings", () => {
      const balance = provider.countBraceBalance(
        "Message('This { is } a string');"
      );
      assert.strictEqual(balance, 0);
    });

    test("should handle nested braces", () => {
      const balance = provider.countBraceBalance(
        "procedure Test() { if (true) {"
      );
      assert.strictEqual(balance, 2);
    });
  });

  suite("File Root Level Detection", () => {
    test("should return true for empty document", () => {
      const lines: string[] = [];
      const result = provider.isAtFileRootLevel(lines, 0);
      assert.strictEqual(result, true);
    });

    test("should return true at start of document with no preceding content", () => {
      const lines = ["table "];
      const result = provider.isAtFileRootLevel(lines, 0);
      assert.strictEqual(result, true);
    });

    test("should return true after a closed object", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "    procedure Test()",
        "    {",
        "    }",
        "}",
        "table ", // Cursor here - this is at file root level
      ];
      const result = provider.isAtFileRootLevel(lines, 6);
      assert.strictEqual(result, true);
    });

    test("should return false inside an object body", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "    table ", // Cursor here - this is inside the codeunit
      ];
      const result = provider.isAtFileRootLevel(lines, 2);
      assert.strictEqual(result, false);
    });

    test("should return false inside nested braces", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "    procedure Test()",
        "    {",
        "        table ", // Cursor here - inside procedure
      ];
      const result = provider.isAtFileRootLevel(lines, 4);
      assert.strictEqual(result, false);
    });

    test("should return true when all braces are balanced", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "    procedure Test()",
        "    {",
        "    }",
        "}",
        "", // Empty line between objects
        "page ", // Cursor here
      ];
      const result = provider.isAtFileRootLevel(lines, 7);
      assert.strictEqual(result, true);
    });
  });

  suite("Scope Detection - PermissionSet False Positives", () => {
    test("should NOT provide completion for 'table' inside permissionset Permissions", () => {
      const lines = [
        'permissionset 50000 "My PermissionSet"',
        "{",
        "    Permissions =",
        "        tabledata Customer = RIMD,",
        "        table ", // Cursor here - inside permissionset body
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        4,
        "        table "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'codeunit' inside permissionset", () => {
      const lines = [
        'permissionset 50000 "My PermissionSet"',
        "{",
        "    Permissions =",
        "        codeunit ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        codeunit "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'page' inside permissionset", () => {
      const lines = [
        'permissionset 50000 "My PermissionSet"',
        "{",
        "    Permissions =",
        "        page ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        page "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'report' inside permissionset", () => {
      const lines = [
        'permissionset 50000 "My PermissionSet"',
        "{",
        "    Permissions =",
        "        report ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        report "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'query' inside permissionset", () => {
      const lines = [
        'permissionset 50000 "My PermissionSet"',
        "{",
        "    Permissions =",
        "        query ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        query "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'xmlport' inside permissionset", () => {
      const lines = [
        'permissionset 50000 "My PermissionSet"',
        "{",
        "    Permissions =",
        "        xmlport ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        xmlport "
      );
      assert.strictEqual(result, false);
    });
  });

  suite("Scope Detection - Entitlement False Positives", () => {
    test("should NOT provide completion for 'table' inside entitlement", () => {
      const lines = [
        'entitlement "My Entitlement"',
        "{",
        "    ObjectEntitlements =",
        "        table ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        table "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'page' inside entitlement", () => {
      const lines = [
        'entitlement "My Entitlement"',
        "{",
        "    ObjectEntitlements =",
        "        page ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        page "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'codeunit' inside entitlement", () => {
      const lines = [
        'entitlement "My Entitlement"',
        "{",
        "    ObjectEntitlements =",
        "        codeunit ", // Cursor here
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        3,
        "        codeunit "
      );
      assert.strictEqual(result, false);
    });
  });

  suite("Scope Detection - Object Body False Positives", () => {
    test("should NOT provide completion for 'table' inside codeunit body", () => {
      const lines = [
        'codeunit 50000 "My Codeunit"',
        "{",
        "    // Comment",
        "    table ", // Cursor here - inside codeunit
      ];
      const result = provider.shouldProvideCompletion(lines, 3, "    table ");
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'page' inside procedure", () => {
      const lines = [
        'codeunit 50000 "My Codeunit"',
        "{",
        "    procedure DoSomething()",
        "    {",
        "        page ", // Cursor here - inside procedure
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        4,
        "        page "
      );
      assert.strictEqual(result, false);
    });

    test("should NOT provide completion for 'report' inside table", () => {
      const lines = [
        'table 50000 "My Table"',
        "{",
        "    fields",
        "    {",
        "        report ", // Cursor here - inside table fields
      ];
      const result = provider.shouldProvideCompletion(
        lines,
        4,
        "        report "
      );
      assert.strictEqual(result, false);
    });
  });

  suite("Scope Detection - Valid Object Declarations", () => {
    test("should provide completion for 'table' at file root", () => {
      const lines = ["table "];
      const result = provider.shouldProvideCompletion(lines, 0, "table ");
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'codeunit' at file root", () => {
      const lines = ["codeunit "];
      const result = provider.shouldProvideCompletion(lines, 0, "codeunit ");
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'page' at file root", () => {
      const lines = ["page "];
      const result = provider.shouldProvideCompletion(lines, 0, "page ");
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'report' at file root", () => {
      const lines = ["report "];
      const result = provider.shouldProvideCompletion(lines, 0, "report ");
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'query' at file root", () => {
      const lines = ["query "];
      const result = provider.shouldProvideCompletion(lines, 0, "query ");
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'xmlport' at file root", () => {
      const lines = ["xmlport "];
      const result = provider.shouldProvideCompletion(lines, 0, "xmlport ");
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'enum' at file root", () => {
      const lines = ["enum "];
      const result = provider.shouldProvideCompletion(lines, 0, "enum ");
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'permissionset' at file root", () => {
      const lines = ["permissionset "];
      const result = provider.shouldProvideCompletion(
        lines,
        0,
        "permissionset "
      );
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'tableextension' at file root", () => {
      const lines = ["tableextension "];
      const result = provider.shouldProvideCompletion(
        lines,
        0,
        "tableextension "
      );
      assert.strictEqual(result, true);
    });

    test("should provide completion for 'pageextension' at file root", () => {
      const lines = ["pageextension "];
      const result = provider.shouldProvideCompletion(
        lines,
        0,
        "pageextension "
      );
      assert.strictEqual(result, true);
    });

    test("should provide completion for object declaration after closed object", () => {
      const lines = [
        'codeunit 50000 "First Codeunit"',
        "{",
        "    procedure Test()",
        "    {",
        "    }",
        "}",
        "",
        "codeunit ", // Cursor here - file root level
      ];
      const result = provider.shouldProvideCompletion(lines, 7, "codeunit ");
      assert.strictEqual(result, true);
    });

    test("should provide completion with leading spaces (up to 3)", () => {
      const lines = ["   table "];
      const result = provider.shouldProvideCompletion(lines, 0, "   table ");
      assert.strictEqual(result, true);
    });
  });

  suite("Scope Detection - Edge Cases", () => {
    test("should handle braces in strings correctly", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "    procedure Test()",
        "    {",
        "        Message('This { has } braces');",
        "    }",
        "}",
        "table ", // Cursor here - should be at root level
      ];
      const result = provider.shouldProvideCompletion(lines, 7, "table ");
      assert.strictEqual(result, true);
    });

    test("should handle braces in comments correctly", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "    // This is a comment with { braces }",
        "    procedure Test()",
        "    {",
        "    }",
        "}",
        "page ", // Cursor here - should be at root level
      ];
      const result = provider.shouldProvideCompletion(lines, 7, "page ");
      assert.strictEqual(result, true);
    });

    test("should handle mixed brace scenarios", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "    procedure Test()",
        "    {",
        "        if true then begin",
        "            Message('text');",
        "        end;",
        "    }",
        "    ",
        "    report ", // Cursor here - still inside codeunit
      ];
      const result = provider.shouldProvideCompletion(lines, 9, "    report ");
      assert.strictEqual(result, false);
    });

    test("should handle multiple objects in same file", () => {
      const lines = [
        "codeunit 50000 MyCodeunit",
        "{",
        "}",
        "",
        "table 50001 MyTable",
        "{",
        "}",
        "",
        "page ", // Cursor here - file root level after two closed objects
      ];
      const result = provider.shouldProvideCompletion(lines, 8, "page ");
      assert.strictEqual(result, true);
    });
  });

  suite("Regression Tests - Existing Functionality", () => {
    // These tests ensure we haven't broken the original functionality
    test("all 13 object types should still trigger at file root", () => {
      for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
        const lines = [`${objectType} `];
        const result = provider.shouldProvideCompletion(
          lines,
          0,
          `${objectType} `
        );
        assert.strictEqual(
          result,
          true,
          `Should provide completion for ${objectType}`
        );
      }
    });

    test("object types without ID should never trigger", () => {
      for (const objectType of AL_OBJECT_TYPES_WITHOUT_ID) {
        const lines = [`${objectType} `];
        const result = provider.shouldProvideCompletion(
          lines,
          0,
          `${objectType} `
        );
        assert.strictEqual(
          result,
          false,
          `Should not provide completion for ${objectType}`
        );
      }
    });

    test("should handle case insensitivity at file root", () => {
      const testCases = ["CODEUNIT ", "Codeunit ", "codeunit ", "CodeUnit "];
      for (const testCase of testCases) {
        const lines = [testCase];
        const result = provider.shouldProvideCompletion(lines, 0, testCase);
        assert.strictEqual(
          result,
          true,
          `Should handle case: ${testCase.trim()}`
        );
      }
    });

    test("should not match partial keywords", () => {
      const lines = ["code "];
      const result = provider.shouldProvideCompletion(lines, 0, "code ");
      assert.strictEqual(result, false);
    });

    test("should not match keywords with extra content", () => {
      const lines = ["codeunit 50000"];
      const result = provider.shouldProvideCompletion(
        lines,
        0,
        "codeunit 50000"
      );
      assert.strictEqual(result, false);
    });
  });
});
