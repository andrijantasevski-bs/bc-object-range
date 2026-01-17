import * as assert from "assert";
import { ALProject, IdRange, ALObjectTypeWithId } from "../../types/index.js";

// Import the class directly to test its methods
// We'll create a simple mock for the scanner's calculateGaps function
class GapCalculator {
  /**
   * Calculate unused ID gaps within configured ranges for a project
   */
  public calculateGaps(
    project: ALProject,
  ): { start: number; end: number; count: number }[] {
    const gaps: { start: number; end: number; count: number }[] = [];

    if (project.idRanges.length === 0) {
      return gaps;
    }

    // Get all used IDs
    const usedIds = new Set(project.objects.map((obj) => obj.id));

    // For each configured range, find gaps
    for (const range of project.idRanges) {
      let gapStart: number | null = null;

      for (let id = range.from; id <= range.to; id++) {
        if (!usedIds.has(id)) {
          // This ID is unused
          if (gapStart === null) {
            gapStart = id;
          }
        } else {
          // This ID is used - close any open gap
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

      // Close any gap that extends to the end of the range
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
}

suite("Gap Calculation Test Suite", () => {
  let calculator: GapCalculator;

  setup(() => {
    calculator = new GapCalculator();
  });

  /**
   * Helper to create a test project
   */
  function createTestProject(
    name: string,
    idRanges: IdRange[],
    usedIds: number[],
  ): ALProject {
    return {
      name,
      rootPath: `/test/${name}`,
      idRanges,
      objects: usedIds.map((id, index) => ({
        type: "table" as const,
        id,
        name: `Object ${id}`,
        lineNumber: index + 1,
        filePath: `/test/${name}/obj${id}.al`,
      })),
    };
  }

  suite("Basic Gap Detection", () => {
    test("should find single gap at start of range", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50005, 50006, 50007, 50008, 50009, 50010],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50004);
      assert.strictEqual(gaps[0].count, 5);
    });

    test("should find single gap at end of range", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50000, 50001, 50002, 50003, 50004, 50005],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50006);
      assert.strictEqual(gaps[0].end, 50010);
      assert.strictEqual(gaps[0].count, 5);
    });

    test("should find gap in middle of range", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50000, 50001, 50002, 50008, 50009, 50010],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50003);
      assert.strictEqual(gaps[0].end, 50007);
      assert.strictEqual(gaps[0].count, 5);
    });

    test("should find multiple gaps", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50002, 50005, 50008],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 4);
      // Gap: 50000-50001
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50001);
      // Gap: 50003-50004
      assert.strictEqual(gaps[1].start, 50003);
      assert.strictEqual(gaps[1].end, 50004);
      // Gap: 50006-50007
      assert.strictEqual(gaps[2].start, 50006);
      assert.strictEqual(gaps[2].end, 50007);
      // Gap: 50009-50010
      assert.strictEqual(gaps[3].start, 50009);
      assert.strictEqual(gaps[3].end, 50010);
    });
  });

  suite("Edge Cases", () => {
    test("should return empty array when no ranges configured", () => {
      const project = createTestProject("test", [], [50000, 50001]);

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 0);
    });

    test("should return full range as gap when no objects exist", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50010);
      assert.strictEqual(gaps[0].count, 11);
    });

    test("should return empty gaps when range is fully used", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50004 }],
        [50000, 50001, 50002, 50003, 50004],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 0);
    });

    test("should handle single-ID range that is unused", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50000 }],
        [],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50000);
      assert.strictEqual(gaps[0].count, 1);
    });

    test("should handle single-ID range that is used", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50000 }],
        [50000],
      );

      const gaps = calculator.calculateGaps(project);

      assert.strictEqual(gaps.length, 0);
    });
  });

  suite("Multiple Ranges", () => {
    test("should calculate gaps for multiple ranges", () => {
      const project = createTestProject(
        "test",
        [
          { from: 50000, to: 50005 },
          { from: 50100, to: 50105 },
        ],
        [50002, 50003, 50102, 50103],
      );

      const gaps = calculator.calculateGaps(project);

      // First range gaps: 50000-50001, 50004-50005
      // Second range gaps: 50100-50101, 50104-50105
      assert.strictEqual(gaps.length, 4);

      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50001);

      assert.strictEqual(gaps[1].start, 50004);
      assert.strictEqual(gaps[1].end, 50005);

      assert.strictEqual(gaps[2].start, 50100);
      assert.strictEqual(gaps[2].end, 50101);

      assert.strictEqual(gaps[3].start, 50104);
      assert.strictEqual(gaps[3].end, 50105);
    });

    test("should handle overlapping ranges", () => {
      // Note: Overlapping ranges in app.json are technically invalid,
      // but the calculator should still handle them gracefully
      const project = createTestProject(
        "test",
        [
          { from: 50000, to: 50010 },
          { from: 50005, to: 50015 },
        ],
        [50007, 50008],
      );

      const gaps = calculator.calculateGaps(project);

      // Both ranges should be processed independently
      assert.ok(gaps.length > 0);
    });
  });

  suite("Objects Outside Range", () => {
    test("should ignore objects outside configured range", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50005 }],
        [49999, 50002, 50006], // 49999 and 50006 are outside range
      );

      const gaps = calculator.calculateGaps(project);

      // Only 50002 is in range, so gaps should be 50000-50001 and 50003-50005
      assert.strictEqual(gaps.length, 2);
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50001);
      assert.strictEqual(gaps[1].start, 50003);
      assert.strictEqual(gaps[1].end, 50005);
    });
  });

  suite("Get Next Available ID", () => {
    test("should return first available ID", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50000, 50001, 50002],
      );

      const nextId = calculator.getNextAvailableId(project);

      assert.strictEqual(nextId, 50003);
    });

    test("should return null when no IDs available", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50002 }],
        [50000, 50001, 50002],
      );

      const nextId = calculator.getNextAvailableId(project);

      assert.strictEqual(nextId, null);
    });

    test("should return null when no ranges configured", () => {
      const project = createTestProject("test", [], [50000]);

      const nextId = calculator.getNextAvailableId(project);

      assert.strictEqual(nextId, null);
    });

    test("should return first ID when range is empty", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [],
      );

      const nextId = calculator.getNextAvailableId(project);

      assert.strictEqual(nextId, 50000);
    });
  });
});

