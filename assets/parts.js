// Original SVG artwork for each PC part, used as textures on the 3D model in story.js.
// Kept inline because WebGL refuses images loaded from separate files when the page opens from disk.
(() => {
  // Seeded, so the board looks the same on every visit.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const svg = (w, h, body, defs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
  const FONT = `font-family="Arial, Helvetica, sans-serif"`;
  const BOLT = "M13 3 5 14h5.5l-1 7 8.5-11h-5.5z";
  const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join("");
  const silk = (x, y, text, size = 13) => `<text x="${x}" y="${y}" ${FONT} font-size="${size}" fill="#c9ccd6" letter-spacing=".5">${text}</text>`;

  /* Motherboard: 875 x 1000 maps to the 3D board. */
  const traces = repeat(150, () => {
    let x = rnd() * 875, y = rnd() * 1000;
    let d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
    const dir = rnd() > 0.5;
    for (let s = 0; s < 3; s++) {
      const len = 30 + rnd() * 150;
      if ((s % 2 === 0) === dir) x += rnd() > 0.5 ? len : -len;
      else y += rnd() > 0.5 ? len : -len;
      d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
    }
    return `<path d="${d}"/>`;
  });
  const smds = repeat(240, () => {
    const x = rnd() * 860, y = rnd() * 985, wide = rnd() > 0.5;
    return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${wide ? 9 : 4}" height="${wide ? 4 : 9}" fill="${rnd() > 0.7 ? "#8a8d96" : "#2b2d33"}"/>`;
  });
  const hole = (x, y) => `<circle cx="${x}" cy="${y}" r="15" fill="#6d5a2c"/><circle cx="${x}" cy="${y}" r="9" fill="#050506"/>`;
  const board = svg(875, 1000, `
    <rect width="875" height="1000" fill="url(#pcb)"/>
    <g fill="none" stroke="#2a2d36" stroke-width="2" stroke-linejoin="round">${traces}</g>
    ${smds}
    ${[[30, 30], [440, 30], [845, 30], [30, 520], [845, 520], [30, 970], [440, 970], [845, 970]].map(([x, y]) => hole(x, y)).join("")}
    <rect x="240" y="170" width="220" height="220" rx="6" fill="none" stroke="#7d818c" stroke-width="2" stroke-dasharray="14 6"/>
    ${silk(250, 160, "CPU_FAN")}
    ${silk(520, 60, "DDR5_A1  A2  B1  B2")}
    ${silk(90, 850, "PCIE_1 x16")}
    ${silk(90, 900, "PCIE_2 x4")}
    ${silk(620, 480, "M.2_2")}
    ${silk(760, 640, "SATA")}
    ${silk(770, 370, "ATX_24")}
    ${silk(60, 985, "AUDIO", 11)}
    ${silk(300, 985, "PC OPTIMIZER  GAMING BOARD  REV 1.0", 12)}
    <rect x="70" y="905" width="520" height="16" rx="3" fill="#191b20" stroke="#3b3e47"/>
    <rect x="745" y="650" width="56" height="150" rx="3" fill="#20222a" stroke="#555864"/>
    ${repeat(4, (i) => `<rect x="752" y="${660 + i * 34}" width="42" height="24" fill="#090a0d"/>`)}
  `, `<linearGradient id="pcb" x2="1" y2="1"><stop stop-color="#191b21"/><stop offset="1" stop-color="#0f1014"/></linearGradient>`);

  /* Graphics card shroud with three fan wells: 1450 x 360. */
  const well = (x) => `<circle cx="${x}" cy="180" r="150" fill="#3b3f49"/><circle cx="${x}" cy="180" r="143" fill="#060608"/>`;
  const gpu = svg(1450, 360, `
    <rect width="1450" height="360" fill="url(#steel)"/>
    <polygon points="0,0 500,0 370,120 0,120" fill="#3a3d47"/>
    <polygon points="1450,360 950,360 1080,240 1450,240" fill="#3a3d47"/>
    <polygon points="500,0 950,0 870,60 580,60" fill="#16181d"/>
    <polygon points="500,360 950,360 870,300 580,300" fill="#16181d"/>
    <g stroke="#5b5f6b" stroke-width="3" fill="none"><path d="M0 120H370L500 0"/><path d="M1450 240H1080L950 360"/><path d="M580 60H870M580 300H870"/></g>
    ${well(265)}${well(725)}${well(1185)}
    <rect x="0" y="0" width="1450" height="4" fill="#6c7079"/>
    <text x="725" y="32" text-anchor="middle" ${FONT} font-size="20" font-weight="700" fill="#d4d7e0" letter-spacing="6">PC OPTIMIZER</text>
  `, `<linearGradient id="steel" x2="0" y2="1"><stop stop-color="#30333c"/><stop offset=".5" stop-color="#21232a"/><stop offset="1" stop-color="#2b2e36"/></linearGradient>`);

  /* Memory heat spreader: 130 x 600. */
  const ram = svg(130, 600, `
    <rect width="130" height="600" fill="url(#m)"/>
    <g fill="#1a1c22">${repeat(8, (i) => `<polygon points="0,${20 + i * 34} 65,${48 + i * 34} 130,${20 + i * 34} 130,${34 + i * 34} 65,${62 + i * 34} 0,${34 + i * 34}"/>`)}</g>
    <rect x="16" y="320" width="98" height="230" rx="4" fill="#0e0f13"/>
    <text transform="translate(58 535) rotate(-90)" ${FONT} font-size="26" font-weight="700" fill="#e7e9f0" letter-spacing="2">DDR5</text>
    <text transform="translate(88 535) rotate(-90)" ${FONT} font-size="16" fill="#a5a9b5">6000 MHz 16 GB</text>
  `, `<linearGradient id="m" x2="1"><stop stop-color="#5a5e69"/><stop offset=".5" stop-color="#8d919c"/><stop offset="1" stop-color="#4e525c"/></linearGradient>`);

  /* Cooler pump cap: radial brushed metal. */
  const brushed = repeat(180, (i) => {
    const a = (i / 180) * Math.PI * 2;
    return `<line x1="256" y1="256" x2="${(256 + Math.cos(a) * 256).toFixed(1)}" y2="${(256 + Math.sin(a) * 256).toFixed(1)}" stroke="${i % 3 ? "#30333b" : "#4a4e58"}" stroke-width="3"/>`;
  });
  const pump = svg(512, 512, `<rect width="512" height="512" fill="#2a2c33"/>${brushed}<circle cx="256" cy="256" r="240" fill="none" stroke="#6b6f7a" stroke-width="8"/><circle cx="256" cy="256" r="190" fill="#0f1014" fill-opacity=".55"/>`);

  /* Hexagonal perforated steel, for the top panel and the power supply cover. */
  const vent = svg(280, 162, `<rect width="280" height="162" fill="#1a1c22"/><g fill="#040405">${[[20, 20], [76, 20], [132, 20], [188, 20], [244, 20], [48, 68], [104, 68], [160, 68], [216, 68], [272, 68], [20, 116], [76, 116], [132, 116], [188, 116], [244, 116]].map(([x, y]) => `<polygon points="${x},${y - 20} ${x + 18},${y - 10} ${x + 18},${y + 10} ${x},${y + 20} ${x - 18},${y + 10} ${x - 18},${y - 10}"/>`).join("")}</g>`);

  /* Power supply cover: 925 x 220. */
  const psu = svg(925, 220, `
    <rect width="925" height="220" fill="url(#p)"/>
    <g fill="#060608">${repeat(26, (i) => `<rect x="${500 + i * 15}" y="36" width="8" height="148" rx="3"/>`)}</g>
    <path transform="translate(40 66) scale(4)" d="${BOLT}" fill="#c9ccd6"/>
    <text x="150" y="105" ${FONT} font-size="30" font-weight="700" fill="#e1e3ea" letter-spacing="5">PC OPTIMIZER</text>
    <text x="150" y="140" ${FONT} font-size="17" fill="#8d919d" letter-spacing="3">850 W</text>
  `, `<linearGradient id="p" x2="0" y2="1"><stop stop-color="#23252c"/><stop offset="1" stop-color="#15161b"/></linearGradient>`);

  /* Radiator and heatsink fins. */
  const fins = svg(128, 64, `<rect width="128" height="64" fill="#0d0e11"/><g fill="#5b5f69">${repeat(32, (i) => `<rect x="${i * 4}" width="2" height="64"/>`)}</g>`);

  /* Rear ports. */
  const io = svg(150, 250, `
    <rect width="150" height="250" fill="#54585f"/>
    ${[[18, 18], [18, 62], [18, 106]].map(([x, y]) => `<rect x="${x}" y="${y}" width="50" height="30" rx="2" fill="#0a0a0d"/><rect x="${x + 5}" y="${y + 8}" width="40" height="8" fill="#2d6bc4"/>`).join("")}
    ${[[82, 18], [82, 62]].map(([x, y]) => `<rect x="${x}" y="${y}" width="50" height="30" rx="2" fill="#0a0a0d"/><rect x="${x + 5}" y="${y + 8}" width="40" height="8" fill="#9d2b2b"/>`).join("")}
    <rect x="82" y="106" width="50" height="40" rx="2" fill="#0a0a0d"/>
    ${repeat(5, (i) => `<circle cx="${30 + i * 22}" cy="205" r="9" fill="${["#3aa655", "#d9a63a", "#d84d8a", "#3a7fd9", "#222"][i]}" stroke="#111" stroke-width="3"/>`)}
  `);

  /* Graphics card bracket with display outputs. */
  const bracket = svg(60, 420, `
    <rect width="60" height="420" fill="#a9adb6"/>
    ${[50, 130, 210].map((y) => `<rect x="14" y="${y}" width="32" height="56" rx="4" fill="#0a0a0d"/>`).join("")}
    <rect x="14" y="290" width="32" height="46" rx="10" fill="#0a0a0d"/>
    ${repeat(6, (i) => `<rect x="26" y="${360 + i * 8}" width="8" height="4" fill="#2f3137"/>`)}
  `);

  /* M.2 drive heatsink: 750 x 120. */
  const m2 = svg(750, 120, `
    <rect width="750" height="120" fill="url(#h)"/>
    <g stroke="#1b1d23" stroke-width="5">${repeat(16, (i) => `<line x1="${380 + i * 24}" y1="12" x2="${360 + i * 24}" y2="108"/>`)}</g>
    <text x="28" y="72" ${FONT} font-size="34" font-weight="700" fill="#e1e3ea" letter-spacing="4">M.2 NVMe</text>
  `, `<linearGradient id="h" x2="0" y2="1"><stop stop-color="#50545e"/><stop offset="1" stop-color="#2c2f37"/></linearGradient>`);

  /* Chipset cover: 400 x 360. */
  const chipset = svg(400, 360, `
    <rect width="400" height="360" fill="#272a31"/>
    <polygon points="0,0 400,0 400,110 240,360 0,360" fill="#33363f"/>
    <g fill="none" stroke="#6d717c" stroke-width="3"><path d="M400 110 240 360"/><path d="M40 40H360"/></g>
    <path transform="translate(110 90) scale(8)" d="${BOLT}" fill="#0e0f13"/>
  `);

  /* Fan hub sticker. */
  const hub = svg(128, 128, `<circle cx="64" cy="64" r="64" fill="#101115"/><circle cx="64" cy="64" r="56" fill="none" stroke="#3f424c" stroke-width="3"/><path transform="translate(22 22) scale(3.5)" d="${BOLT}" fill="#c9ccd6"/>`);

  /* Braided sleeve for cables and cooler tubes. */
  const braid = svg(64, 64, `<rect width="64" height="64" fill="#101116"/><g stroke="#3d4049" stroke-width="5">${repeat(5, (i) => `<line x1="${i * 16 - 16}" y1="0" x2="${i * 16 + 16}" y2="64"/><line x1="${i * 16 + 16}" y1="0" x2="${i * 16 - 16}" y2="64" stroke="#23252c"/>`)}</g>`);

  /* Directional scratches for aluminium. */
  const brush = svg(256, 256, `<rect width="256" height="256" fill="#8f939c"/><g stroke-width="1">${repeat(120, () => `<line x1="0" x2="256" y1="${(rnd() * 256).toFixed(1)}" y2="${(rnd() * 256).toFixed(1)}" stroke="${rnd() > 0.5 ? "#a9adb5" : "#767a83"}"/>`)}</g>`);

  window.PC_PARTS = { board, gpu, ram, pump, vent, psu, fins, io, bracket, m2, chipset, hub, braid, brush };
})();
