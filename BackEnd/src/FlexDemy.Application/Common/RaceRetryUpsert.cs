namespace FlexDemy.Application.Common;

// Shared by AdaptiveLearningService (UpsertGeneratedLevelAsync/UpsertGeneratedWayAsync/
// UpsertLevelOverrideAsync/UpsertWayOverrideAsync), KeywordDefinitionService (UpsertGeneratedAsync/
// UpsertOverrideAsync), and ExerciseService (UpsertExerciseAsync) -- all 3 independently
// implemented the identical "get-or-insert with unique-constraint race retry" shape: two
// concurrent requests can both see no existing row for the same natural key, both construct one,
// and the second SaveChangesAsync then fails against the DB's own unique index. FlexDemy.Application
// has no EF Core package reference (Clean Architecture boundary -- Application is
// persistence-ignorant), so a lost race can't be caught by DbUpdateException type; instead this
// catches broadly, then verifies the failure was actually a lost race by re-checking whether the
// row now exists, rethrowing untouched if it doesn't (a genuinely different failure is never
// silently absorbed).
public static class RaceRetryUpsert
{
    // `applyUpdateOnRaceLoss` captures the one behavioral difference between the two call shapes
    // that used to be two separately-copy-pasted methods per feature:
    //  - AI generation (false): the loser's freshly-generated AI content is simply discarded --
    //    the winner's row already has valid generated content from the exact same code path, so
    //    that's returned as-is.
    //  - A tutor's explicit override/save write (true): it must still take effect even after
    //    losing the race -- retried as an UPDATE against the now-existing winner row instead
    //    (last-write-wins for a deliberate edit action).
    public static async Task<T> UpsertWithRaceRetryAsync<T>(
        Func<CancellationToken, Task<T?>> lookup,
        Func<T> createNew,
        Action<T> add,
        Action<T> applyUpdate,
        bool applyUpdateOnRaceLoss,
        IUnitOfWork unitOfWork,
        CancellationToken cancellationToken)
        where T : class
    {
        var row = await lookup(cancellationToken);
        if (row is not null)
        {
            applyUpdate(row);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return row;
        }

        var newRow = createNew();
        add(newRow);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return newRow;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var winner = await lookup(cancellationToken);
            if (winner is null) throw;

            if (applyUpdateOnRaceLoss)
            {
                applyUpdate(winner);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            return winner;
        }
    }
}