/**
 * Shared Range Mode Calculator (mirrors WorkspaceScanner shared mode methods)
 */
class SharedRangeCalculator {
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

    // Sort ranges by 'from' value
    allRanges.sort((a, b) => a.from - b.from);

    // Merge overlapping/adjacent ranges
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
   * Calculate gaps for a specific object type across all projects
   */
  public calculateSharedGaps(
    projects: ALProject[],
    objectType: ALObjectTypeWithId,
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

    // Collect all used IDs of this object type across all projects
    const usedIds = new Set<number>();
    for (const project of projects) {
      for (const obj of project.objects) {
        if (obj.type === objectType) {
          usedIds.add(obj.id);
        }
      }
    }

    // Find gaps in the shared ranges
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
   * Get the next available ID for a specific object type
   */
  public getNextAvailableIdForType(
    projects: ALProject[],
    objectType: ALObjectTypeWithId,
  ): number | null {
    const gaps = this.calculateSharedGaps(projects, objectType);
    if (gaps.length === 0) {
      return null;
    }
    return gaps[0].start;
  }

  /**
   * Detect ID conflicts across projects
   */
  public detectConflicts(
    projects: ALProject[],
  ): { id: number; type: ALObjectTypeWithId; objects: ALProject["objects"] }[] {
    const conflicts: {
      id: number;
      type: ALObjectTypeWithId;
      objects: ALProject["objects"];
    }[] = [];
    const objectMap = new Map<string, ALProject["objects"][0][]>();

    for (const project of projects) {
      for (const obj of project.objects) {
        const key = `${obj.type}:${obj.id}`;
        const existing = objectMap.get(key) || [];
        existing.push(obj);
        objectMap.set(key, existing);
      }
    }

    for (const [, objects] of objectMap) {
      if (objects.length > 1) {
        const uniquePaths = new Set(
          objects.map((o) => {
            // Extract project root from path
            const parts = o.filePath.split("/");
            return parts.slice(0, 3).join("/");
          }),
        );
        if (uniquePaths.size > 1) {
          conflicts.push({
            id: objects[0].id,
            type: objects[0].type,
            objects,
          });
        }
      }
    }

    return conflicts;
  }
}

suite("Shared Range Mode Test Suite", () => {
  let calculator: SharedRangeCalculator;

  setup(() => {
    calculator = new SharedRangeCalculator();
  });

  /**
   * Helper to create a test project with specific object types
   */
  function createTestProjectWithTypes(
    name: string,
    idRanges: IdRange[],
    objects: { type: ALObjectTypeWithId; id: number }[],
  ): ALProject {
    return {
      name,
      rootPath: `/test/${name}`,
      idRanges,
      objects: objects.map((obj, index) => ({
        type: obj.type,
        id: obj.id,
        name: `${obj.type}${obj.id}`,
        lineNumber: index + 1,
        filePath: `/test/${name}/${obj.type}${obj.id}.al`,
      })),
    };
  }

  suite("Get Shared Ranges", () => {
    test("should return empty array when no projects", () => {
      const ranges = calculator.getSharedRanges([]);
      assert.deepStrictEqual(ranges, []);
    });

    test("should return single range from single project", () => {
      const project = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50099 }],
        [],
      );

      const ranges = calculator.getSharedRanges([project]);

      assert.deepStrictEqual(ranges, [{ from: 50000, to: 50099 }]);
    });

    test("should merge identical ranges from multiple projects", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50099 }],
        [],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50000, to: 50099 }],
        [],
      );

      const ranges = calculator.getSharedRanges([project1, project2]);

      assert.deepStrictEqual(ranges, [{ from: 50000, to: 50099 }]);
    });

    test("should merge overlapping ranges", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50050 }],
        [],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50025, to: 50099 }],
        [],
      );

      const ranges = calculator.getSharedRanges([project1, project2]);

      assert.deepStrictEqual(ranges, [{ from: 50000, to: 50099 }]);
    });

    test("should merge adjacent ranges", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50049 }],
        [],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50050, to: 50099 }],
        [],
      );

      const ranges = calculator.getSharedRanges([project1, project2]);

      assert.deepStrictEqual(ranges, [{ from: 50000, to: 50099 }]);
    });

    test("should keep non-overlapping ranges separate", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50049 }],
        [],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50100, to: 50149 }],
        [],
      );

      const ranges = calculator.getSharedRanges([project1, project2]);

      assert.deepStrictEqual(ranges, [
        { from: 50000, to: 50049 },
        { from: 50100, to: 50149 },
      ]);
    });
  });

  suite("Calculate Shared Gaps by Object Type", () => {
    test("should calculate gaps for specific object type only", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50010 }],
        [
          { type: "table", id: 50000 },
          { type: "page", id: 50000 },
          { type: "table", id: 50001 },
        ],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50000, to: 50010 }],
        [
          { type: "table", id: 50002 },
          { type: "codeunit", id: 50000 },
        ],
      );

      const tableGaps = calculator.calculateSharedGaps(
        [project1, project2],
        "table",
      );
      const pageGaps = calculator.calculateSharedGaps(
        [project1, project2],
        "page",
      );

      // Tables: 50000, 50001, 50002 used → gap from 50003-50010
      assert.strictEqual(tableGaps.length, 1);
      assert.strictEqual(tableGaps[0].start, 50003);
      assert.strictEqual(tableGaps[0].end, 50010);

      // Pages: only 50000 used → gap from 50001-50010
      assert.strictEqual(pageGaps.length, 1);
      assert.strictEqual(pageGaps[0].start, 50001);
    });

    test("should find next available ID for object type across projects", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50010 }],
        [{ type: "table", id: 50000 }],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50000, to: 50010 }],
        [{ type: "table", id: 50001 }],
      );

      const nextTableId = calculator.getNextAvailableIdForType(
        [project1, project2],
        "table",
      );
      const nextPageId = calculator.getNextAvailableIdForType(
        [project1, project2],
        "page",
      );

      assert.strictEqual(nextTableId, 50002); // 50000, 50001 used
      assert.strictEqual(nextPageId, 50000); // None used
    });

    test("should return null when no IDs available for type", () => {
      const project = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50001 }],
        [
          { type: "table", id: 50000 },
          { type: "table", id: 50001 },
        ],
      );

      const nextId = calculator.getNextAvailableIdForType([project], "table");

      assert.strictEqual(nextId, null);
    });
  });

  suite("Conflict Detection", () => {
    test("should detect no conflicts when IDs are unique", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50099 }],
        [{ type: "table", id: 50000 }],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50000, to: 50099 }],
        [{ type: "table", id: 50001 }],
      );

      const conflicts = calculator.detectConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 0);
    });

    test("should detect conflict when same type and ID in different projects", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50099 }],
        [{ type: "table", id: 50000 }],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50000, to: 50099 }],
        [{ type: "table", id: 50000 }],
      );

      const conflicts = calculator.detectConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 1);
      assert.strictEqual(conflicts[0].type, "table");
      assert.strictEqual(conflicts[0].id, 50000);
      assert.strictEqual(conflicts[0].objects.length, 2);
    });

    test("should not detect conflict when same ID but different types", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50099 }],
        [{ type: "table", id: 50000 }],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50000, to: 50099 }],
        [{ type: "page", id: 50000 }],
      );

      const conflicts = calculator.detectConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 0);
    });

    test("should detect multiple conflicts", () => {
      const project1 = createTestProjectWithTypes(
        "app1",
        [{ from: 50000, to: 50099 }],
        [
          { type: "table", id: 50000 },
          { type: "page", id: 50001 },
        ],
      );
      const project2 = createTestProjectWithTypes(
        "app2",
        [{ from: 50000, to: 50099 }],
        [
          { type: "table", id: 50000 },
          { type: "page", id: 50001 },
        ],
      );

      const conflicts = calculator.detectConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 2);
    });
  });
});

