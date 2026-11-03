import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(projectRoot, 'dist');
const builtHtml = await readFile(resolve(distRoot, 'index.html'), 'utf8');
const scriptPath = builtHtml.match(/<script[^>]+src="([^"]+)"/)?.[1];
const stylePath = builtHtml.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];

if (!scriptPath || !stylePath) throw new Error('Vite output is missing the expected JavaScript or CSS asset.');

const assetPath = (path) => resolve(distRoot, path.replace(/^\.\//, '').replace(/^\//, ''));
const [javascript, stylesheet] = await Promise.all([
  readFile(assetPath(scriptPath), 'utf8'),
  readFile(assetPath(stylePath), 'utf8'),
]);

const safeJavascript = javascript.replaceAll('</script', '<\\/script');
const standalone = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="theme-color" content="#020617"/>
  <meta name="description" content="Flixora streaming dashboard for movies, live sports, anime, dramas, shorts and novels."/>
  <title>Flixora — Movies, Sports, Anime & Stories</title>
  <style>${stylesheet}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${safeJavascript}</script>
</body>
</html>`;

await Promise.all([
  writeFile(resolve(projectRoot, 'Flixora-Open-Me.html'), standalone),
  writeFile(resolve(distRoot, 'Flixora-Open-Me.html'), standalone),
]);

console.log('Generated Flixora-Open-Me.html (standalone, no local server required).');
