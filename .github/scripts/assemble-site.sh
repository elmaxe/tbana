#!/usr/bin/env bash
# Builds the GitHub Pages site: the default branch at the root and every open pull request
# from this repository under pr/<number>/.
#
#   assemble-site.sh <out-dir> <prs.json>
#
# prs.json is `gh pr list --json number,title,isCrossRepository,url` output. Run it from a
# checkout of the default branch after `npm ci`; PR heads are fetched from origin. Every build
# gets a build.json ({ id, root }) and the root gets builds.json, which src/build-switcher.ts reads.
#
# Pull requests are built with the default branch's toolchain: its node_modules, vite.config.ts
# and Vite. Vite only compiles and bundles a PR's files, so none of its code runs here (the config
# also keeps Vite from loading a PostCSS config from the checkout). A PR that changes the build
# setup or adds dependencies is previewed with main's until it merges.
set -euo pipefail

out=$(realpath -m "$1")
prs=$2
tool=$PWD
vite="$tool/node_modules/.bin/vite"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Builds the site in directory $1 into $2.
build() {
  (cd "$1" && "$vite" build --config "$tool/vite.config.ts" --outDir "$2" --emptyOutDir --logLevel warn)
}

rm -rf "$out"
main_sha=$(git rev-parse HEAD)
build "$tool" "$out"
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
  src="$work/pr-$num"
  mkdir -p "$src"
  git archive "$sha" | tar -x -C "$src"
  rm -rf "$src/node_modules"
  ln -s "$tool/node_modules" "$src/node_modules"
  if ! build "$src" "$out/pr/$num"; then
    echo "::warning::PR #$num did not build, skipping it"
    rm -rf "$out/pr/$num"
    continue
  fi
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