import {
  ALObjectWithFields,
  ALField,
  ALEnumValue,
  FieldConflict,
  EnumValueConflict,
} from "../../types/index.js";

/**
 * Mock class for testing field and enum value conflict detection
 */
class FieldConflictCalculator {
  /**
   * Detect field ID conflicts in tableextensions extending the same base table
   */
  public detectFieldConflicts(
    projects: Array<{
      name: string;
      rootPath: string;
      objects: ALObjectWithFields[];
    }>,
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    // Map: "baseTable:fieldId" -> field info array
    const fieldMap = new Map<
      string,
      Array<{
        field: ALField;
        projectName: string;
        extensionId: number;
        extensionName: string;
      }>
    >();

    for (const project of projects) {
      for (const obj of project.objects) {
        if (
          obj.type === "tableextension" &&
          obj.extendsObject &&
          obj.fields &&
          obj.fields.length > 0
        ) {
          for (const field of obj.fields) {
            const key = `${obj.extendsObject}:${field.id}`;
            const existing = fieldMap.get(key) || [];
            existing.push({
              field,
              projectName: project.name,
              extensionId: obj.id,
              extensionName: obj.name,
            });
            fieldMap.set(key, existing);
          }
        }
      }
    }

    for (const [key, fieldInfos] of fieldMap) {
      if (fieldInfos.length > 1) {
        const uniqueProjects = new Set(fieldInfos.map((f) => f.projectName));
        if (uniqueProjects.size > 1) {
          const baseTable = key.split(":")[0];
          const fieldId = parseInt(key.split(":")[1], 10);

          conflicts.push({
            fieldId,
            baseTable,
            fields: fieldInfos.map((info) => ({
              ...info.field,
              projectName: info.projectName,
              extensionId: info.extensionId,
              extensionName: info.extensionName,
            })),
          });
        }
      }
    }

    conflicts.sort((a, b) => {
      const tableCompare = a.baseTable.localeCompare(b.baseTable);
      return tableCompare !== 0 ? tableCompare : a.fieldId - b.fieldId;
    });

    return conflicts;
  }

