import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.argv[2] || process.cwd());
const repository = process.argv[3] || "reversetechmed-bit/reversetechmed-bit-s-Project";
const ignoredPrefixes = [".git/", ".manus-logs/", "node_modules/", "coverage/", "dist/"];
const ignoredExact = new Set([".project-config.json"]);

function run(command, args) {
  return execFileSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NO_COLOR: "1", TERM: "dumb", GH_FORCE_TTY: "0", GH_PAGER: "cat" },
  }).trim();
}

function api(method, endpoint, payload) {
  const bodyFile = join(tmpdir(), `github-sync-${process.pid}-${Math.random().toString(16).slice(2)}.json`);
  try {
    writeFileSync(bodyFile, JSON.stringify(payload));
    return run("gh", ["api", "--method", method, endpoint, "--input", bodyFile]);
  } finally {
    if (existsSync(bodyFile)) rmSync(bodyFile, { force: true });
  }
}

function get(endpoint) {
  return JSON.parse(run("gh", ["api", endpoint]));
}

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: projectRoot, encoding: "buffer" })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter(path => !ignoredExact.has(path) && !ignoredPrefixes.some(prefix => path.startsWith(prefix)) && !path.split("/").some(segment => segment.startsWith(".env")));

if (!tracked.length) throw new Error("No tracked project files were found to synchronize.");

let repositoryInfo = get(`repos/${repository}`);
if (repositoryInfo.size === 0 || !repositoryInfo.default_branch) {
  api("PUT", `repos/${repository}/contents/README.md`, {
    message: "chore: initialize repository",
    content: Buffer.from("# REVERSE TECH Warehouse System\n").toString("base64"),
  });
  repositoryInfo = get(`repos/${repository}`);
}

const branch = repositoryInfo.default_branch || "main";
const ref = get(`repos/${repository}/git/ref/heads/${branch}`);
const parentCommit = get(`repos/${repository}/git/commits/${ref.object.sha}`);
const tree = tracked.map(path => {
  const bytes = readFileSync(join(projectRoot, path));
  const blob = JSON.parse(api("POST", `repos/${repository}/git/blobs`, { content: bytes.toString("base64"), encoding: "base64" }));
  return { path, mode: "100644", type: "blob", sha: blob.sha };
});

const createdTree = JSON.parse(api("POST", `repos/${repository}/git/trees`, { base_tree: parentCommit.tree.sha, tree }));
const commit = JSON.parse(api("POST", `repos/${repository}/git/commits`, {
  message: "feat: Arabic RTL REVERSE TECH warehouse system",
  tree: createdTree.sha,
  parents: [ref.object.sha],
}));

api("PATCH", `repos/${repository}/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
console.log(JSON.stringify({ repository, branch, commit: commit.sha, files: tracked.length }, null, 2));
