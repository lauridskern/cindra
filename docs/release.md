# Release

This project uses a minimal GitHub Actions release flow for signed macOS builds.

## What It Builds

- Trigger: pushing a tag matching `v*.*.*`.
- Preflight: `bun install --frozen-lockfile`, `bun run lint`, `bun run test`.
- Artifacts: signed and notarized macOS DMGs for:
  - Apple Silicon: `aarch64-apple-darwin`
  - Intel: `x86_64-apple-darwin`
- Publishing: a draft GitHub Release named `Cindra vX.Y.Z`.

## Required GitHub Secrets

Add these in GitHub repository settings under `Settings > Secrets and variables > Actions`.

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`.
- `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`.
- `APPLE_SIGNING_IDENTITY`: signing identity, for example `Developer ID Application: Your Name (TEAMID)`.
- `APPLE_ID`: Apple Developer account email.
- `APPLE_PASSWORD`: app-specific password from appleid.apple.com.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

## Creating The Certificate Secret

On a Mac with the Developer ID Application certificate installed:

```sh
security find-identity -v -p codesigning
```

Export the Developer ID Application certificate and private key from Keychain Access as a `.p12`, then encode it:

```sh
base64 -i DeveloperIDApplication.p12 | pbcopy
```

Paste the copied value into `APPLE_CERTIFICATE`.

## Releasing

Keep these versions aligned before tagging:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Then create and push a tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow creates a draft release so the artifacts can be downloaded and smoke tested before publishing.