  /**
   * Detect enum value ID conflicts in enumextensions extending the same base enum
   */
  public detectEnumValueConflicts(
    projects: Array<{
      name: string;
      rootPath: string;
      objects: ALObjectWithFields[];
    }>,
  ): EnumValueConflict[] {
    const conflicts: EnumValueConflict[] = [];

    // Map: "baseEnum:valueId" -> value info array
    const valueMap = new Map<
      string,
      Array<{
        value: ALEnumValue;
        projectName: string;
        extensionId: number;
        extensionName: string;
      }>
    >();

    for (const project of projects) {
      for (const obj of project.objects) {
        if (
          obj.type === "enumextension" &&
          obj.extendsObject &&
          obj.enumValues &&
          obj.enumValues.length > 0
        ) {
          for (const value of obj.enumValues) {
            const key = `${obj.extendsObject}:${value.id}`;
            const existing = valueMap.get(key) || [];
            existing.push({
              value,
              projectName: project.name,
              extensionId: obj.id,
              extensionName: obj.name,
            });
            valueMap.set(key, existing);
          }
        }
      }
    }

    for (const [key, valueInfos] of valueMap) {
      if (valueInfos.length > 1) {
        const uniqueProjects = new Set(valueInfos.map((v) => v.projectName));
        if (uniqueProjects.size > 1) {
          const baseEnum = key.split(":")[0];
          const valueId = parseInt(key.split(":")[1], 10);

          conflicts.push({
            valueId,
            baseEnum,
            values: valueInfos.map((info) => ({
              ...info.value,
              projectName: info.projectName,
              extensionId: info.extensionId,
              extensionName: info.extensionName,
            })),
          });
        }
      }
    }

    conflicts.sort((a, b) => {
      const enumCompare = a.baseEnum.localeCompare(b.baseEnum);
      return enumCompare !== 0 ? enumCompare : a.valueId - b.valueId;
    });

    return conflicts;
  }
}

