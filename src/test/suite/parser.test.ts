import * as assert from "assert";
import { ALObjectParser } from "../../parsers/alObjectParser.js";

suite("ALObjectParser Test Suite", () => {
  let parser: ALObjectParser;

  setup(() => {
    parser = new ALObjectParser();
  });

  suite("Basic Object Parsing", () => {
    test("should parse a simple table declaration", () => {
      const content = `table 50000 "My Table"
{
    DataClassification = CustomerContent;
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].type, "table");
      assert.strictEqual(objects[0].id, 50000);
      assert.strictEqual(objects[0].name, "My Table");
      assert.strictEqual(objects[0].lineNumber, 1);
    });

    test("should parse a simple page declaration", () => {
      const content = `page 50001 "My Page"
{
    PageType = Card;
}`;
      const objects = parser.parseContent(content, "/test/page.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].type, "page");
      assert.strictEqual(objects[0].id, 50001);
      assert.strictEqual(objects[0].name, "My Page");
    });

    test("should parse a codeunit declaration", () => {
      const content = `codeunit 50002 "My Codeunit"
{
    trigger OnRun()
    begin
    end;
}`;
      const objects = parser.parseContent(content, "/test/codeunit.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].type, "codeunit");
      assert.strictEqual(objects[0].id, 50002);
      assert.strictEqual(objects[0].name, "My Codeunit");
    });

    test("should parse unquoted object names", () => {
      const content = `table 50003 MyTableWithoutQuotes
{
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].name, "MyTableWithoutQuotes");
    });
  });

  suite("All Object Types", () => {
    const objectTypes = [
      { type: "table", id: 50000, name: "Test Table" },
      {
        type: "tableextension",
        id: 50001,
        name: "Test Table Ext",
        extra: ' extends "Base Table"',
      },
      { type: "page", id: 50002, name: "Test Page" },
      {
        type: "pageextension",
        id: 50003,
        name: "Test Page Ext",
        extra: ' extends "Base Page"',
      },
      { type: "report", id: 50004, name: "Test Report" },
      {
        type: "reportextension",
        id: 50005,
        name: "Test Report Ext",
        extra: ' extends "Base Report"',
      },
      { type: "codeunit", id: 50006, name: "Test Codeunit" },
      { type: "query", id: 50007, name: "Test Query" },
      { type: "xmlport", id: 50008, name: "Test XMLport" },
      { type: "enum", id: 50009, name: "Test Enum" },
      {
        type: "enumextension",
        id: 50010,
        name: "Test Enum Ext",
        extra: ' extends "Base Enum"',
      },
      { type: "permissionset", id: 50011, name: "Test PermSet" },
      {
        type: "permissionsetextension",
        id: 50012,
        name: "Test PermSet Ext",
        extra: ' extends "Base PermSet"',
      },
    ];

    for (const objDef of objectTypes) {
      test(`should parse ${objDef.type} declaration`, () => {
        const extra = objDef.extra || "";
        const content = `${objDef.type} ${objDef.id} "${objDef.name}"${extra}
{
}`;
        const objects = parser.parseContent(content, `/test/${objDef.type}.al`);

        assert.strictEqual(
          objects.length,
          1,
          `Expected 1 object for ${objDef.type}`
        );
        assert.strictEqual(objects[0].type, objDef.type);
        assert.strictEqual(objects[0].id, objDef.id);
        assert.strictEqual(objects[0].name, objDef.name);
      });
    }
  });

  suite("Comment Handling", () => {
    test("should ignore object in single-line comment", () => {
      const content = `// table 50000 "Commented Table"
table 50001 "Real Table"
{
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50001);
      assert.strictEqual(objects[0].name, "Real Table");
    });

    test("should ignore object in multi-line comment", () => {
      const content = `/*
table 50000 "Commented Table"
{
}
*/
table 50001 "Real Table"
{
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50001);
      assert.strictEqual(objects[0].name, "Real Table");
    });

    test("should ignore object with inline comment before it", () => {
      const content = `/* commented out */ // table 50000 "Commented"
table 50001 "Real Table"
{
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50001);
    });

    test("should handle nested multi-line comments", () => {
      // AL doesn't support true nested comments. The first */ closes the comment.
      // So "table 50000" appears outside any comment and will be parsed.
      // Let's test a realistic scenario where there's no nesting confusion.
      const content = `/* outer comment
table 50000 "Still Commented"
This is all inside a comment
*/
table 50001 "Real Table"
{
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50001);
    });

    test("should handle inline multi-line comment", () => {
      const content = `table /* comment */ 50001 "Real Table"
{
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      // The comment interrupts the pattern, so it shouldn't match
      // Actually, after stripping the comment, it becomes: table  50001 "Real Table"
      // which should still match
      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50001);
    });

    test("should ignore single-line comment at end of declaration line", () => {
      const content = `table 50001 "Real Table" // some comment
{
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50001);
      assert.strictEqual(objects[0].name, "Real Table");
    });
  });

  suite("Multiple Objects in Single File", () => {
    test("should parse multiple objects in one file", () => {
      const content = `table 50000 "Table One"
{
}

table 50001 "Table Two"
{
}

page 50002 "Page One"
{
}`;
      const objects = parser.parseContent(content, "/test/combined.al");

      assert.strictEqual(objects.length, 3);
      assert.strictEqual(objects[0].type, "table");
      assert.strictEqual(objects[0].id, 50000);
      assert.strictEqual(objects[1].type, "table");
      assert.strictEqual(objects[1].id, 50001);
      assert.strictEqual(objects[2].type, "page");
      assert.strictEqual(objects[2].id, 50002);
    });

    test("should track correct line numbers for multiple objects", () => {
      const content = `table 50000 "Table One"
{
}

table 50001 "Table Two"
{
}`;
      const objects = parser.parseContent(content, "/test/combined.al");

      assert.strictEqual(objects.length, 2);
      assert.strictEqual(objects[0].lineNumber, 1);
      assert.strictEqual(objects[1].lineNumber, 5);
    });
  });

  suite("Edge Cases", () => {
    test("should handle empty content", () => {
      const objects = parser.parseContent("", "/test/empty.al");
      assert.strictEqual(objects.length, 0);
    });

    test("should handle content with no objects", () => {
      const content = `// Just a comment
// No objects here`;
      const objects = parser.parseContent(content, "/test/noobjects.al");
      assert.strictEqual(objects.length, 0);
    });

    test("should handle whitespace before object declaration", () => {
      const content = `    table 50000 "Indented Table"
{
}`;
      const objects = parser.parseContent(content, "/test/indented.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50000);
    });

    test("should handle tabs in object declaration", () => {
      const content = `\ttable\t50000\t"Tabbed Table"
{
}`;
      const objects = parser.parseContent(content, "/test/tabbed.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 50000);
    });

    test("should handle object names with special characters", () => {
      const content = `table 50000 "My Table - (Test) [v2]"
{
}`;
      const objects = parser.parseContent(content, "/test/special.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].name, "My Table - (Test) [v2]");
    });

    test("should handle case-insensitive object types", () => {
      const content = `TABLE 50000 "Uppercase Table"
{
}
Page 50001 "Mixed Case Page"
{
}`;
      const objects = parser.parseContent(content, "/test/case.al");

      assert.strictEqual(objects.length, 2);
      assert.strictEqual(objects[0].type, "table");
      assert.strictEqual(objects[1].type, "page");
    });

    test("should handle Windows line endings (CRLF)", () => {
      const content = `table 50000 "Table One"\r\n{\r\n}\r\n\r\ntable 50001 "Table Two"\r\n{\r\n}`;
      const objects = parser.parseContent(content, "/test/windows.al");

      assert.strictEqual(objects.length, 2);
    });

    test("should handle large object IDs", () => {
      const content = `table 99999999 "Large ID Table"
{
}`;
      const objects = parser.parseContent(content, "/test/largeid.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].id, 99999999);
    });
  });

  suite("Static Methods", () => {
    test("isValidObjectType should return true for valid types", () => {
      assert.strictEqual(ALObjectParser.isValidObjectType("table"), true);
      assert.strictEqual(ALObjectParser.isValidObjectType("page"), true);
      assert.strictEqual(ALObjectParser.isValidObjectType("codeunit"), true);
      assert.strictEqual(
        ALObjectParser.isValidObjectType("permissionsetextension"),
        true
      );
    });

    test("isValidObjectType should return false for invalid types", () => {
      assert.strictEqual(ALObjectParser.isValidObjectType("invalid"), false);
      assert.strictEqual(ALObjectParser.isValidObjectType("interface"), false);
      assert.strictEqual(
        ALObjectParser.isValidObjectType("controladdin"),
        false
      );
    });

    test("getSupportedObjectTypes should return all 13 types", () => {
      const types = ALObjectParser.getSupportedObjectTypes();
      assert.strictEqual(types.length, 13);
      assert.ok(types.includes("table"));
      assert.ok(types.includes("permissionsetextension"));
    });
  });
});
