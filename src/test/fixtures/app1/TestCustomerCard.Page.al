page 50000 "Test Customer Card"
{
    Caption = 'Test Customer Card';
    PageType = Card;
    SourceTable = "Test Customer";

    layout
    {
        area(Content)
        {
            group(General)
            {
                field("No."; Rec."No.")
                {
                    ApplicationArea = All;
                }
                field(Name; Rec.Name)
                {
                    ApplicationArea = All;
                }
            }
        }
    }
}
