using FlexDemy.Infrastructure.Correlation;

namespace FlexDemy.Infrastructure.Tests.Correlation;

public class AsyncLocalCorrelationIdAccessorTests
{
    [Fact]
    public void Current_is_null_before_any_Set()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();

        Assert.Null(accessor.Current);
    }

    [Fact]
    public void Set_then_Current_round_trips_within_the_same_logical_call_context()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();

        accessor.Set("test-correlation-id");

        Assert.Equal("test-correlation-id", accessor.Current);
    }

    [Fact]
    public async Task Value_set_before_an_await_remains_visible_after_it()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        accessor.Set("survives-await");

        await Task.Delay(1);

        Assert.Equal("survives-await", accessor.Current);
    }

    [Fact]
    public async Task Value_flows_into_a_child_async_operation_started_within_the_same_context()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        accessor.Set("flows-to-child");

        var observedInChild = await Task.Run(() => accessor.Current);

        Assert.Equal("flows-to-child", observedInChild);
    }

    [Fact]
    public void Set_can_overwrite_a_previous_value()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        accessor.Set("first");

        accessor.Set("second");

        Assert.Equal("second", accessor.Current);
    }
}
