# AD-13: multi-stage build -- SDK image to restore+publish, ASP.NET runtime image to run.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Trust any corporate/TLS-inspection CA certs dropped in certs/ (see certs/README.md) --
# needed on networks with SSL-inspecting proxies (Netskope, Zscaler, etc.) where the host OS
# trusts the proxy's CA but this ephemeral build container doesn't, causing `dotnet restore`
# to fail NU1301 UntrustedRoot against nuget.org. A no-op when the folder holds no certs.
COPY src/FlexDemy.Api/certs/ /usr/local/share/ca-certificates/extra/
RUN find /usr/local/share/ca-certificates/extra -maxdepth 1 -type f \( -name '*.pem' -o -name '*.crt' \) \
      -exec sh -c 'cp "$1" "/usr/local/share/ca-certificates/$(basename "${1%.*}").crt"' _ {} \; ; \
    update-ca-certificates

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
