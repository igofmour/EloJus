const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'node_modules/@supabase/supabase-js');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
if (manifest.version !== '2.118.0') throw new Error('Unexpected Supabase SDK version');
fs.copyFileSync(path.join(source, 'dist/umd/supabase.js'), path.join(root, 'dist/vendor/supabase.js'));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(root, 'dist/vendor/supabase-LICENSE.txt'));
console.log('Vendored @supabase/supabase-js 2.118.0');
