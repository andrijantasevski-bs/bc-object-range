import {
  ALObjectTypeWithId,
  AL_OBJECT_TYPES_WITH_ID,
  ALField,
  ALEnumValue,
  ALObjectWithFields,
} from "../types/index.js";

/**
 * Parser for AL (Application Language) files in Business Central projects.
 * Extracts object declarations and their fields/values while properly handling comments.
 */
export class ALObjectParser {
  /**
   * Regex pattern to match AL object declarations with IDs.
   * Captures: [1] object type, [2] object ID, [3] quoted name or [4] unquoted name
   */
  private static readonly OBJECT_PATTERN = new RegExp(
    `^\\s*(${AL_OBJECT_TYPES_WITH_ID.join(
      "|",
    )})\\s+(\\d+)\\s+(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))`,
    "i",
  );

  /**
   * Regex pattern to match "extends" clause for extension objects.
   * Captures: [1] quoted base object name or [2] unquoted base object name
   */
  private static readonly EXTENDS_PATTERN =
    /extends\s+(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))/i;

  /**
   * Regex pattern to match field declarations inside tables/tableextensions.
   * Captures: [1] field ID, [2] quoted name or [3] unquoted name, [4] data type
   */
  private static readonly FIELD_PATTERN =
    /^\s*field\s*\(\s*(\d+)\s*;\s*(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))\s*;\s*([^)]+)\)/i;

  /**
   * Regex pattern to match enum value declarations inside enums/enumextensions.
   * Captures: [1] ordinal ID, [2] quoted name or [3] unquoted name
   */
  private static readonly ENUM_VALUE_PATTERN =
    /^\s*value\s*\(\s*(\d+)\s*;\s*(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))\s*\)/i;

  /**
   * Parse AL content and extract all object declarations with their fields/values.
   * Handles single-line (//) and multi-line comments.
   * Supports multiple objects defined in a single file.
   *
   * @param content The raw content of an AL file
   * @param filePath The absolute path to the AL file
   * @returns Array of parsed AL objects with fields/values
   */
  public parseContent(content: string, filePath: string): ALObjectWithFields[] {
    const objects: ALObjectWithFields[] = [];
    const lines = content.split(/\r?\n/);

    let inMultiLineComment = false;
    let currentObject: ALObjectWithFields | null = null;
    let braceDepth = 0;
    let inFieldsBlock = false;
    let fieldsBlockDepth = 0;
    let expectingFieldsBlockBrace = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const lineNumber = i + 1; // 1-based line number

      // Handle multi-line comment continuation
      if (inMultiLineComment) {
        const endIndex = line.indexOf("*/");
        if (endIndex !== -1) {
          line = line.substring(endIndex + 2);
          inMultiLineComment = false;
        } else {
          // Entire line is inside a comment
          continue;
        }
      }

      // Process the line, handling comments
      const cleanedLine = this.stripComments(line);

      // Check if we entered a multi-line comment that doesn't close on this line
      if (this.hasUnclosedMultiLineComment(line)) {
        inMultiLineComment = true;
      }

      // Try to match an object declaration
      const objectMatch = ALObjectParser.OBJECT_PATTERN.exec(cleanedLine);
      if (objectMatch) {
        const objectType = objectMatch[1].toLowerCase() as ALObjectTypeWithId;
        const objectId = parseInt(objectMatch[2], 10);
        const objectName = objectMatch[3] || objectMatch[4]; // Quoted or unquoted name

        // Check for extends clause
        let extendsObject: string | undefined;
        const extendsMatch = ALObjectParser.EXTENDS_PATTERN.exec(cleanedLine);
        if (extendsMatch) {
          extendsObject = extendsMatch[1] || extendsMatch[2];
        }

        currentObject = {
          type: objectType,
          id: objectId,
          name: objectName,
          lineNumber,
          filePath,
          extendsObject,
          fields:
            objectType === "table" || objectType === "tableextension"
              ? []
              : undefined,
          enumValues:
            objectType === "enum" || objectType === "enumextension"
              ? []
              : undefined,
        };
        objects.push(currentObject);
        braceDepth = 0;
        inFieldsBlock = false;
        expectingFieldsBlockBrace = false;
      }

      // Track brace depth changes
      const openBraces = (cleanedLine.match(/{/g) || []).length;
      const closeBraces = (cleanedLine.match(/}/g) || []).length;
      const netBraceChange = openBraces - closeBraces;

      // If we're expecting a fields block brace and we see an open brace, enter fields block
      if (expectingFieldsBlockBrace && openBraces > 0) {
        inFieldsBlock = true;
        fieldsBlockDepth = braceDepth + 1; // The depth at which fields block starts
        expectingFieldsBlockBrace = false;
      }

      // Update brace depth
      braceDepth += netBraceChange;

      // Check for 'fields {' on same line (table/tableextension only)
      if (
        currentObject &&
        (currentObject.type === "table" ||
          currentObject.type === "tableextension") &&
        !inFieldsBlock
      ) {
        if (/\bfields\s*\{/i.test(cleanedLine)) {
          // 'fields {' on same line - we're now in fields block
          inFieldsBlock = true;
          fieldsBlockDepth = braceDepth; // Current depth after adding braces
        } else if (/\bfields\s*$/i.test(cleanedLine)) {
          // 'fields' keyword alone - expect { on next line
          expectingFieldsBlockBrace = true;
        }
      }

      // Parse field declarations if inside fields block of table/tableextension
      if (
        inFieldsBlock &&
        currentObject &&
        (currentObject.type === "table" ||
          currentObject.type === "tableextension")
      ) {
        const fieldMatch = ALObjectParser.FIELD_PATTERN.exec(cleanedLine);
        if (fieldMatch) {
          const field: ALField = {
            id: parseInt(fieldMatch[1], 10),
            name: fieldMatch[2] || fieldMatch[3],
            dataType: fieldMatch[4].trim(),
            lineNumber,
            filePath,
          };
          currentObject.fields!.push(field);
        }
      }

      // Parse enum value declarations if inside enum/enumextension
      if (
        currentObject &&
        (currentObject.type === "enum" ||
          currentObject.type === "enumextension") &&
        braceDepth > 0
      ) {
        const enumValueMatch =
          ALObjectParser.ENUM_VALUE_PATTERN.exec(cleanedLine);
        if (enumValueMatch) {
          const enumValue: ALEnumValue = {
            id: parseInt(enumValueMatch[1], 10),
            name: enumValueMatch[2] || enumValueMatch[3],
            lineNumber,
            filePath,
          };
          currentObject.enumValues!.push(enumValue);
        }
      }

      // Check if we exited the fields block
      if (inFieldsBlock && braceDepth < fieldsBlockDepth) {
        inFieldsBlock = false;
      }

      // Reset current object when we exit its scope
      if (currentObject && braceDepth <= 0 && closeBraces > 0) {
        currentObject = null;
        braceDepth = 0;
        inFieldsBlock = false;
        expectingFieldsBlockBrace = false;
      }
    }

    return objects;
  }

  /**
   * Strip comments from a line while preserving content outside comments.
   * Handles both single-line (//) and inline multi-line comments.
   */
  private stripComments(line: string): string {
    let result = line;

    // Remove multi-line comments that start and end on the same line
    // Use a loop to handle multiple inline comments
    let prevLength: number;
    do {
      prevLength = result.length;
      result = result.replace(/\/\*[\s\S]*?\*\//g, "");
    } while (result.length !== prevLength);

    // Remove single-line comments (everything after //)
    const singleLineIndex = result.indexOf("//");
    if (singleLineIndex !== -1) {
      result = result.substring(0, singleLineIndex);
    }

    return result;
  }

  /**
   * Check if a line starts a multi-line comment that doesn't close on the same line.
   */
  private hasUnclosedMultiLineComment(line: string): boolean {
    // First, remove any complete multi-line comments
    const withoutComplete = line.replace(/\/\*[\s\S]*?\*\//g, "");

    // Check if there's an opening /* without a closing */
    const openIndex = withoutComplete.lastIndexOf("/*");
    if (openIndex === -1) {
      return false;
    }

    // Check if there's a single-line comment before the /*
    const singleLineIndex = withoutComplete.indexOf("//");
    if (singleLineIndex !== -1 && singleLineIndex < openIndex) {
      return false; // The /* is inside a single-line comment
    }

    return true;
  }

  /**
   * Validate if a string is a valid AL object type with ID
   */
  public static isValidObjectType(type: string): type is ALObjectTypeWithId {
    return AL_OBJECT_TYPES_WITH_ID.includes(
      type.toLowerCase() as ALObjectTypeWithId,
    );
  }

  /**
   * Get all supported object types
   */
  public static getSupportedObjectTypes(): readonly string[] {
    return AL_OBJECT_TYPES_WITH_ID;
  }
}

// Export a singleton instance for convenience
export const alObjectParser = new ALObjectParser();
