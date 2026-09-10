const fs = require('node:fs');
const path = require('node:path');
const publicExtensions = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.pdf', '.mp4', '.webm']);

// Marp preserves image URLs; copy only public assets next to the HTML output.
function copyAssets(root, output) {
  const assets = path.join(root, 'assets');
  for (const file of [assets, output]) {
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) {
      throw new Error(`Refusing symbolic asset/output directory: ${file}`);
    }
  }
  fs.mkdirSync(output, { recursive: true });
  const target = path.join(output, 'assets');
  fs.rmSync(target, { recursive: true, force: true });
  if (fs.existsSync(assets)) {
    fs.cpSync(assets, target, {
      recursive: true,
      filter(source) {
        if (path.relative(assets, source).split(path.sep).some(part => part.startsWith('.'))) return false;
        const stat = fs.lstatSync(source);
        if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic asset: ${source}`);
        return stat.isDirectory() || publicExtensions.has(path.extname(source).toLowerCase());
      },
    });
  }
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  copyAssets(root, path.join(root, 'build'));
}
module.exports = { copyAssets };
