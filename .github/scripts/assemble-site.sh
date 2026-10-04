#!/usr/bin/env bash
# Builds the GitHub Pages site: the default branch at the root and every open pull request
# from this repository under pr/<number>/.
#
#   assemble-site.sh <out-dir> <prs.json>
#
# prs.json is `gh pr list --json number,title,isCrossRepository,url` output. Run it
# from a checkout of the default branch; PR heads are fetched from origin. Every build gets a
# build.json ({ id, root }) and the root gets builds.json, which src/build-switcher.js reads.
set -euo pipefail

out=$1
prs=$2

# Copies the site files at a commit into a directory. Repo tooling is left out.
export_tree() {
  mkdir -p "$2"
  git archive "$1" | tar -x -C "$2"
  rm -rf "$2/.github" "$2/.gitignore"
}

rm -rf "$out"
main_sha=$(git rev-parse HEAD)
export_tree "$main_sha" "$out"
jq -n '{id: "main", root: ""}' > "$out/build.json"

builds=$(jq -n --arg sha "$main_sha" '[{id: "main", label: "main", path: "", sha: $sha}]')

# Pull requests from forks are skipped: their code would run on this site's origin.
while read -r pr; do
  [ -z "$pr" ] && continue
  num=$(jq -r .number <<<"$pr")
  if ! git fetch --quiet --no-tags --depth=1 origin "refs/pull/$num/head"; then
    echo "::warning::Could not fetch PR #$num, skipping it"
    continue
  fi
  sha=$(git rev-parse FETCH_HEAD)
  export_tree "$sha" "$out/pr/$num"
  jq -n --arg id "pr-$num" '{id: $id, root: "../../"}' > "$out/pr/$num/build.json"
  builds=$(jq --argjson pr "$pr" --arg sha "$sha" '. + [{
    id: "pr-\($pr.number)",
    label: "PR #\($pr.number): \($pr.title)",
    path: "pr/\($pr.number)/",
    sha: $sha,
    url: $pr.url
  }]' <<<"$builds")
  echo "Added PR #$num at ${sha:0:7}"
done < <(jq -c 'sort_by(.number) | .[] | select(.isCrossRepository | not)' "$prs")

jq -n --argjson builds "$builds" '{builds: $builds}' > "$out/builds.json"
touch "$out/.nojekyll"
