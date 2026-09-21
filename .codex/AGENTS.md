# Global workspace rules

## Lightweight SDLC

Lightweight SDLC means that every implementation task has a GitHub issue before
code changes start.

- Read-only questions, reviews, and investigations do not require an issue.
- If the user supplies an issue number, use that issue.
- If the user requests implementation without an issue number, search for one
  clear matching open issue. Reuse that issue, or create a new issue when no
  clear match exists. The implementation request authorizes issue creation, so
  do not request separate approval.
- After the issue exists, use the `gh-issue` start or resume workflow. Let that
  workflow create or attach the linked branch and worktree.
- Do not create an implementation branch or worktree directly with Git or
  Supacode.

## Skill updates

Use the manager that manages the installed skill.

- When `npx skills` manages the skill, run `npx skills update <skill> --global
  --yes` for a global installation or `npx skills update <skill> --project
  --yes` for a project installation.
- When another manager manages the installation, use that manager's update
  command.
- Inspect the installation metadata only when the manager or the scope is
  unknown.

## Git worktrees

For a repository at `$HOME/Github/<repository>`, create every task worktree
with Supacode under
`$HOME/Github/worktrees/<repository>/<worktree-name>`.

- Use `supacode repo worktree-new -r <repo-id> --branch <branch> --base <base>
  --location "$HOME/Github/worktrees/<repository>" --name <worktree-name>
  --background`.
- Capture the command output as the new Supacode worktree ID.
- Keep the primary checkout at `$HOME/Github/<repository>` on its stable
  branch, normally `main`.
- If an existing task worktree is outside the worktree root, make sure that it is clean and inactive, then move it under the correct repository folder before new work starts.
