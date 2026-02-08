# Release Process

BenchMark uses [release-please](https://github.com/googleapis/release-please) for automated versioning and changelog generation, driven by [conventional commits](https://www.conventionalcommits.org/).

## How It Works

```
Developer commits (feat: ..., fix: ...)
  -> merge to main
  -> release-please creates/updates a Release PR
  -> team merges Release PR
  -> GitHub Release + tag created automatically
```

1. Developers write commits using the conventional commit format
2. On every push to `main`, the Release workflow (`.github/workflows/release.yml`) runs release-please
3. Release-please analyzes new commits since the last release and creates (or updates) a **Release PR** containing:
   - A version bump in `package.json`
   - An updated `CHANGELOG.md` with grouped entries
   - An updated `.release-please-manifest.json`
4. When the team merges the Release PR, release-please creates a **GitHub Release** with a git tag (e.g. `v0.2.0`) and release notes

## Conventional Commits

Every commit message must follow the conventional commit format. This is enforced locally by a husky git hook and in CI by a commitlint job on pull requests.

### Format

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Common Types

| Type | Purpose | Version Bump |
|------|---------|--------------|
| `feat` | New feature | minor (0.x.0) |
| `fix` | Bug fix | patch (0.0.x) |
| `docs` | Documentation only | patch |
| `refactor` | Code change that neither fixes a bug nor adds a feature | patch |
| `perf` | Performance improvement | patch |
| `test` | Adding or updating tests | none (hidden) |
| `style` | Code style changes (formatting, semicolons, etc.) | none (hidden) |
| `build` | Changes to the build system or dependencies | patch |
| `ci` | CI/CD configuration changes | patch |
| `chore` | Other changes that don't modify src or test files | patch |

### Breaking Changes

For a major version bump, add `!` after the type or include `BREAKING CHANGE:` in the commit footer:

```
feat!: remove deprecated /api/v1 endpoints

BREAKING CHANGE: The v1 API has been removed. Use /api/v2 instead.
```

### Examples

```bash
# Feature
git commit -m "feat: add PDF export for run results"

# Bug fix
git commit -m "fix: prevent duplicate evaluation submissions"

# Feature with scope
git commit -m "feat(dashboard): add date range filter to analytics"

# Chore
git commit -m "chore: update dependencies"

# Docs
git commit -m "docs: add API authentication guide"
```

## Version Display

The current version is injected at build time and visible in two places:

- **Frontend**: Displayed in the header next to "Agent Evaluation" (e.g. `v0.1.0`)
- **Backend**: Returned in the `/api/health` endpoint response under the `version` field

The version is read from the root `package.json` at build time via:
- Vite `define` option for the frontend
- Webpack `DefinePlugin` for the backend

## Configuration Files

| File | Purpose |
|------|---------|
| `release-please-config.json` | Release-please settings: release type, changelog sections, tag format |
| `.release-please-manifest.json` | Tracks the current released version |
| `commitlint.config.js` | Commitlint configuration (extends `@commitlint/config-conventional`) |
| `.husky/commit-msg` | Git hook that runs commitlint on every commit |
| `.github/workflows/release.yml` | GitHub Actions workflow that runs release-please |
| `.github/workflows/ci.yml` | Contains the `commitlint` job (PR-only) |

## Changelog Sections

Commits are grouped into these sections in `CHANGELOG.md`:

| Commit Type | Changelog Section |
|-------------|-------------------|
| `feat` | Features |
| `fix` | Bug Fixes |
| `perf` | Performance Improvements |
| `refactor` | Code Refactoring |
| `docs` | Documentation |
| `build` | Build System |
| `ci` | CI/CD |
| `chore` | Miscellaneous |
| `test` | *(hidden)* |
| `style` | *(hidden)* |

## Bootstrapping the First Release

After the release system is merged to `main` for the first time, create the initial tag and GitHub Release manually:

```bash
git tag v0.1.0
git push origin v0.1.0
gh release create v0.1.0 --title "v0.1.0" --notes "Initial release with release automation."
```

From this point forward, release-please handles everything automatically.

## Troubleshooting

### Commit rejected locally

If your commit is rejected by the husky hook, the message doesn't follow conventional commit format. Check the error output for details. Common mistakes:

- Missing type prefix: `update readme` -> `docs: update readme`
- Capitalized description: `feat: Add feature` -> `feat: add feature`
- Type not recognized: `feature: ...` -> `feat: ...`

### CI commitlint job fails

The commitlint CI job checks all commits in a PR. If any commit in the PR has a non-conventional message, the job fails. Options:

1. Squash-merge the PR with a conventional commit message
2. Rebase and reword the offending commits

### Release PR not created

- Ensure the Release workflow has `contents: write` and `pull-requests: write` permissions
- Check that commits since the last release include at least one releasable type (`feat`, `fix`, etc.)
- Commits with `test` or `style` types alone won't trigger a release
