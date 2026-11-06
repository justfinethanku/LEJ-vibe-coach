# Contributing to Vibe Coach

Vibe Coach is trying to become a genuinely useful open-source learning layer for real repos.

The rule of thumb is simple:

- keep the engine stable
- keep the teaching artifacts inspectable
- keep the adaptation workflow dead simple

## Good Contribution Areas

- engine improvements that make the local app more reliable
- prompt and onboarding improvements that make first-run setup easier
- docs that make the repo easier for humans and agents to understand
- curriculum or research improvements that make the seeded example stronger
- bug fixes, polish, and quality-of-life upgrades

## Before You Start

For larger changes, open an issue or discussion first so we can line up on scope.

Small focused pull requests are much more likely to land than broad rewrites.

## Local Setup

Follow the [README setup](./README.md#run-this-repo) for prerequisites, locked
dependency installation, verification, and local startup. Use the
[local operations guide](./docs/local-operations.md) before refreshing or
resetting an installation that contains learner history.

## Pull Request Rules

- Keep PRs focused.
- Explain the user impact, not just the implementation detail.
- If you change behavior, update the relevant docs.
- If you change the engine, explain why the change belongs in the reusable layer instead of project-specific content.
- Do not commit local learner-state files such as `data/*.sqlite*`.
- Run `npm run verify` before opening the PR.

## Content and Adaptation Guidance

If you are adapting or extending Vibe Coach, read:

- `AGENTS.md`
- `vibe-coach.project.ts`
- `docs/repo-schema.md`
- `docs/ai-builder-playbook.md`

The main design goal is that a capable coding agent should be able to install Vibe Coach into a repo, research that repo, and leave behind a useful learning system for the next person.

## Commit Style

Use plain-English commit messages that describe the change clearly.

Examples:

- `Add embedded install prompts and workflow`
- `Improve quiz history view`
- `Clarify repo adaptation docs`

## Licensing

By submitting a contribution, you agree that your contribution will be licensed under the MIT License used by this repository.
