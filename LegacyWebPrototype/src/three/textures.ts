import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export interface NairobiTexturePack {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  grassBump: THREE.CanvasTexture;
  curbMap: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  kiccMap: THREE.CanvasTexture;
  timesTowerMap: THREE.CanvasTexture;
  afyaMap: THREE.CanvasTexture;
  parliamentClockMap: THREE.CanvasTexture;
  buildingMaps: THREE.CanvasTexture[];
  matatuLiveries: THREE.CanvasTexture[];
  checkeredMap: THREE.CanvasTexture;
  finishBannerMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  makeHighwaySign: (topLine: string, bottomLine: string, code: string) => THREE.CanvasTexture;
  makeTurnSign: (arrow: string, label: string) => THREE.CanvasTexture;
  makeLicensePlate: (text: string) => THREE.CanvasTexture;
  dispose: () => void;
}

export function createNairobiTexturePack(maxAnisotropy: number): NairobiTexturePack {
  const allTextures: THREE.CanvasTexture[] = [];
  const track = (t: THREE.CanvasTexture) => {
    allTextures.push(t);
    return t;
  };

  // 1. Rich Sun-Baked Nairobi Asphalt + Tire-Track Wear + Aggregate
  const [asphC, asphCtx] = makeCanvas(512, 512);
  asphCtx.fillStyle = '#1f232a';
  asphCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 22 + Math.floor(Math.random() * 34);
    asphCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    asphCtx.fillRect(x, y, 2, 2);
  }
  // Subtle wheel-path polish & center oil shadow
  asphCtx.fillStyle = 'rgba(10, 12, 16, 0.32)';
  asphCtx.fillRect(80, 0, 58, 512);
  asphCtx.fillRect(185, 0, 44, 512);
  asphCtx.fillRect(285, 0, 44, 512);
  asphCtx.fillRect(374, 0, 58, 512);
  const asphaltMap = track(finalizeColorTex(asphC, maxAnisotropy, 1, 1));

  const [bumpC, bumpCtx] = makeCanvas(256, 256);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 70 + Math.floor(Math.random() * 115);
    bumpCtx.fillStyle = `rgb(${v},${v},${v})`;
    bumpCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const asphaltBump = track(new THREE.CanvasTexture(bumpC));
  asphaltBump.wrapS = THREE.RepeatWrapping;
  asphaltBump.wrapT = THREE.RepeatWrapping;
  asphaltBump.anisotropy = maxAnisotropy;

  // 2. Lush Textured Nairobi Highland Park Turf & Red-Soil Flecks (replaces flat mint green!)
  const [grC, grCtx] = makeCanvas(512, 512);
  grCtx.fillStyle = '#2d4d2c';
  grCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const roll = Math.random();
    if (roll < 0.14) {
      // Nairobi red murram earth fleck
      grCtx.fillStyle = 'rgba(92, 56, 38, 0.45)';
    } else if (roll < 0.58) {
      grCtx.fillStyle = `rgb(${36 + Math.floor(Math.random() * 18)}, ${68 + Math.floor(Math.random() * 26)}, ${34 + Math.floor(Math.random() * 16)})`;
    } else {
      grCtx.fillStyle = `rgb(${54 + Math.floor(Math.random() * 20)}, ${96 + Math.floor(Math.random() * 26)}, ${45 + Math.floor(Math.random() * 16)})`;
    }
    grCtx.fillRect(x, y, 3, 3);
  }
  const grassMap = track(finalizeColorTex(grC, maxAnisotropy, 16, 16));

  const [grBC, grBCtx] = makeCanvas(256, 256);
  grBCtx.fillStyle = '#808080';
  grBCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8000; i++) {
    const v = 70 + Math.floor(Math.random() * 115);
    grBCtx.fillStyle = `rgb(${v},${v},${v})`;
    grBCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 3);
  }
  const grassBump = track(new THREE.CanvasTexture(grBC));
  grassBump.wrapS = THREE.RepeatWrapping;
  grassBump.wrapT = THREE.RepeatWrapping;
  grassBump.repeat.set(16, 16);
  grassBump.anisotropy = maxAnisotropy;

  // 3. Signature Nairobi Yellow & Black Painted Curbstone texture
  const [curbC, curbCtx] = makeCanvas(512, 64);
  for (let i = 0; i < 8; i++) {
    curbCtx.fillStyle = i % 2 === 0 ? '#eab308' : '#18181b';
    curbCtx.fillRect(i * 64, 0, 64, 64);
    curbCtx.fillStyle = 'rgba(0,0,0,0.2)';
    curbCtx.fillRect(i * 64, 48, 64, 16);
  }
  const curbMap = track(finalizeColorTex(curbC, maxAnisotropy, 12, 1));

  // 4. Interlocking Cabro Paving Stone Sidewalks
  const [swC, swCtx] = makeCanvas(256, 256);
  swCtx.fillStyle = '#7c7870';
  swCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 24) {
    const offset = (y / 24) % 2 === 0 ? 0 : 12;
    for (let x = -12; x < 256; x += 24) {
      const shade = 108 + ((Math.abs(x) * 7 + y * 13) % 28);
      swCtx.fillStyle = `rgb(${shade},${shade - 4},${shade - 9})`;
      swCtx.fillRect(x + offset + 1, y + 1, 22, 22);
      swCtx.strokeStyle = 'rgba(28, 25, 23, 0.45)';
      swCtx.lineWidth = 1.5;
      swCtx.strokeRect(x + offset, y, 24, 24);
    }
  }
  const sidewalkMap = track(finalizeColorTex(swC, maxAnisotropy, 18, 18));

  // 5. KICC Terracotta Ribbed Cylindrical Tower Facade
  const [kiccC, kiccCtx] = makeCanvas(512, 512);
  kiccCtx.fillStyle = '#b45c3c';
  kiccCtx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 28; row++) {
    const y = row * (512 / 28);
    kiccCtx.fillStyle = '#8d4328';
    kiccCtx.fillRect(0, y, 512, 4);
    for (let col = 0; col < 32; col++) {
      const x = col * 16;
      const lit = (row * 5 + col * 3) % 11 === 0;
      kiccCtx.fillStyle = lit ? '#fbbf24' : '#172030';
      kiccCtx.fillRect(x + 3, y + 5, 10, 11);
      kiccCtx.fillStyle = '#d47c55';
      kiccCtx.fillRect(x, y + 4, 3, 14);
    }
  }
  const kiccMap = track(finalizeColorTex(kiccC, maxAnisotropy, 2, 1));

  // 6. Times Tower Stepped Glass-and-Granite Curtain Wall
  const [ttC, ttCtx] = makeCanvas(512, 512);
  ttCtx.fillStyle = '#0d223c';
  ttCtx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 32; row++) {
    const y = row * 16;
    ttCtx.fillStyle = '#cbd5e1';
    ttCtx.fillRect(0, y, 512, 3);
    for (let col = 0; col < 16; col++) {
      const x = col * 32;
      const glint = (row + col) % 4 === 0 ? '#7dd3fc' : (row * 3 + col) % 7 === 0 ? '#fde68a' : '#163c66';
      ttCtx.fillStyle = glint;
      ttCtx.fillRect(x + 2, y + 3, 28, 12);
    }
  }
  const timesTowerMap = track(finalizeColorTex(ttC, maxAnisotropy, 1, 1));

  // 7. Afya Centre Green & Gold Facade
  const [afyaC, afyaCtx] = makeCanvas(512, 512);
  afyaCtx.fillStyle = '#15803d';
  afyaCtx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 20; row++) {
    const y = row * 25.6;
    afyaCtx.fillStyle = row % 2 === 0 ? '#14532d' : '#eab308';
    afyaCtx.fillRect(0, y, 512, 5);
    for (let col = 0; col < 24; col++) {
      afyaCtx.fillStyle = (row + col) % 6 === 0 ? '#fef08a' : '#0f172a';
      afyaCtx.fillRect(col * 21.3 + 3, y + 7, 15, 13);
    }
  }
  const afyaMap = track(finalizeColorTex(afyaC, maxAnisotropy, 1, 1));

  // 8. Parliament Clock Tower Face
  const [clkC, clkCtx] = makeCanvas(256, 256);
  clkCtx.fillStyle = '#d6ceb8';
  clkCtx.fillRect(0, 0, 256, 256);
  clkCtx.beginPath();
  clkCtx.arc(128, 128, 96, 0, Math.PI * 2);
  clkCtx.fillStyle = '#fefce8';
  clkCtx.fill();
  clkCtx.lineWidth = 8;
  clkCtx.strokeStyle = '#334155';
  clkCtx.stroke();
  clkCtx.strokeStyle = '#0f172a';
  clkCtx.lineWidth = 6;
  clkCtx.beginPath();
  clkCtx.moveTo(128, 128);
  clkCtx.lineTo(128, 56);
  clkCtx.moveTo(128, 128);
  clkCtx.lineTo(180, 146);
  clkCtx.stroke();
  const parliamentClockMap = track(finalizeColorTex(clkC, maxAnisotropy));

  // 9. Realistic Nairobi CBD Office & Shopfront Facades (Sunset interior window glints + street retail)
  const palettes = [
    { wall: '#b8b2a6', glass: '#1a2d44', accent: '#64748b', shop: 'KENYA ARCHIVES · CBD' },
    { wall: '#283548', glass: '#0c4a6e', accent: '#475569', shop: 'NAIROBI FINANCIAL PLAZA' },
    { wall: '#a89984', glass: '#1e293b', accent: '#57534e', shop: 'KENYATTA AVE ARCADE' },
    { wall: '#1f2937', glass: '#0e7490', accent: '#334155', shop: 'UPPER HILL · CBD TOWER' },
  ];
  const buildingMaps = palettes.map((pal) => {
    const [bC, bCtx] = makeCanvas(256, 512);
    bCtx.fillStyle = pal.wall;
    bCtx.fillRect(0, 0, 256, 512);

    // Subtle vertical architectural pilasters
    bCtx.fillStyle = 'rgba(0,0,0,0.14)';
    for (let x = 0; x < 256; x += 64) {
      bCtx.fillRect(x, 0, 5, 442);
    }

    // Ground floor arcade / shopfronts
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 448, 256, 64);
    bCtx.fillStyle = '#f59e0b';
    bCtx.fillRect(0, 440, 256, 8);
    bCtx.fillStyle = '#f8fafc';
    bCtx.font = 'bold 13px sans-serif';
    bCtx.textAlign = 'center';
    bCtx.fillText(pal.shop, 128, 476, 240);

    for (let row = 0; row < 16; row++) {
      const y = row * 27 + 8;
      for (let col = 0; col < 8; col++) {
        const x = col * 30 + 10;
        const hash = (row * 13 + col * 7) % 11;
        bCtx.fillStyle = hash === 0 ? '#fcd34d' : hash === 3 ? '#7dd3fc' : pal.glass;
        bCtx.fillRect(x, y, 20, 18);
        bCtx.fillStyle = 'rgba(255,255,255,0.12)';
        bCtx.fillRect(x, y, 20, 4);
        bCtx.strokeStyle = pal.accent;
        bCtx.lineWidth = 1.5;
        bCtx.strokeRect(x, y, 20, 18);
      }
    }
    return track(finalizeColorTex(bC, maxAnisotropy, 1, 1));
  });

  // 10. Authentic Nairobi Nganya / Matatu Livery Textures
  const matatuThemes = [
    { bg: '#f59e0b', stripeA: '#ef4444', stripeB: '#0f172a', route: '111 NGONG' },
    { bg: '#06b6d4', stripeA: '#facc15', stripeB: '#1e1b4b', route: '46 KAWANGWARE' },
    { bg: '#ec4899', stripeA: '#facc15', stripeB: '#111827', route: '125 RONGAI' },
    { bg: '#10b981', stripeA: '#f97316', stripeB: '#09090b', route: '237 THIKA RD' },
  ];
  const matatuLiveries = matatuThemes.map((t) => {
    const [mC, mCtx] = makeCanvas(512, 256);
    mCtx.fillStyle = t.bg;
    mCtx.fillRect(0, 0, 512, 256);
    mCtx.fillStyle = t.stripeA;
    mCtx.beginPath();
    mCtx.moveTo(0, 180);
    mCtx.lineTo(260, 110);
    mCtx.lineTo(310, 155);
    mCtx.lineTo(512, 95);
    mCtx.lineTo(512, 165);
    mCtx.lineTo(0, 240);
    mCtx.closePath();
    mCtx.fill();

    mCtx.fillStyle = t.stripeB;
    mCtx.fillRect(0, 200, 512, 56);
    mCtx.fillStyle = '#0f172a';
    for (let w = 0; w < 5; w++) {
      mCtx.fillRect(34 + w * 92, 42, 74, 58);
    }
    mCtx.fillStyle = '#facc15';
    mCtx.font = 'bold 34px sans-serif';
    mCtx.fillText(t.route, 24, 238);
    return track(finalizeColorTex(mC, maxAnisotropy));
  });

  // 11. Racing Checkered Start / Finish Banner
  const [chkC, chkCtx] = makeCanvas(512, 128);
  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      chkCtx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#f8fafc' : '#0f172a';
      chkCtx.fillRect(x, y, sq, sq);
    }
  }
  chkCtx.fillStyle = 'rgba(245, 158, 11, 0.92)';
  chkCtx.fillRect(110, 34, 292, 60);
  chkCtx.fillStyle = '#090d12';
  chkCtx.font = 'bold 30px sans-serif';
  chkCtx.textAlign = 'center';
  chkCtx.textBaseline = 'middle';
  chkCtx.fillText('NAIROBI GRAND PRIX', 256, 65, 270);
  const checkeredMap = track(finalizeColorTex(chkC, maxAnisotropy));

  // 11B. Checkered Emerald & Gold FINISH LINE Arch Banner
  const [finC, finCtx] = makeCanvas(512, 128);
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      finCtx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ffffff' : '#090d12';
      finCtx.fillRect(x, y, sq, sq);
    }
  }
  finCtx.fillStyle = 'rgba(6, 78, 59, 0.96)';
  finCtx.fillRect(86, 22, 340, 84);
  finCtx.strokeStyle = '#34d399';
  finCtx.lineWidth = 6;
  finCtx.strokeRect(88, 24, 336, 80);
  finCtx.fillStyle = '#fef08a';
  finCtx.font = 'bold 34px sans-serif';
  finCtx.textAlign = 'center';
  finCtx.textBaseline = 'middle';
  finCtx.fillText('FINISH LINE · NAIROBI GP', 256, 64, 316);
  const finishBannerMap = track(finalizeColorTex(finC, maxAnisotropy));

  // 12. Soft Radial Contact Shadow
  const [shC, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.38)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = track(finalizeColorTex(shC, 1));

  const makeHighwaySign = (topLine: string, bottomLine: string, code: string) => {
    const [sC, sCtx] = makeCanvas(512, 192);
    sCtx.fillStyle = '#065f46';
    sCtx.fillRect(0, 0, 512, 192);
    sCtx.strokeStyle = '#ffffff';
    sCtx.lineWidth = 8;
    sCtx.strokeRect(8, 8, 496, 176);

    sCtx.fillStyle = '#facc15';
    sCtx.fillRect(24, 26, 86, 42);
    sCtx.fillStyle = '#0f172a';
    sCtx.font = 'bold 24px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.fillText(code, 67, 55, 78);

    sCtx.fillStyle = '#ffffff';
    sCtx.textAlign = 'left';
    sCtx.font = 'bold 31px sans-serif';
    sCtx.fillText(topLine, 126, 57, 360);
    sCtx.font = 'bold 27px sans-serif';
    sCtx.fillStyle = '#e2e8f0';
    sCtx.fillText(bottomLine, 26, 138, 460);
    return track(finalizeColorTex(sC, maxAnisotropy));
  };

  const makeLicensePlate = (text: string) => {
    const [pC, pCtx] = makeCanvas(256, 64);
    pCtx.fillStyle = '#facc15';
    pCtx.fillRect(0, 0, 256, 64);
    pCtx.strokeStyle = '#0f172a';
    pCtx.lineWidth = 4;
    pCtx.strokeRect(2, 2, 252, 60);
    pCtx.fillStyle = '#0f172a';
    pCtx.font = 'bold 36px monospace';
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.fillText(text, 128, 34);
    return track(finalizeColorTex(pC, maxAnisotropy));
  };

  const makeTurnSign = (arrow: string, label: string) => {
    const [tC, tCtx] = makeCanvas(256, 128);
    tCtx.fillStyle = '#0c1117';
    tCtx.fillRect(0, 0, 256, 128);
    tCtx.strokeStyle = '#f59e0b';
    tCtx.lineWidth = 8;
    tCtx.strokeRect(6, 6, 244, 116);
    tCtx.fillStyle = '#facc15';
    tCtx.font = 'bold 54px sans-serif';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.fillText(arrow, 128, 46);
    tCtx.fillStyle = '#38bdf8';
    tCtx.font = 'bold 24px sans-serif';
    tCtx.fillText(label, 128, 98, 224);
    return track(finalizeColorTex(tC, maxAnisotropy));
  };

  return {
    asphaltMap,
    asphaltBump,
    grassMap,
    grassBump,
    curbMap,
    sidewalkMap,
    kiccMap,
    timesTowerMap,
    afyaMap,
    parliamentClockMap,
    buildingMaps,
    matatuLiveries,
    checkeredMap,
    finishBannerMap,
    contactShadowMap,
    makeHighwaySign,
    makeTurnSign,
    makeLicensePlate,
    dispose: () => {
      for (const t of allTextures) t.dispose();
    },
  };
}
