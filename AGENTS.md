# Website maintenance

- This is the source for https://hw3129.github.io/, hosted by GitHub Pages from
  `hw3129/hw3129.github.io` on `main`.
- When the user requests a commit or publication, review the changes and run
  `./scripts/publish.sh "A concise description of the change"`. This builds the
  exact staged source, commits, pushes, and checks the matching Pages run.
  Editing alone is not a request to publish.
- All commits for this website must use `hw3129` and
  `338377905+hw3129@users.noreply.github.com` for both author and committer.
  Set identity only for this repository, never globally.
- Use Hugo **0.92.2 extended**, matching `.github/workflows/pages.yml`.
- After changing the publication script, run `python3 tests/test_publish.py`.
  These tests use isolated repositories and do not publish the real website.
- The authenticated GitHub CLI is available as `gh` or the ignored local
  `.tools/gh`. It uses the existing login; do not ask for tokens or repeat login
  unless authentication has actually expired.
- Never force-push, automatically rewrite history, or discard local changes as
  part of routine publication. If the remote has advanced, inspect and preserve
  both sets of changes before continuing.
- Report publication success only after the GitHub Pages job for the pushed
  commit succeeds. Keep unpushed local commits when a network error occurs.
- Keep build output, backups, local tool binaries, editor settings, and `.env`
  files out of Git. Website source is public, including hidden paper data.
- Contributor sidebar caching is independent of commit attribution. Do not
  rewrite commits merely to force a sidebar refresh.
