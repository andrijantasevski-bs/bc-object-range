// File with multiple objects

enum 50003 "Test Status"
{
    Extensible = true;

    value(0; Open)
    {
        Caption = 'Open';
    }
    value(1; Closed)
    {
        Caption = 'Closed';
    }
}

permissionset 50003 "Test PermSet"
{
    Caption = 'Test Permission Set';
    Assignable = true;

    Permissions =
        table "Test Customer" = X,
        page "Test Customer Card" = X;
}

query 50003 "Test Query"
{
    Caption = 'Test Query';

    elements
    {
        dataitem(TestCustomer; "Test Customer")
        {
            column(No; "No.")
            {
            }
            column(Name; Name)
            {
            }
        }
    }
}
