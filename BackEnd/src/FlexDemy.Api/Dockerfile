# AD-13: multi-stage build -- SDK image to restore+publish, ASP.NET runtime image to run.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY FlexDemy.slnx .
COPY src/FlexDemy.Domain/FlexDemy.Domain.csproj src/FlexDemy.Domain/
COPY src/FlexDemy.Application/FlexDemy.Application.csproj src/FlexDemy.Application/
COPY src/FlexDemy.Infrastructure/FlexDemy.Infrastructure.csproj src/FlexDemy.Infrastructure/
COPY src/FlexDemy.Api/FlexDemy.Api.csproj src/FlexDemy.Api/
RUN dotnet restore src/FlexDemy.Api/FlexDemy.Api.csproj

COPY src/ src/
RUN dotnet publish src/FlexDemy.Api/FlexDemy.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

ENTRYPOINT ["dotnet", "FlexDemy.Api.dll"]
