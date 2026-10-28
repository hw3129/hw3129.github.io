#!/usr/bin/env python3
"""Offline publication checks: real Git repositories, local-only transports."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


PROJECT = Path(__file__).resolve().parents[1]
REAL_GIT = shutil.which("git")
REMOTE = "https://github.com/hw3129/hw3129.github.io.git"
EMAIL = "338377905+hw3129@users.noreply.github.com"
IDENTITY = {
    "GIT_AUTHOR_NAME": "hw3129",
    "GIT_AUTHOR_EMAIL": EMAIL,
    "GIT_COMMITTER_NAME": "hw3129",
    "GIT_COMMITTER_EMAIL": EMAIL,
}

# Only fetch/push are redirected. Everything else, including the index, commits,
# ancestry checks, hooks, and non-fast-forward protection, uses the real Git.
STUB = r'''
import json, os, pathlib, subprocess, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
state = pathlib.Path(os.environ["PUBLISH_TEST_STATE"])
def log(kind, value):
    with (state / (kind + ".jsonl")).open("a") as out:
        out.write(json.dumps(value) + "\n")
if name == "git":
    position = 0
    while position < len(args) and args[position] == "-c":
        position += 2
    command = args[position]
    extra = []
    if command in ("fetch", "push", "ls-remote"):
        log("transport", command)
        if command == "push" and (state / "fail_push").exists():
            sys.exit("Simulated transport failure")
        extra = ["-c", "protocol.file.allow=always", "-c",
                 "url." + pathlib.Path(os.environ["PUBLISH_TEST_BARE"]).as_uri()
                 + ".insteadOf=https://github.com/hw3129/hw3129.github.io.git"]
    result = subprocess.run([os.environ["PUBLISH_TEST_GIT"], *extra, *args])
    sys.exit(result.returncode)
elif name == "hugo":
    if args == ["version"]:
        print("hugo v0.92.2+extended test/amd64 BuildDate=test")
    else:
        source = pathlib.Path(args[args.index("--source") + 1])
        text = (source / "content/_index.md").read_text()
        log("build", {"source": str(source), "content": text})
        if "FAIL_BUILD" in text:
            sys.exit("Simulated Hugo validation failure")
        if (state / "edit_during_build").exists():
            pathlib.Path(os.environ["PUBLISH_TEST_REPO"], "content/_index.md").write_text("Concurrent edit\n")
        output = pathlib.Path(args[args.index("--destination") + 1])
        output.mkdir(parents=True)
        (output / "index.html").write_text("<html>" + text + "</html>")
elif name == "gh":
    log("gh", args)
    if args[:2] == ["api", "user"]:
        print("hw3129")
    elif args[:2] == ["run", "list"]:
        sha = args[args.index("--commit") + 1]
        remote_sha = subprocess.check_output([
            os.environ["PUBLISH_TEST_GIT"], "--git-dir=" + os.environ["PUBLISH_TEST_BARE"],
            "rev-parse", "main"], text=True).strip()
        if sha != remote_sha:
            sys.exit("Workflow lookup did not use the pushed commit")
        print("12345")
    elif args[:2] == ["run", "watch"]:
        sys.exit(1 if (state / "fail_ci").exists() else 0)
    elif args[:2] == ["run", "view"]:
        print("false" if (state / "skip_deploy").exists() else "true")
    else:
        sys.exit("Unexpected gh call: " + repr(args))
else:
    sys.exit("Unknown test tool")
'''


class PublishTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="website-publish-test-")
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name).resolve()
        self.repo, self.bare = base / "website", base / "remote.git"
        self.state, self.bin = base / "state", base / "bin"
        for directory in (self.repo, self.state, self.bin):
            directory.mkdir()
        self.global_config = base / "global.gitconfig"
        self.global_config.write_text("[user]\n\tname = Wrong Global User\n\temail = wrong@example.invalid\n")
        self.env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        self.env.update({
            "GIT_CONFIG_GLOBAL": str(self.global_config), "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_TERMINAL_PROMPT": "0", "GIT_ALLOW_PROTOCOL": "file",
            "PATH": str(self.bin) + os.pathsep + os.defpath,
            "PUBLISH_TEST_GIT": REAL_GIT, "PUBLISH_TEST_BARE": str(self.bare),
            "PUBLISH_TEST_STATE": str(self.state), "PUBLISH_TEST_REPO": str(self.repo),
        })
        for name in ("git", "hugo", "gh"):
            executable = self.bin / name
            executable.write_text("#!" + sys.executable + "\n" + STUB)
            executable.chmod(0o755)
        self.git("init", "--initial-branch=main")
        self.git("init", "--bare", "--initial-branch=main", str(self.bare))
        self.write("scripts/publish.sh", (PROJECT / "scripts/publish.sh").read_text())
        (self.repo / "scripts/publish.sh").chmod(0o755)
        self.write(".gitignore", (PROJECT / ".gitignore").read_text())
        self.write("README.md", "Test website\n")
        self.write("content/_index.md", "Initial content\n")
        self.commit("Initial website")
        self.git("remote", "add", "origin", REMOTE)
        self.git("push", str(self.bare), "main")
        self.git("update-ref", "refs/remotes/origin/main", self.head())
        self.initial = self.head()

    def git(self, *args, cwd=None, identity=False):
        env = dict(self.env)
        if identity:
            env.update(IDENTITY)
        return subprocess.run([REAL_GIT, *args], cwd=cwd or self.repo, env=env,
                              capture_output=True, text=True, check=True).stdout.strip()

    def write(self, name, text):
        target = self.repo / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def commit(self, message):
        self.git("add", "-A")
        self.git("commit", "-m", message, identity=True)

    def head(self, remote=False):
        return self.git(*(["--git-dir=" + str(self.bare)] if remote else []), "rev-parse", "main")

    def calls(self, name):
        file = self.state / (name + ".jsonl")
        return [json.loads(line) for line in file.read_text().splitlines()] if file.exists() else []

    def publish(self, extra_env=None):
        env = dict(self.env)
        env.update(extra_env or {})
        return subprocess.run(["/bin/bash", "scripts/publish.sh", "Update test website"],
                              cwd=self.repo, env=env, capture_output=True, text=True, timeout=30)

    def assert_stopped_before_commit(self, result, local_head=None, remote_head=None):
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.head(), local_head or self.initial)
        self.assertEqual(self.head(remote=True), remote_head or self.initial)
        self.assertNotIn("push", self.calls("transport"))
        self.assertNotIn("发布成功", result.stdout)

    def advance_remote(self):
        peer = self.state / "peer"
        self.git("clone", str(self.bare), str(peer))
        (peer / "README.md").write_text("Remote update\n")
        self.git("add", "README.md", cwd=peer)
        self.git("commit", "-m", "Remote update", cwd=peer, identity=True)
        self.git("push", "origin", "main", cwd=peer)
        return self.head(remote=True)

    def test_identity_overrides_global_and_environment(self):
        before = self.global_config.read_bytes()
        self.write("content/_index.md", "Updated content\n")
        result = self.publish({k: "Wrong Environment" if k.endswith("NAME") else "wrong@example.invalid"
                               for k in IDENTITY})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.head(), self.head(remote=True))
        expected = "hw3129 <" + EMAIL + "> hw3129 <" + EMAIL + ">"
        self.assertEqual(self.git("log", "-1", "--format=%an <%ae> %cn <%ce>"), expected)
        self.assertEqual(self.global_config.read_bytes(), before)
        self.assertEqual(self.git("config", "--local", "user.email"), EMAIL)
        self.assertIn("发布成功", result.stdout)

    def test_build_failure_does_not_commit_or_push(self):
        self.write("content/_index.md", "FAIL_BUILD\n")
        self.assert_stopped_before_commit(self.publish())
        self.assertEqual(self.git("show", ":content/_index.md"), "FAIL_BUILD")

    def test_remote_ahead_stops(self):
        remote = self.advance_remote()
        self.write("content/_index.md", "Local edit\n")
        self.assert_stopped_before_commit(self.publish(), remote_head=remote)
        self.assertEqual(self.git("diff", "--cached", "--name-only"), "")

    def test_diverged_history_stops(self):
        self.write("content/_index.md", "Local commit\n")
        self.commit("Local update")
        local, remote = self.head(), self.advance_remote()
        self.assert_stopped_before_commit(self.publish(), local, remote)

    def test_failed_push_retries_without_duplicate_commit(self):
        self.write("content/_index.md", "Local edit\n")
        failure = self.state / "fail_push"
        failure.touch()
        result = self.publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.head(remote=True), self.initial)
        committed = self.head()
        self.assertNotEqual(committed, self.initial)
        failure.unlink()
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.head(), committed)
        self.assertEqual(self.head(remote=True), committed)
        self.assertEqual(self.git("rev-list", "--count", "main"), "2")

    def test_outside_file_stops(self):
        self.write("notes.txt", "Local notes\n")
        self.assert_stopped_before_commit(self.publish())

    def test_staged_outside_file_deleted_from_worktree_stops(self):
        self.write("notes.txt", "Local notes\n")
        self.git("add", "notes.txt")
        (self.repo / "notes.txt").unlink()
        self.assert_stopped_before_commit(self.publish())
        self.assertEqual(self.git("show", ":notes.txt"), "Local notes")

    def test_ignored_files_are_not_uploaded(self):
        self.write("content/_index.md", "Publish this\n")
        for name in (".env", "data/.env.local", ".claude/settings.json", ".backups/note", ".tools/local"):
            self.write(name, "Stay local\n")
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        names = self.git("--git-dir=" + str(self.bare), "ls-tree", "-r", "--name-only", "main")
        self.assertNotIn(".env", names)
        self.assertNotIn(".claude", names)
        self.assertNotIn(".backups", names)
        self.assertNotIn(".tools", names)

    def test_force_staged_ignored_file_stops(self):
        self.write("data/.env.local", "Stay local\n")
        self.git("add", "--force", "data/.env.local")
        self.assert_stopped_before_commit(self.publish())

    def test_no_changes_is_noop(self):
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.head(), self.initial)
        self.assertNotIn("push", self.calls("transport"))
        self.assertEqual(self.calls("build"), [])
        self.assertIn("没有新的修改", result.stdout)

    def test_ci_failure_is_not_reported_as_success(self):
        self.write("content/_index.md", "New source\n")
        (self.state / "fail_ci").touch()
        result = self.publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotEqual(self.head(remote=True), self.initial)
        self.assertNotIn("发布成功", result.stdout)

    def test_skipped_deployment_is_not_reported_as_success(self):
        self.write("content/_index.md", "New source\n")
        (self.state / "skip_deploy").touch()
        result = self.publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("发布成功", result.stdout)
        self.assertTrue(any(args[:2] == ["run", "view"] for args in self.calls("gh")))

    def test_build_and_commit_use_same_snapshot(self):
        self.write("content/_index.md", "Checked content\n")
        (self.state / "edit_during_build").touch()
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.calls("build")[0]["content"], "Checked content\n")
        self.assertEqual(self.git("--git-dir=" + str(self.bare), "show", "main:content/_index.md"), "Checked content")
        self.assertEqual((self.repo / "content/_index.md").read_text(), "Concurrent edit\n")


if __name__ == "__main__":
    unittest.main(verbosity=2)
