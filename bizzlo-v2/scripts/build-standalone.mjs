import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
let html = await readFile(path.join(dist, 'index.html'), 'utf8');

const embeddedDataFiles = [
  'data/partner-university-index.json',
];

const embeddedData = {};
for (const file of embeddedDataFiles) {
  try {
    embeddedData[file] = await readFile(path.join(dist, file), 'utf8');
  } catch {
    // Optional data files are allowed to be absent in small preview builds.
  }
}

const scriptMatch = html.match(/<script type="module" crossorigin src="\/?assets\/([^"]+\.js)"><\/script>/);
if (!scriptMatch) throw new Error('Could not find built JavaScript asset in dist/index.html');

const js = await readFile(path.join(dist, 'assets', scriptMatch[1]), 'utf8');
const embeddedDataScript = `<script>
(() => {
  const embeddedData = ${JSON.stringify(embeddedData).replace(/<\/script/gi, '<\\/script')};
  const originalFetch = window.fetch?.bind(window);
  if (!originalFetch) return;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    const match = Object.keys(embeddedData).find((key) => url && (url.endsWith(key) || url.endsWith('/' + key)));
    if (match) {
      return Promise.resolve(new Response(embeddedData[match], {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }));
    }
    return originalFetch(input, init);
  };
})();
</script>`;
html = html.replace(scriptMatch[0], () => `${embeddedDataScript}\n<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);

const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="\/?assets\/([^"]+\.css)">/);
if (!cssMatch) throw new Error('Could not find built CSS asset in dist/index.html');

const css = await readFile(path.join(dist, 'assets', cssMatch[1]), 'utf8');
html = html.replace(cssMatch[0], () => `<style>\n${css}\n</style>`);

await writeFile(path.join(dist, 'bizzlo-standalone.html'), html);
