const { ALObjectParser } = require('./out/parsers/alObjectParser.js');
const parser = new ALObjectParser();
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
const objects = parser.parseContent(content, '/test/table.al');
console.log('Objects:', JSON.stringify(objects, null, 2));
console.log('Fields count:', objects[0].fields?.length);
