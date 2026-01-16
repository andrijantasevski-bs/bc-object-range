// This is a file with commented objects
// They should NOT be parsed

/*
table 50001 "Commented Table"
{
    Caption = 'This should be ignored';
}
*/

// page 50001 "Commented Page"

codeunit 50001 "Test Codeunit"
{
    trigger OnRun()
    begin
        Message('Hello World');
    end;
}

/* Another multi-line comment
report 50002 "Commented Report"
{
}
*/

report 50002 "Test Report"
{
    Caption = 'Test Report';

    dataset
    {
    }
}
