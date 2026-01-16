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
   */
  public matchObjectType(text: string): string | null {
    const trimmed = text.trimEnd();

    for (const objectType of AL_OBJECT_TYPES_WITH_ID) {
      const regex = new RegExp(`^\\s*${objectType}\\s*$`, "i");
      if (regex.test(trimmed)) {
        return objectType;
      }
    }

    return null;
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
});
