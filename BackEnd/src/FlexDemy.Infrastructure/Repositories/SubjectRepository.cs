using FlexDemy.Application.MasterData.Subject;
using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;

namespace FlexDemy.Infrastructure.Repositories;

public class SubjectRepository(FlexDemyDbContext db) : MasterDataRepository<Subject>(db), ISubjectRepository;
