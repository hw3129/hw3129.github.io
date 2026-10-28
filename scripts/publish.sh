#!/bin/bash
# Check the exact staged source, commit as hw3129, and wait for GitHub Pages.
set -euo pipefail

fail() { printf '停止：%s\n' "$*" >&2; exit 1; }

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  printf '用法：./scripts/publish.sh ["提交说明"]\n不填说明时使用“Update website”。成功后会显示网站地址。\n'
  exit 0
fi
[[ $# -le 1 ]] || fail '提交说明请用引号包起来。'
message=${1:-Update website}
[[ "$message" != -* ]] || fail '不支持这个选项；查看用法请运行 --help。'

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
cd "$root"
[[ "$(git rev-parse --show-toplevel)" == "$root" ]] || fail '请在网站仓库中运行。'
[[ "$(git symbolic-ref --quiet --short HEAD)" == main ]] || fail '请先切换到 main 分支。'
repo=hw3129/hw3129.github.io
site=https://hw3129.github.io/
email=338377905+hw3129@users.noreply.github.com
remote=https://github.com/$repo.git
[[ "$(git remote get-url --all origin)" == "$remote" && "$(git remote get-url --push --all origin)" == "$remote" ]] || fail 'origin 必须指向 hw3129/hw3129.github.io，且只能有一个推送地址。'
[[ -z "$(git ls-files -u)" ]] || fail '请先解决 Git 冲突。'
for state in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
  [[ ! -e "$(git rev-parse --git-path "$state")" ]] || fail '请先完成进行中的 Git 操作。'
done

if command -v gh >/dev/null 2>&1; then
  gh=$(command -v gh)
elif [[ -x "$root/.tools/gh" ]]; then
  gh="$root/.tools/gh"
else
  fail '未找到 GitHub CLI。请安装 gh 并运行 gh auth login。'
fi
command -v hugo >/dev/null 2>&1 || fail '未找到 Hugo，请安装 Hugo 0.92.2 extended。'
hugo_version=$(hugo version)
[[ "$hugo_version" == 'hugo v0.92.2+extended '* ]] || fail '本地需使用与发布配置一致的 Hugo 0.92.2 extended。'
[[ "$("$gh" api user --jq .login)" == hw3129 ]] || fail 'GitHub CLI 当前账号必须是 hw3129。'

# Use the existing GitHub login without changing global Git credentials.
printf -v helper '%q' "$gh"
git_remote() {
  git -c credential.helper= -c "credential.helper=!$helper auth git-credential" \
    -c http.version=HTTP/1.1 -c http.postBuffer=16777216 "$@"
}

lock=$(git rev-parse --git-path website-publish.lock)
mkdir "$lock" 2>/dev/null || fail "已有发布流程在运行；若之前被强制结束，请确认没有发布进程后删除 ${lock}。"
scratch=''
cleanup() {
  if [[ -n "$scratch" ]]; then rm -rf -- "$scratch"; fi
  rmdir "$lock"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf '\n1/4 检查远程版本和提交身份…\n'
git_remote fetch --no-tags origin refs/heads/main:refs/remotes/origin/main
git merge-base --is-ancestor origin/main HEAD || fail 'GitHub 上有尚未合入的提交。请先检查并合并远程修改，再重新运行；本次没有提交或覆盖远程。'
while IFS= read -r identity; do
  [[ "$identity" == "hw3129 <$email> hw3129 <$email>" ]] || fail '尚未推送的提交中存在其他作者身份，请先修正后发布。'
done < <(git log origin/main..HEAD --format='%an <%ae> %cn <%ce>')

# Only website source and its maintenance files are eligible for auto-staging.
files=()
while IFS= read -r -d '' file; do
  if git check-ignore --no-index --quiet -- "$file"; then
    fail "已跟踪或暂存的文件被忽略规则排除：${file}。请先从暂存内容中移除本地文件。"
  fi
  case "$file" in
    config.toml|README.md|AGENTS.md|.gitignore|.github/workflows/*|archetypes/*|assets/*|content/*|data/*|layouts/*|scripts/*|static/*|tests/*)
      files+=("$file") ;;
    *) fail "发现发布范围之外的改动：${file}。请先确认该文件的用途，避免自动提交无关文件。" ;;
  esac
done < <(git diff --no-renames --name-only -z; git diff --cached --no-renames --name-only -z; git ls-files --others --exclude-standard -z)

if [[ ${#files[@]} -eq 0 && "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]; then
  printf '没有新的修改或待推送的提交。网站：%s\n' "$site"
  exit 0
fi

if [[ ${#files[@]} -gt 0 ]]; then
  git add -A -- "${files[@]}"
fi
printf '\n2/4 构建本次将提交的内容…\n'
git diff --cached --stat
scratch=$(mktemp -d "${TMPDIR:-/tmp}/website-publish.XXXXXX")
mkdir "$scratch/source"
git checkout-index --all --prefix="$scratch/source/"
tree=$(git write-tree)
if ! hugo --source "$scratch/source" --environment production --minify \
  --baseURL "$site" --destination "$scratch/public" --cacheDir "$scratch/cache"; then
  fail '网站构建失败，尚未创建提交或推送。改动仍保留在暂存区；修复后重新运行即可。'
fi
[[ -s "$scratch/public/index.html" ]] || fail '构建没有生成首页，尚未提交或推送。'
[[ "$(git write-tree)" == "$tree" ]] || fail '构建期间暂存内容发生变化，请重新运行。'

printf '\n3/4 以 hw3129 提交并推送…\n'
git config --local user.name hw3129
git config --local user.email "$email"
if ! git diff --cached --quiet; then
  GIT_AUTHOR_NAME=hw3129 GIT_AUTHOR_EMAIL="$email" \
    GIT_COMMITTER_NAME=hw3129 GIT_COMMITTER_EMAIL="$email" \
    git commit -m "$message"
fi
sha=$(git rev-parse HEAD)
[[ "$(git rev-parse HEAD^{tree})" == "$tree" ]] || fail '提交内容与检查过的构建不一致，尚未推送。'
[[ "$(git log -1 --format='%an <%ae> %cn <%ce>')" == "hw3129 <$email> hw3129 <$email>" ]] || fail '提交身份不符合要求，尚未推送。'
git_remote push origin HEAD:refs/heads/main || fail '推送未确认成功，本地提交已保留。请检查网络或远程更新后重新运行同一命令。'

printf '\n4/4 等待 GitHub Pages 发布完成…\n'
run=''
for ((attempt = 0; attempt < 12; attempt++)); do
  run=$("$gh" run list --repo "$repo" --workflow pages.yml --branch main \
    --event push --commit "$sha" --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  [[ -z "$run" ]] || break
  sleep 5
done
[[ -n "$run" ]] || fail "代码已推送，但暂未查到发布任务，请查看 https://github.com/$repo/actions 。不要把此提示视为发布成功。"
if ! "$gh" run watch "$run" --repo "$repo" --exit-status --compact --interval 10; then
  fail "代码已推送，但发布未确认成功。请查看 https://github.com/$repo/actions/runs/$run 。"
fi
deployed=$("$gh" run view "$run" --repo "$repo" --json headSha,conclusion,jobs \
  --jq ".headSha == \"$sha\" and .conclusion == \"success\" and any(.jobs[]; .name == \"deploy\" and .conclusion == \"success\")")
[[ "$deployed" == true ]] || fail "发布任务未成功部署本次提交。请查看 https://github.com/$repo/actions/runs/$run 。"
printf '\n发布成功：%s\n提交：%s\n' "$site" "$sha"
if [[ -n "$(git status --porcelain)" ]]; then
  printf '提示：发布期间产生了其他本地修改，尚未包含在这次发布中。\n'
fi
