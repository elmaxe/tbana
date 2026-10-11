// The service worker's part of the build (vite.config.ts): src/sw.ts goes out as sw.js at the
// root of the build, so that its scope is the whole build, with the list of every file the build
// has (its pages, scripts and styles, and public/ as copied) and a hash of each in front of it.
//
// The worker is only stripped of its types, not bundled, so it can import types and nothing else.
// It is read from the build's root, so a pull request's preview gets the PR's worker (or none, from
// before there was one).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { transformWithOxc } from 'vite';
import type { Plugin, ResolvedConfig } from 'vite';

// public/'s files that are left out: the aerial photos are only ever there locally (their licence
// keeps them from being published), and they're big
const LOCAL_ONLY = ['data/ortho/'];

// The first 16 hex digits of the SHA-256, as src/sw.ts checks what it downloads.
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 16);

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const path = join(dir, e.name);
    if (e.isDirectory()) yield* walk(path);
    else if (e.isFile()) yield path;
  }
}

export function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'tbana:service-worker',
    apply: 'build',
    // after the pages are written, so they're in the bundle
    enforce: 'post',
    configResolved(c) { config = c; },
    async generateBundle(_, bundle) {
      // pull requests branched before there was a worker are built with this config too
      const src = join(config.root, 'src/sw.ts');
      if (!existsSync(src)) return;
      const files: Record<string, string> = {};
      for (const out of Object.values(bundle)) files[out.fileName] = hash(out.type === 'chunk' ? out.code : out.source);
      if (config.publicDir && config.build.copyPublicDir) {
        for (const path of walk(config.publicDir)) {
          const name = relative(config.publicDir, path).split(sep).join('/');
          if (!LOCAL_ONLY.some((p) => name.startsWith(p))) files[name] = hash(readFileSync(path));
        }
      }
      const { code } = await transformWithOxc(readFileSync(src, 'utf8'), src);
      // a service worker is a script, not a module: without the `export {}` left where the
      // imports of types were
      const script = code.replace(/^export \{\};?$/m, '');
      // in a stable order, so that the same files give the same sw.js
      const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `const BUILD = ${JSON.stringify({ files: sorted })};\n${script}` });
    },
  };
}
