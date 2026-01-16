import {
  ALObject,
  ALObjectTypeWithId,
  AL_OBJECT_TYPES_WITH_ID,
} from "../types/index.js";

/**
 * Parser for AL (Application Language) files in Business Central projects.
 * Extracts object declarations while properly handling comments.
 */
export class ALObjectParser {
  /**
   * Regex pattern to match AL object declarations with IDs.
   * Captures: [1] object type, [2] object ID, [3] quoted name or [4] unquoted name
   */
  private static readonly OBJECT_PATTERN = new RegExp(
    `^\\s*(${AL_OBJECT_TYPES_WITH_ID.join(
      "|"
    )})\\s+(\\d+)\\s+(?:"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))`,
    "i"
  );

  /**
   * Parse AL content and extract all object declarations.
   * Handles single-line (//) and multi-line comments.
   * Supports multiple objects defined in a single file.
   *
   * @param content The raw content of an AL file
   * @param filePath The absolute path to the AL file
   * @returns Array of parsed AL objects
   */
  public parseContent(content: string, filePath: string): ALObject[] {
    const objects: ALObject[] = [];
    const lines = content.split(/\r?\n/);

    let inMultiLineComment = false;

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
      const match = ALObjectParser.OBJECT_PATTERN.exec(cleanedLine);
      if (match) {
        const objectType = match[1].toLowerCase() as ALObjectTypeWithId;
        const objectId = parseInt(match[2], 10);
        const objectName = match[3] || match[4]; // Quoted or unquoted name

        objects.push({
          type: objectType,
          id: objectId,
          name: objectName,
          lineNumber,
          filePath,
        });
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
      type.toLowerCase() as ALObjectTypeWithId
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
