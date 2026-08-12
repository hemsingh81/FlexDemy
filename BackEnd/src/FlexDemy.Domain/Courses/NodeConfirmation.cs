namespace FlexDemy.Domain.Courses;

// Story 2.9: Unconfirmed is deliberately ordinal 0 (the desired default) -- avoids the exact EF
// Core CLR-default-omission bug Story 2.4 hit with LifecycleState (a non-nullable enum property
// whose default CLR value must equal the desired DB default, or EF silently omits the column
// from INSERT).
public enum NodeConfirmation
{
    Unconfirmed,
    Confirmed,
}
