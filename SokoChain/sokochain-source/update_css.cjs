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

const sprites = {
  water: [
    'wwwwwwwwwWwwwwww',
    'wwwwwwwwWcWwwwww',
    'wwwwwwwWcccWwwww',
    'wwwwwwwwWcWwwwww',
    'wwwwwwwwwWwwwwww',
    'wwwwwwwwwwwwwwWw',
    'wwwwwwwwwwwwwWcW',
    'wwwwwwwwwwwwWccc',
    'wwwwwwwwwwwwwWcW',
    'wwWwwwwwwwwwwwWw',
    'wWcWwwwwwwwwwwww',
    'WcccWwwwwwwwwwww',
    'wWcWwwwwwwwwwwww',
    'wwWwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwww'
  ],
  boat: [
    '________________',
    '_____bbbbbb_____',
    '____bRrrrrRb____',
    '___bRrrrrrrRb___',
    '___bRrrrrrrRb___',
    '___bRRrrrrRRb___',
    '___bRRrrrrRRb___',
    '___bRRrrrrRRb___',
    '___bRRRMMMRRb___',
    '___bRRRMMMRRb___',
    '___bRRRRRRRRb___',
    '____bbbbbbbb____',
    '_____bbbbbb_____',
    '________________',
    '________________',
    '________________'
  ],
  crate: [
    '________________',
    '___BBBBBBBBBB___',
    '__BLLLLLLLLLLB__',
    '__BLCCCCCCCCLB__',
    '__BLCLCCCCLCLB__',
    '__BLCCLCCLCCLB__',
    '__BLCCCLCLCCLB__',
    '__BLCCCCLCCCLB__',
    '__BLCCLCCLCCLB__',
    '__BLCLCCCCLCLB__',
    '__BLCCCCCCCCLB__',
    '__BLLLLLLLLLLB__',
    '___BBBBBBBBBB___',
    '________________',
    '________________',
    '________________'
  ],
  crate_goal: [
    '________________',
    '___GGGGGGGGGG___',
    '__GLLLLLLLLLLG__',
    '__GLCCCCCCCCLG__',
    '__GLCLCCCCLCLG__',
    '__GLCCLCCLCCLG__',
    '__GLCCCLCLCCLG__',
    '__GLCCCCLCCCLG__',
    '__GLCCLCCLCCLG__',
    '__GLCLCCCCLCLG__',
    '__GLCCCCCCCCLG__',
    '__GLLLLLLLLLLG__',
    '___GGGGGGGGGG___',
    '________________',
    '________________',
    '________________'
  ],
  roof: [
    '___dddddddddd___',
    '__dhhhhhhhhhhd__',
    '_dhhhhhhhhhhhhd_',
    '_dhhhddddddhhhd_',
    '_dhhdHHHHHHdhhd_',
    '_dhhdHddddHdhhd_',
    '_dhhdHdhhHdhhd_',
    '_dhhdHdhhHdhhd_',
    '_dhhdHddddHdhhd_',
    '_dhhdHHHHHHdhhd_',
    '_dhhhddddddhhhd_',
    '_dhhhhhhhhhhhhd_',
    '__dhhhhhhhhhhd__',
    '___dddddddddd___',
    '________________',
    '________________'
  ],
  gps: [
    '________________',
    '_____dddddd_____',
    '____dPPPPPPd____',
    '___dPPppppPPd___',
    '___dPppppppPd___',
    '___dPppddppPd___',
    '___dPppddppPd___',
    '___dPPppppPPd___',
    '____dPPPPPPd____',
    '_____dPPPPd_____',
    '______dPPd______',
    '_______dd_______',
    '_______GG_______',
    '______GGGG______',
    '________________',
    '________________'
  ]
};

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

let cssVariables = '';
for (const [name, matrix] of Object.entries(sprites)) {
  cssVariables += `  --sprite-${name}: ${generateSVG(matrix)};\n`;
}

let cssContent = fs.readFileSync('src/style.css', 'utf8');

// Replace lines 90-100 (approximately) with new styles.
const newStyles = `/* Gameplay pixel-map pass */
:root {
${cssVariables}}
.board { background-color: #414963; background-image: linear-gradient(45deg, #ffffff10 25%, transparent 25% 75%, #ffffff10 75%), linear-gradient(45deg, #ffffff08 25%, transparent 25% 75%, #ffffff08 75%); background-position: 0 0, 4px 4px; background-size: 8px 8px; }
.tile.water { background-color: #2b89a7; background-image: var(--sprite-water); background-size: cover; box-shadow: inset 0 0 0 2px #7ecde0, inset 0 0 0 4px #1d6280; }
.tile.water::before { display: none; }
.tile.obstacle { background: #59606c; box-shadow: inset 0 0 0 2px #aeb6b1, inset 0 0 0 5px #3e4750; }
.tile.roof::after { content: ''; position: absolute; inset: 0; background: var(--sprite-roof); background-size: cover; border: none; box-shadow: none; clip-path: none; transform: none; }
.tile.rescue-point { box-shadow: inset 0 0 0 2px #f7bd78, inset 0 0 0 5px #b4515a; }
.tile.gps-pin:not(.supply-crate)::after { content: ''; position: absolute; inset: 0; background: var(--sprite-gps); background-size: cover; border: none; box-shadow: none; filter: none; transform: none; border-radius: 0; clip-path: none; width: 100%; height: 100%; top: 0; left: 0; z-index: 3; }
.tile.supply-crate::after { content: ''; position: absolute; inset: 0; background: var(--sprite-crate); background-size: cover; border: none; box-shadow: none; border-radius: 0; width: 100%; height: 100%; z-index: 2; }
.tile.rescue-point.supply-crate::after { background: var(--sprite-crate_goal); z-index: 2; }
.tile.boat-craft::after { content: ''; position: absolute; inset: 0; background: var(--sprite-boat); background-size: cover; clip-path: none; filter: none; border: none; box-shadow: none; width: 100%; height: 100%; bottom: 0; left: 0; z-index: 3; }
`;

// regex to replace from /* Gameplay pixel-map pass */ to the end
cssContent = cssContent.replace(/\/\* Gameplay pixel-map pass \*\/[\s\S]*$/, newStyles);

fs.writeFileSync('src/style.css', cssContent);
console.log('Done replacing css');
