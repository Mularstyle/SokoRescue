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

for (const [name, matrix] of Object.entries(sprites)) {
  console.log(`--sprite-${name}: ${generateSVG(matrix)};`);
}
