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
          `Expected 1 object for ${objDef.type}`,
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

    test("should handle multi-line comment that appears to be nested", () => {
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
        true,
      );
    });

    test("isValidObjectType should return false for invalid types", () => {
      assert.strictEqual(ALObjectParser.isValidObjectType("invalid"), false);
      assert.strictEqual(ALObjectParser.isValidObjectType("interface"), false);
      assert.strictEqual(
        ALObjectParser.isValidObjectType("controladdin"),
        false,
      );
    });

    test("getSupportedObjectTypes should return all 13 types", () => {
      const types = ALObjectParser.getSupportedObjectTypes();
      assert.strictEqual(types.length, 13);
      assert.ok(types.includes("table"));
      assert.ok(types.includes("permissionsetextension"));
    });
  });

  suite("Field Parsing", () => {
    test("should parse fields in a table", () => {
      const content = `table 50000 "My Table"
{
    fields
    {
        field(1; "My Field"; Text[100])
        {
            Caption = 'My Field';
        }
        field(2; SecondField; Integer)
        {
            Caption = 'Second Field';
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].fields?.length, 2);
      assert.strictEqual(objects[0].fields![0].id, 1);
      assert.strictEqual(objects[0].fields![0].name, "My Field");
      assert.strictEqual(objects[0].fields![0].dataType, "Text[100]");
      assert.strictEqual(objects[0].fields![1].id, 2);
      assert.strictEqual(objects[0].fields![1].name, "SecondField");
      assert.strictEqual(objects[0].fields![1].dataType, "Integer");
    });

    test("should parse fields in a tableextension with extends clause", () => {
      const content = `tableextension 50068 "PTE INTL Gen. Jnl. Line" extends "Gen. Journal Line"
{
    fields
    {
        field(50060; "PTE INTL Customer Strategy"; Enum "PTE INTL Customer Strategy")
        {
            Caption = 'Strategy';
            DataClassification = CustomerContent;
        }
        field(50061; "PTE INTL Secondary Code"; Code[20])
        {
            Caption = 'Secondary Code';
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/tableext.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].type, "tableextension");
      assert.strictEqual(objects[0].id, 50068);
      assert.strictEqual(objects[0].name, "PTE INTL Gen. Jnl. Line");
      assert.strictEqual(objects[0].extendsObject, "Gen. Journal Line");
      assert.strictEqual(objects[0].fields?.length, 2);
      assert.strictEqual(objects[0].fields![0].id, 50060);
      assert.strictEqual(
        objects[0].fields![0].name,
        "PTE INTL Customer Strategy",
      );
      assert.strictEqual(
        objects[0].fields![0].dataType,
        'Enum "PTE INTL Customer Strategy"',
      );
      assert.strictEqual(objects[0].fields![1].id, 50061);
      assert.strictEqual(objects[0].fields![1].name, "PTE INTL Secondary Code");
      assert.strictEqual(objects[0].fields![1].dataType, "Code[20]");
    });

    test("should parse extends clause with unquoted name", () => {
      const content = `tableextension 50000 MyExtension extends Customer
{
    fields
    {
        field(50000; MyField; Integer)
        {
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/tableext.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].extendsObject, "Customer");
    });

    test("should handle fields block with brace on same line", () => {
      const content = `table 50000 "My Table"
{
    fields {
        field(1; MyField; Text[50])
        {
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].fields?.length, 1);
      assert.strictEqual(objects[0].fields![0].id, 1);
    });

    test("should track correct line numbers for fields", () => {
      const content = `table 50000 "My Table"
{
    fields
    {
        field(1; Field1; Integer)
        {
        }
        field(2; Field2; Text[100])
        {
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects[0].fields![0].lineNumber, 5);
      assert.strictEqual(objects[0].fields![1].lineNumber, 8);
    });

    test("should not parse fields outside fields block", () => {
      const content = `table 50000 "My Table"
{
    // field(1; FakeField; Integer) - this should not be parsed
    fields
    {
        field(2; RealField; Integer)
        {
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/table.al");

      assert.strictEqual(objects[0].fields?.length, 1);
      assert.strictEqual(objects[0].fields![0].id, 2);
    });

    test("should handle complex data types in fields", () => {
      const content = `tableextension 50000 "My Ext" extends "Sales Header"
{
    fields
    {
        field(50000; EnumField; Enum "Sales Document Type")
        {
        }
        field(50001; DecimalField; Decimal)
        {
        }
        field(50002; CodeField; Code[20])
        {
        }
        field(50003; OptionField; Option)
        {
            OptionMembers = A,B,C;
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/tableext.al");

      assert.strictEqual(objects[0].fields?.length, 4);
      assert.strictEqual(
        objects[0].fields![0].dataType,
        'Enum "Sales Document Type"',
      );
      assert.strictEqual(objects[0].fields![1].dataType, "Decimal");
      assert.strictEqual(objects[0].fields![2].dataType, "Code[20]");
      assert.strictEqual(objects[0].fields![3].dataType, "Option");
    });
  });

  suite("Enum Value Parsing", () => {
    test("should parse values in an enum", () => {
      const content = `enum 50000 "My Enum"
{
    Extensible = true;
    
    value(0; None)
    {
        Caption = 'None';
    }
    value(1; "First Value")
    {
        Caption = 'First Value';
    }
    value(2; Second)
    {
        Caption = 'Second';
    }
}`;
      const objects = parser.parseContent(content, "/test/enum.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].type, "enum");
      assert.strictEqual(objects[0].enumValues?.length, 3);
      assert.strictEqual(objects[0].enumValues![0].id, 0);
      assert.strictEqual(objects[0].enumValues![0].name, "None");
      assert.strictEqual(objects[0].enumValues![1].id, 1);
      assert.strictEqual(objects[0].enumValues![1].name, "First Value");
      assert.strictEqual(objects[0].enumValues![2].id, 2);
      assert.strictEqual(objects[0].enumValues![2].name, "Second");
    });

    test("should parse values in an enumextension with extends clause", () => {
      const content = `enumextension 50100 "My Enum Ext" extends "Base Enum"
{
    value(50100; "Extended Value")
    {
        Caption = 'Extended Value';
    }
    value(50101; AnotherValue)
    {
        Caption = 'Another Value';
    }
}`;
      const objects = parser.parseContent(content, "/test/enumext.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].type, "enumextension");
      assert.strictEqual(objects[0].extendsObject, "Base Enum");
      assert.strictEqual(objects[0].enumValues?.length, 2);
      assert.strictEqual(objects[0].enumValues![0].id, 50100);
      assert.strictEqual(objects[0].enumValues![0].name, "Extended Value");
      assert.strictEqual(objects[0].enumValues![1].id, 50101);
      assert.strictEqual(objects[0].enumValues![1].name, "AnotherValue");
    });

    test("should track correct line numbers for enum values", () => {
      const content = `enum 50000 MyEnum
{
    value(0; First)
    {
    }
    value(1; Second)
    {
    }
}`;
      const objects = parser.parseContent(content, "/test/enum.al");

      assert.strictEqual(objects[0].enumValues![0].lineNumber, 3);
      assert.strictEqual(objects[0].enumValues![1].lineNumber, 6);
    });

    test("should handle enumextension with unquoted extends", () => {
      const content = `enumextension 50000 MyEnumExt extends BaseEnum
{
    value(50000; NewValue)
    {
    }
}`;
      const objects = parser.parseContent(content, "/test/enumext.al");

      assert.strictEqual(objects[0].extendsObject, "BaseEnum");
      assert.strictEqual(objects[0].enumValues?.length, 1);
    });
  });

  suite("Multiple Objects with Fields", () => {
    test("should parse multiple objects with fields in single file", () => {
      const content = `table 50000 "Table One"
{
    fields
    {
        field(1; Field1; Integer)
        {
        }
    }
}

tableextension 50001 "Table Ext" extends Customer
{
    fields
    {
        field(50000; ExtField; Text[50])
        {
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/combined.al");

      assert.strictEqual(objects.length, 2);
      assert.strictEqual(objects[0].fields?.length, 1);
      assert.strictEqual(objects[0].fields![0].id, 1);
      assert.strictEqual(objects[1].extendsObject, "Customer");
      assert.strictEqual(objects[1].fields?.length, 1);
      assert.strictEqual(objects[1].fields![0].id, 50000);
    });

    test("should not have fields array for non-table objects", () => {
      const content = `codeunit 50000 "My Codeunit"
{
    trigger OnRun()
    begin
    end;
}`;
      const objects = parser.parseContent(content, "/test/codeunit.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].fields, undefined);
      assert.strictEqual(objects[0].enumValues, undefined);
    });

    test("should not have enumValues array for non-enum objects", () => {
      const content = `page 50000 "My Page"
{
    PageType = Card;
}`;
      const objects = parser.parseContent(content, "/test/page.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].fields, undefined);
      assert.strictEqual(objects[0].enumValues, undefined);
    });
  });

  suite("Edge Cases for Fields and Values", () => {
    test("should handle table with no fields", () => {
      const content = `table 50000 "Empty Table"
{
    fields
    {
    }
}`;
      const objects = parser.parseContent(content, "/test/empty.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].fields?.length, 0);
    });

    test("should handle enum with no values", () => {
      const content = `enum 50000 "Empty Enum"
{
    Extensible = true;
}`;
      const objects = parser.parseContent(content, "/test/empty.al");

      assert.strictEqual(objects.length, 1);
      assert.strictEqual(objects[0].enumValues?.length, 0);
    });

    test("should handle field with special characters in name", () => {
      const content = `table 50000 "My Table"
{
    fields
    {
        field(1; "My Field - (Test) [v2]"; Text[100])
        {
        }
    }
}`;
      const objects = parser.parseContent(content, "/test/special.al");

      assert.strictEqual(objects[0].fields![0].name, "My Field - (Test) [v2]");
    });

    test("should ignore commented field declarations", () => {
      const content = `table 50000 "My Table"
{
    fields
    {
        // field(1; CommentedField; Integer)
        field(2; RealField; Integer)
        {
        }
        /* field(3; MultiLineCommented; Text[50])
        {
        } */
    }
}`;
      const objects = parser.parseContent(content, "/test/commented.al");

      assert.strictEqual(objects[0].fields?.length, 1);
      assert.strictEqual(objects[0].fields![0].id, 2);
    });
  });
});