suite("Field and Enum Value Conflict Detection Test Suite", () => {
  let calculator: FieldConflictCalculator;

  setup(() => {
    calculator = new FieldConflictCalculator();
  });

  /**
   * Helper to create a test project with tableextensions
   */
  function createProjectWithTableExtensions(
    name: string,
    extensions: Array<{
      id: number;
      extName: string;
      extendsObject: string;
      fields: Array<{ id: number; name: string; dataType: string }>;
    }>,
  ): { name: string; rootPath: string; objects: ALObjectWithFields[] } {
    return {
      name,
      rootPath: `/test/${name}`,
      objects: extensions.map((ext) => ({
        type: "tableextension" as const,
        id: ext.id,
        name: ext.extName,
        lineNumber: 1,
        filePath: `/test/${name}/${ext.extName}.al`,
        extendsObject: ext.extendsObject,
        fields: ext.fields.map((f, i) => ({
          id: f.id,
          name: f.name,
          dataType: f.dataType,
          lineNumber: i + 3,
          filePath: `/test/${name}/${ext.extName}.al`,
        })),
      })),
    };
  }

  /**
   * Helper to create a test project with enumextensions
   */
  function createProjectWithEnumExtensions(
    name: string,
    extensions: Array<{
      id: number;
      extName: string;
      extendsObject: string;
      values: Array<{ id: number; name: string }>;
    }>,
  ): { name: string; rootPath: string; objects: ALObjectWithFields[] } {
    return {
      name,
      rootPath: `/test/${name}`,
      objects: extensions.map((ext) => ({
        type: "enumextension" as const,
        id: ext.id,
        name: ext.extName,
        lineNumber: 1,
        filePath: `/test/${name}/${ext.extName}.al`,
        extendsObject: ext.extendsObject,
        enumValues: ext.values.map((v, i) => ({
          id: v.id,
          name: v.name,
          lineNumber: i + 2,
          filePath: `/test/${name}/${ext.extName}.al`,
        })),
      })),
    };
  }

  suite("Field Conflict Detection", () => {
    test("should detect field conflict when same field ID used in extensions for same base table", () => {
      const project1 = createProjectWithTableExtensions("App1", [
        {
          id: 50000,
          extName: "App1 Gen Jnl Line Ext",
          extendsObject: "Gen. Journal Line",
          fields: [{ id: 50060, name: "App1 Field", dataType: "Integer" }],
        },
      ]);

      const project2 = createProjectWithTableExtensions("App2", [
        {
          id: 50001,
          extName: "App2 Gen Jnl Line Ext",
          extendsObject: "Gen. Journal Line",
          fields: [{ id: 50060, name: "App2 Field", dataType: "Text[50]" }],
        },
      ]);

      const conflicts = calculator.detectFieldConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 1);
      assert.strictEqual(conflicts[0].fieldId, 50060);
      assert.strictEqual(conflicts[0].baseTable, "Gen. Journal Line");
      assert.strictEqual(conflicts[0].fields.length, 2);
      assert.strictEqual(conflicts[0].fields[0].projectName, "App1");
      assert.strictEqual(conflicts[0].fields[1].projectName, "App2");
    });

    test("should not detect conflict for same field ID extending different base tables", () => {
      const project1 = createProjectWithTableExtensions("App1", [
        {
          id: 50000,
          extName: "App1 Customer Ext",
          extendsObject: "Customer",
          fields: [{ id: 50060, name: "My Field", dataType: "Integer" }],
        },
      ]);

      const project2 = createProjectWithTableExtensions("App2", [
        {
          id: 50001,
          extName: "App2 Vendor Ext",
          extendsObject: "Vendor",
          fields: [{ id: 50060, name: "My Field", dataType: "Integer" }],
        },
      ]);

      const conflicts = calculator.detectFieldConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 0);
    });

    test("should not detect conflict when same field ID used in same project", () => {
      const project = createProjectWithTableExtensions("App1", [
        {
          id: 50000,
          extName: "Ext1",
          extendsObject: "Customer",
          fields: [{ id: 50060, name: "Field1", dataType: "Integer" }],
        },
        {
          id: 50001,
          extName: "Ext2",
          extendsObject: "Customer",
          fields: [{ id: 50060, name: "Field2", dataType: "Integer" }],
        },
      ]);

      const conflicts = calculator.detectFieldConflicts([project]);

      // Same project, so not a cross-project conflict
      assert.strictEqual(conflicts.length, 0);
    });

    test("should detect multiple field conflicts", () => {
      const project1 = createProjectWithTableExtensions("App1", [
        {
          id: 50000,
          extName: "App1 Ext",
          extendsObject: "Customer",
          fields: [
            { id: 50060, name: "Field1", dataType: "Integer" },
            { id: 50061, name: "Field2", dataType: "Text[50]" },
          ],
        },
      ]);

      const project2 = createProjectWithTableExtensions("App2", [
        {
          id: 50001,
          extName: "App2 Ext",
          extendsObject: "Customer",
          fields: [
            { id: 50060, name: "ConflictField1", dataType: "Decimal" },
            { id: 50061, name: "ConflictField2", dataType: "Code[20]" },
          ],
        },
      ]);

      const conflicts = calculator.detectFieldConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 2);
      assert.strictEqual(conflicts[0].fieldId, 50060);
      assert.strictEqual(conflicts[1].fieldId, 50061);
    });

    test("should handle projects with no tableextensions", () => {
      const project1: {
        name: string;
        rootPath: string;
        objects: ALObjectWithFields[];
      } = {
        name: "App1",
        rootPath: "/test/App1",
        objects: [
          {
            type: "table",
            id: 50000,
            name: "My Table",
            lineNumber: 1,
            filePath: "/test/App1/table.al",
            fields: [
              {
                id: 1,
                name: "Field1",
                dataType: "Integer",
                lineNumber: 3,
                filePath: "/test/App1/table.al",
              },
            ],
          },
        ],
      };

      const conflicts = calculator.detectFieldConflicts([project1]);

      assert.strictEqual(conflicts.length, 0);
    });

    test("should handle tableextension without fields", () => {
      const project1 = createProjectWithTableExtensions("App1", [
        {
          id: 50000,
          extName: "Empty Ext",
          extendsObject: "Customer",
          fields: [],
        },
      ]);

      const project2 = createProjectWithTableExtensions("App2", [
        {
          id: 50001,
          extName: "Also Empty",
          extendsObject: "Customer",
          fields: [],
        },
      ]);

      const conflicts = calculator.detectFieldConflicts([project1, project2]);

      assert.strictEqual(conflicts.length, 0);
    });
  });

  suite("Enum Value Conflict Detection", () => {
    test("should detect enum value conflict when same value ID used in extensions for same base enum", () => {
      const project1 = createProjectWithEnumExtensions("App1", [
        {
          id: 50100,
          extName: "App1 Enum Ext",
          extendsObject: "Sales Document Type",
          values: [{ id: 50100, name: "App1 Value" }],
        },
      ]);

      const project2 = createProjectWithEnumExtensions("App2", [
        {
          id: 50101,
          extName: "App2 Enum Ext",
          extendsObject: "Sales Document Type",
          values: [{ id: 50100, name: "App2 Value" }],
        },
      ]);

      const conflicts = calculator.detectEnumValueConflicts([
        project1,
        project2,
      ]);

      assert.strictEqual(conflicts.length, 1);
      assert.strictEqual(conflicts[0].valueId, 50100);
      assert.strictEqual(conflicts[0].baseEnum, "Sales Document Type");
      assert.strictEqual(conflicts[0].values.length, 2);
    });

    test("should not detect conflict for same value ID extending different base enums", () => {
      const project1 = createProjectWithEnumExtensions("App1", [
        {
          id: 50100,
          extName: "App1 Enum Ext",
          extendsObject: "Enum1",
          values: [{ id: 50100, name: "Value1" }],
        },
      ]);

      const project2 = createProjectWithEnumExtensions("App2", [
        {
          id: 50101,
          extName: "App2 Enum Ext",
          extendsObject: "Enum2",
          values: [{ id: 50100, name: "Value1" }],
        },
      ]);

      const conflicts = calculator.detectEnumValueConflicts([
        project1,
        project2,
      ]);

      assert.strictEqual(conflicts.length, 0);
    });

    test("should detect multiple enum value conflicts", () => {
      const project1 = createProjectWithEnumExtensions("App1", [
        {
          id: 50100,
          extName: "App1 Ext",
          extendsObject: "My Enum",
          values: [
            { id: 50100, name: "Value1" },
            { id: 50101, name: "Value2" },
          ],
        },
      ]);

      const project2 = createProjectWithEnumExtensions("App2", [
        {
          id: 50101,
          extName: "App2 Ext",
          extendsObject: "My Enum",
          values: [
            { id: 50100, name: "Conflict1" },
            { id: 50101, name: "Conflict2" },
          ],
        },
      ]);

      const conflicts = calculator.detectEnumValueConflicts([
        project1,
        project2,
      ]);

      assert.strictEqual(conflicts.length, 2);
      assert.strictEqual(conflicts[0].valueId, 50100);
      assert.strictEqual(conflicts[1].valueId, 50101);
    });

    test("should handle enumextension without values", () => {
      const project1 = createProjectWithEnumExtensions("App1", [
        {
          id: 50100,
          extName: "Empty Ext",
          extendsObject: "My Enum",
          values: [],
        },
      ]);

      const conflicts = calculator.detectEnumValueConflicts([project1]);

      assert.strictEqual(conflicts.length, 0);
    });
  });

  suite("Mixed Conflict Detection", () => {
    test("should independently detect field and enum value conflicts", () => {
      // Create project with both tableextension and enumextension
      const project1: {
        name: string;
        rootPath: string;
        objects: ALObjectWithFields[];
      } = {
        name: "App1",
        rootPath: "/test/App1",
        objects: [
          {
            type: "tableextension",
            id: 50000,
            name: "Table Ext 1",
            lineNumber: 1,
            filePath: "/test/App1/tableext.al",
            extendsObject: "Customer",
            fields: [
              {
                id: 50060,
                name: "Field1",
                dataType: "Integer",
                lineNumber: 3,
                filePath: "/test/App1/tableext.al",
              },
            ],
          },
          {
            type: "enumextension",
            id: 50100,
            name: "Enum Ext 1",
            lineNumber: 1,
            filePath: "/test/App1/enumext.al",
            extendsObject: "My Enum",
            enumValues: [
              {
                id: 50100,
                name: "Value1",
                lineNumber: 2,
                filePath: "/test/App1/enumext.al",
              },
            ],
          },
        ],
      };

      const project2: {
        name: string;
        rootPath: string;
        objects: ALObjectWithFields[];
      } = {
        name: "App2",
        rootPath: "/test/App2",
        objects: [
          {
            type: "tableextension",
            id: 50001,
            name: "Table Ext 2",
            lineNumber: 1,
            filePath: "/test/App2/tableext.al",
            extendsObject: "Customer",
            fields: [
              {
                id: 50060,
                name: "ConflictField",
                dataType: "Text[50]",
                lineNumber: 3,
                filePath: "/test/App2/tableext.al",
              },
            ],
          },
          {
            type: "enumextension",
            id: 50101,
            name: "Enum Ext 2",
            lineNumber: 1,
            filePath: "/test/App2/enumext.al",
            extendsObject: "My Enum",
            enumValues: [
              {
                id: 50100,
                name: "ConflictValue",
                lineNumber: 2,
                filePath: "/test/App2/enumext.al",
              },
            ],
          },
        ],
      };

      const fieldConflicts = calculator.detectFieldConflicts([
        project1,
        project2,
      ]);
      const enumValueConflicts = calculator.detectEnumValueConflicts([
        project1,
        project2,
      ]);

      assert.strictEqual(fieldConflicts.length, 1);
      assert.strictEqual(fieldConflicts[0].fieldId, 50060);

      assert.strictEqual(enumValueConflicts.length, 1);
      assert.strictEqual(enumValueConflicts[0].valueId, 50100);
    });
  });
});
