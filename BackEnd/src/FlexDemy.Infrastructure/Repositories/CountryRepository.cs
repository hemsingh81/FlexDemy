using FlexDemy.Application.MasterData.Country;
using FlexDemy.Domain.MasterData;
using FlexDemy.Infrastructure.Persistence;

namespace FlexDemy.Infrastructure.Repositories;

public class CountryRepository(FlexDemyDbContext db) : MasterDataRepository<Country>(db), ICountryRepository;
