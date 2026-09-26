const fs = require('fs');

const pal = {
  '_': 'transparent',
  'W': '#1d6280', 
  'w': '#2b89a7', 
  'c': '#7ecde0', 
  
  'b': '#302c3b',
  'R': '#d85d50',
  'r': '#f0ce90',
  'M': '#69718b',
  
  'C': '#bd633d',
  'L': '#f0b160',
  'B': '#403044',
  
  'H': '#d8c2a4',
  'h': '#b88d77',
  'd': '#332d37',
  
  'P': '#e26852',
  'p': '#fff0d6',
  'S': '#c85358',
  'G': '#f5c16c'
};

const jetski = [
  '________________',
  '______hhhh______',
  '_____hhrrrr_____',
  '_____hRrrr______',
  '_____RRRRr_b____',
  '_____Rwwwr_bb___',
  '____bRRwrrMMb___',
  '___bRRRRMMLLbb__',
  '__bRppppppppMLb_',
  '_bRRRRRRRRRRRMMb',
  '__bbbbbbbbbbbbb_',
  '________________',
  '________________',
  '________________',
  '________________',
  '________________'
];

function generateSVG(matrix) {
  let paths = {};
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const char = matrix[y]?.[x];
      if (char === undefined || char === '_') continue;
      const color = pal[char];
      if (!paths[color]) paths[color] = [];
      paths[color].push(`M${x} ${y}h1v1h-1z`);
    }
  }
  let svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'>`;
  for (const color in paths) {
    svg += `<path fill='${color}' d='${paths[color].join('')}'/>`;
  }
  svg += `</svg>`;
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, "%27") + '")';
}

const newBoat = generateSVG(jetski);
let cssContent = fs.readFileSync('src/style.css', 'utf8');

cssContent = cssContent.replace(/--sprite-boat:\s*url\([^)]+\);/, `--sprite-boat: ${newBoat};`);
fs.writeFileSync('src/style.css', cssContent);
console.log('Jetski updated again!');
