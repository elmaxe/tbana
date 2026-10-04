// Build picker for the GitHub Pages deployment.
//
// The Pages workflow publishes main at the site root and every open pull request under pr/<n>/.
// Each published build gets a build.json ({ id, root }) next to its pages, and the site root
// gets builds.json listing all of them. Served locally there is no build.json, so the picker
// stays hidden.

const fetchJSON = async (url) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};

export async function mountBuildSwitcher(container) {
  if (!container) return;
  let current, builds;
  try {
    current = await fetchJSON('build.json');
    ({ builds } = await fetchJSON(`${current.root}builds.json`));
  } catch {
    return;
  }
  if (!builds?.length) return;

  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Build');
  for (const b of builds) {
    const opt = new Option(b.label, b.id, false, b.id === current.id);
    if (b.sha) opt.title = b.sha.slice(0, 7);
    select.add(opt);
  }
  // The build we're on was taken down (its PR closed) but the browser still had it cached.
  if (!builds.some((b) => b.id === current.id)) {
    select.add(new Option(`${current.id} (removed)`, current.id, true, true), 0);
  }

  select.addEventListener('change', () => {
    const build = builds.find((b) => b.id === select.value);
    if (!build) return;
    const page = location.pathname.split('/').pop();
    const url = new URL(`${current.root}${build.path}${page}`, location.href);
    url.search = location.search;
    url.hash = location.hash;
    location.href = url.href;
  });

  const label = document.createElement('label');
  label.className = 'build-switcher';
  const title = document.createElement('span');
  title.textContent = 'Build';
  label.append(title, select);
  container.append(label);
  container.hidden = false;
}
