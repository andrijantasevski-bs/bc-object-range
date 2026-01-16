import * as assert from "assert";
import { ALProject, IdRange } from "../../types/index.js";
import { WorkspaceScanner } from "../../services/workspaceScanner.js";

suite("Gap Calculation Test Suite", () => {
  let scanner: WorkspaceScanner;

  setup(() => {
    scanner = new WorkspaceScanner();
  });

  /**
   * Helper to create a test project
   */
  function createTestProject(
    name: string,
    idRanges: IdRange[],
    usedIds: number[]
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
        [50005, 50006, 50007, 50008, 50009, 50010]
      );

      const gaps = scanner.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50004);
      assert.strictEqual(gaps[0].count, 5);
    });

    test("should find single gap at end of range", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50000, 50001, 50002, 50003, 50004, 50005]
      );

      const gaps = scanner.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50006);
      assert.strictEqual(gaps[0].end, 50010);
      assert.strictEqual(gaps[0].count, 5);
    });

    test("should find gap in middle of range", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50000, 50001, 50002, 50008, 50009, 50010]
      );

      const gaps = scanner.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50003);
      assert.strictEqual(gaps[0].end, 50007);
      assert.strictEqual(gaps[0].count, 5);
    });

    test("should find multiple gaps", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        [50002, 50005, 50008]
      );

      const gaps = scanner.calculateGaps(project);

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

      const gaps = scanner.calculateGaps(project);

      assert.strictEqual(gaps.length, 0);
    });

    test("should return full range as gap when no objects exist", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        []
      );

      const gaps = scanner.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50010);
      assert.strictEqual(gaps[0].count, 11);
    });

    test("should return empty gaps when range is fully used", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50004 }],
        [50000, 50001, 50002, 50003, 50004]
      );

      const gaps = scanner.calculateGaps(project);

      assert.strictEqual(gaps.length, 0);
    });

    test("should handle single-ID range that is unused", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50000 }],
        []
      );

      const gaps = scanner.calculateGaps(project);

      assert.strictEqual(gaps.length, 1);
      assert.strictEqual(gaps[0].start, 50000);
      assert.strictEqual(gaps[0].end, 50000);
      assert.strictEqual(gaps[0].count, 1);
    });

    test("should handle single-ID range that is used", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50000 }],
        [50000]
      );

      const gaps = scanner.calculateGaps(project);

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
        [50002, 50003, 50102, 50103]
      );

      const gaps = scanner.calculateGaps(project);

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
        [50007, 50008]
      );

      const gaps = scanner.calculateGaps(project);

      // Both ranges should be processed independently
      assert.ok(gaps.length > 0);
    });
  });

  suite("Objects Outside Range", () => {
    test("should ignore objects outside configured range", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50005 }],
        [49999, 50002, 50006] // 49999 and 50006 are outside range
      );

      const gaps = scanner.calculateGaps(project);

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
        [50000, 50001, 50002]
      );

      const nextId = scanner.getNextAvailableId(project);

      assert.strictEqual(nextId, 50003);
    });

    test("should return null when no IDs available", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50002 }],
        [50000, 50001, 50002]
      );

      const nextId = scanner.getNextAvailableId(project);

      assert.strictEqual(nextId, null);
    });

    test("should return null when no ranges configured", () => {
      const project = createTestProject("test", [], [50000]);

      const nextId = scanner.getNextAvailableId(project);

      assert.strictEqual(nextId, null);
    });

    test("should return first ID when range is empty", () => {
      const project = createTestProject(
        "test",
        [{ from: 50000, to: 50010 }],
        []
      );

      const nextId = scanner.getNextAvailableId(project);

      assert.strictEqual(nextId, 50000);
    });
  });
});
