Drop any corporate/TLS-inspection root or intermediate CA certificates here (`.pem` or `.crt`,
PEM-encoded) if your network's SSL-inspecting proxy (Netskope, Zscaler, a corporate MITM
appliance, etc.) causes `dotnet restore` to fail inside the Docker build stage with
`NU1301 ... UntrustedRoot` even though it works fine on the host directly. The host OS trusts
your proxy's CA; the ephemeral Linux build container does not, unless you add it here.

The Dockerfile copies everything in this folder into the build stage's trust store and runs
`update-ca-certificates` before `dotnet restore`. If this folder is empty, that step is a no-op
-- most developers/CI runners need nothing here.

Files in this folder (other than this README and `.gitkeep`) are gitignored -- they're
environment-specific, not portable, and shouldn't be committed to the shared repo.
