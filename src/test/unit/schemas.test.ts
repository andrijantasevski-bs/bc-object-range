import * as assert from "assert";
import {
  parseAppJson,
  validateALObject,
  IdRangeSchema,
  AppJsonSchema,
} from "../../models/schemas.js";

suite("Schema Validation Test Suite", () => {
  suite("IdRangeSchema", () => {
    test("should validate a valid ID range", () => {
      const result = IdRangeSchema.safeParse({ from: 50000, to: 50099 });
      assert.strictEqual(result.success, true);
    });

    test("should reject range where to < from", () => {
      const result = IdRangeSchema.safeParse({ from: 50099, to: 50000 });
      assert.strictEqual(result.success, false);
    });

    test("should reject non-integer values", () => {
      const result = IdRangeSchema.safeParse({ from: 50000.5, to: 50099 });
      assert.strictEqual(result.success, false);
    });

    test("should reject negative values", () => {
      const result = IdRangeSchema.safeParse({ from: -1, to: 50099 });
      assert.strictEqual(result.success, false);
    });

    test("should accept same from and to (single ID)", () => {
      const result = IdRangeSchema.safeParse({ from: 50000, to: 50000 });
      assert.strictEqual(result.success, true);
    });
  });

  suite("AppJsonSchema", () => {
    test("should validate a minimal valid app.json", () => {
      const appJson = {
        id: "test-id",
        name: "Test App",
        publisher: "Test Publisher",
        version: "1.0.0.0",
      };

      const result = AppJsonSchema.safeParse(appJson);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.deepStrictEqual(result.data.idRanges, []);
      }
    });

    test("should validate app.json with idRanges", () => {
      const appJson = {
        id: "test-id",
        name: "Test App",
        publisher: "Test Publisher",
        version: "1.0.0.0",
        idRanges: [
          { from: 50000, to: 50099 },
          { from: 50100, to: 50199 },
        ],
      };

      const result = AppJsonSchema.safeParse(appJson);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.idRanges.length, 2);
      }
    });

    test("should normalize single idRange to idRanges array", () => {
      const appJson = {
        id: "test-id",
        name: "Test App",
        publisher: "Test Publisher",
        version: "1.0.0.0",
        idRange: { from: 50000, to: 50099 },
      };

      const result = AppJsonSchema.safeParse(appJson);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.idRanges.length, 1);
        assert.strictEqual(result.data.idRanges[0].from, 50000);
        assert.strictEqual(result.data.idRanges[0].to, 50099);
      }
    });

    test("should reject app.json with missing required fields", () => {
      const appJson = {
        name: "Test App",
      };

      const result = AppJsonSchema.safeParse(appJson);
      assert.strictEqual(result.success, false);
    });

    test("should reject app.json with empty name", () => {
      const appJson = {
        id: "test-id",
        name: "",
        publisher: "Test Publisher",
        version: "1.0.0.0",
      };

      const result = AppJsonSchema.safeParse(appJson);
      assert.strictEqual(result.success, false);
    });
  });

  suite("parseAppJson", () => {
    test("should parse valid JSON string", () => {
      const jsonStr = JSON.stringify({
        id: "test-id",
        name: "Test App",
        publisher: "Test Publisher",
        version: "1.0.0.0",
        idRanges: [{ from: 50000, to: 50099 }],
      });

      const result = parseAppJson(jsonStr);
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.name, "Test App");
      assert.strictEqual(result?.idRanges.length, 1);
    });

    test("should return null for invalid JSON", () => {
      const result = parseAppJson("not valid json");
      assert.strictEqual(result, null);
    });

    test("should return null for JSON missing required fields", () => {
      const result = parseAppJson('{"name": "incomplete"}');
      assert.strictEqual(result, null);
    });
  });

  suite("validateALObject", () => {
    test("should validate a valid AL object", () => {
      const obj = {
        type: "table",
        id: 50000,
        name: "Test Table",
        lineNumber: 1,
        filePath: "/test/table.al",
      };

      const result = validateALObject(obj);
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.type, "table");
    });

    test("should reject invalid object type", () => {
      const obj = {
        type: "invalid",
        id: 50000,
        name: "Test",
        lineNumber: 1,
        filePath: "/test/test.al",
      };

      const result = validateALObject(obj);
      assert.strictEqual(result, null);
    });

    test("should reject negative ID", () => {
      const obj = {
        type: "table",
        id: -1,
        name: "Test",
        lineNumber: 1,
        filePath: "/test/test.al",
      };

      const result = validateALObject(obj);
      assert.strictEqual(result, null);
    });

    test("should reject missing name", () => {
      const obj = {
        type: "table",
        id: 50000,
        name: "",
        lineNumber: 1,
        filePath: "/test/test.al",
      };

      const result = validateALObject(obj);
      assert.strictEqual(result, null);
    });

    test("should validate all 13 object types", () => {
      const types = [
        "table",
        "tableextension",
        "page",
        "pageextension",
        "report",
        "reportextension",
        "codeunit",
        "query",
        "xmlport",
        "enum",
        "enumextension",
        "permissionset",
        "permissionsetextension",
      ];

      for (const type of types) {
        const obj = {
          type,
          id: 50000,
          name: "Test",
          lineNumber: 1,
          filePath: "/test/test.al",
        };

        const result = validateALObject(obj);
        assert.notStrictEqual(result, null, `Expected ${type} to be valid`);
      }
    });
  });
});
