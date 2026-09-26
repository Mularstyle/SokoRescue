const fs = require('fs');

const pal = {
  '_': 'transparent',
  'b': '#302c3b',
  'p': '#fff0d6',
  'r': '#f0ce90',
  'u': '#d85d50', // red shirt
  'U': '#2b6380',
  'R': '#d85d50',
  'G': '#39b54a',
  'M': '#aeb6b1', // shaft grey
  'm': '#335a60', // dark motor
  'C': '#bd633d', // wood
  'F': '#e26852', // red flag
  'W': '#e1f8ff'  // splash
};

const boat = [
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '_______________________Fb_______',
  '_________________pppp__FFb______',
  '_________________pppp__F_b______',
  '__________________rr___b_b______',
  '_________________uuu___b_b__b___',
  '________mmmmm___ruuur__b_b_bCb__',
  '_______Mmmmmm___r_u_r__b_b_bUb__',
  '_____MM_mmmmm___r___r__b_b_bRb__',
  '_MMMM___bbmmb_bCCCCCCCCCCCCbGb__',
  '________bUUUUUUUUUUUUUUUUUUUbb__',
  '_______WbRRRRRRRRRRRRRRRRRRb____',
  '______WW_bGGGGGGGGGGGGGGGGb_____',
  '_WW_WWW___bbbbbbbbbbbbbbbb______',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________',
  '________________________________'
];

function generateSVG(matrix) {
  let paths = {};
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const char = matrix[y]?.[x];
      if (char === undefined || char === '_') continue;
      const color = pal[char];
      if (!paths[color]) paths[color] = [];
      paths[color].push(`M${x} ${y}h1v1h-1z`);
    }
  }
  let svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' shape-rendering='crispEdges'>`;
  for (const color in paths) {
    svg += `<path fill='${color}' d='${paths[color].join('')}'/>`;
  }
  svg += `</svg>`;
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, "%27") + '")';
}

const newBoat = generateSVG(boat);
let cssContent = fs.readFileSync('src/style.css', 'utf8');

cssContent = cssContent.replace(/--sprite-boat:\s*url\([^)]+\);/, `--sprite-boat: ${newBoat};`);
fs.writeFileSync('src/style.css', cssContent);
console.log('Boat updated to 32x32 long-tail boat!');
