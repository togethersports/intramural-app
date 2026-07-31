"use client";

/**
 * The 3D half of <CourtHero />: a coach's clipboard tumbling in zero gravity.
 * Everything is procedural — the board is an extruded rounded-rect Shape with
 * a real oblong handle cutout, the court diagram is drawn with the 2D canvas
 * API and applied as a CanvasTexture, the markers are cylinders. No model
 * files, no image assets.
 *
 * Loaded via next/dynamic({ ssr: false }) from court-hero.tsx so Three.js
 * never blocks first paint; the parent stops the frameloop when the section
 * scrolls out of view.
 */
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* Brand values (globals.css @theme) — the board is set dressing, but it
   dresses in the team's colours: cream face, ink lines, Whistle Red paint. */
const INK = "#17171a";
const CREAM = "#f1efe8";
const RED = "#c9242c";
const WOOD = "#8a6844";
const WOOD_DARK = "#75563a";

const BOARD_W = 2.2;
const BOARD_H = 3.3; // 2:3
const BOARD_T = 0.1;

/** Rounded rectangle path, centered on the origin. */
function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Oblong (capsule) hole path — the handle cutout, upper left. */
function handleHole(cx: number, cy: number, w: number, r: number): THREE.Path {
  const p = new THREE.Path();
  const hw = w / 2 - r;
  p.moveTo(cx - hw, cy - r);
  p.lineTo(cx + hw, cy - r);
  p.absarc(cx + hw, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(cx - hw, cy + r);
  p.absarc(cx - hw, cy, r, Math.PI / 2, Math.PI * 1.5, false);
  return p;
}

const HANDLE = { cx: -0.38, cy: BOARD_H / 2 - 0.34, w: 0.74, r: 0.1 };

/** Full-court diagram, portrait, drawn with the 2D canvas API. */
function drawCourt(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1536;
  const g = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;

  g.fillStyle = CREAM;
  g.fillRect(0, 0, W, H);

  const m = 84; // court margin
  const line = 9;
  const keyW = 330;
  const keyH = 300;
  const ftR = 120;

  g.strokeStyle = INK;
  g.lineWidth = line;
  g.lineJoin = "round";

  // painted keys first, so lines sit on top
  g.fillStyle = RED;
  g.fillRect(W / 2 - keyW / 2, m, keyW, keyH);
  g.fillRect(W / 2 - keyW / 2, H - m - keyH, keyW, keyH);

  // boundary + half-court
  g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  g.beginPath();
  g.moveTo(m, H / 2);
  g.lineTo(W - m, H / 2);
  g.stroke();

  // center circle
  g.beginPath();
  g.arc(W / 2, H / 2, 132, 0, Math.PI * 2);
  g.stroke();

  // keys: outline + free-throw circles (solid half toward center court,
  // dashed half into the paint)
  for (const top of [true, false]) {
    const baseY = top ? m : H - m;
    const dir = top ? 1 : -1;
    const ftY = baseY + dir * keyH;

    g.strokeRect(W / 2 - keyW / 2, top ? m : H - m - keyH, keyW, keyH);

    g.beginPath();
    if (top) g.arc(W / 2, ftY, ftR, 0, Math.PI, false);
    else g.arc(W / 2, ftY, ftR, Math.PI, Math.PI * 2, false);
    g.stroke();

    g.setLineDash([26, 22]);
    g.beginPath();
    if (top) g.arc(W / 2, ftY, ftR, Math.PI, Math.PI * 2, false);
    else g.arc(W / 2, ftY, ftR, 0, Math.PI, false);
    g.stroke();
    g.setLineDash([]);

    // three-point arc
    g.beginPath();
    if (top) g.arc(W / 2, baseY + dir * 60, 400, 0.18 * Math.PI, 0.82 * Math.PI, false);
    else g.arc(W / 2, baseY + dir * 60, 400, 1.18 * Math.PI, 1.82 * Math.PI, false);
    g.stroke();

    // rim + backboard tick
    g.beginPath();
    g.arc(W / 2, baseY + dir * 100, 24, 0, Math.PI * 2);
    g.stroke();
  }

  // sideline hash marks
  g.lineWidth = 7;
  for (const y of [0.28, 0.38, 0.62, 0.72]) {
    g.beginPath();
    g.moveTo(m - 26, H * y);
    g.lineTo(m, H * y);
    g.moveTo(W - m, H * y);
    g.lineTo(W - m + 26, H * y);
    g.stroke();
  }

  return c;
}

/** Remap a ShapeGeometry's UVs to its own bounding box (0..1). */
function normalizeUVs(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const size = new THREE.Vector3().subVectors(bb.max, bb.min);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(
      i,
      (pos.getX(i) - bb.min.x) / size.x,
      (pos.getY(i) - bb.min.y) / size.y,
    );
  }
  uv.needsUpdate = true;
}

function Marker({
  y,
  cap,
}: {
  y: number;
  cap: string;
}) {
  // Body along the board's Y axis, sitting proud of the left edge.
  const x = -BOARD_W / 2 + 0.02;
  const z = BOARD_T / 2 + 0.075;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.052, 0.052, 0.52, 24]} />
        <meshStandardMaterial color="#e6e2d8" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.056, 0.056, 0.16, 24]} />
        <meshStandardMaterial color={cap} roughness={0.45} />
      </mesh>
      {/* elastic holder strap */}
      <mesh castShadow position={[0, -0.06, -0.03]}>
        <boxGeometry args={[0.19, 0.09, 0.13]} />
        <meshStandardMaterial color={INK} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Clipboard({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);

  const { boardGeo, sheetGeo, courtTex } = useMemo(() => {
    const shape = roundedRect(BOARD_W, BOARD_H, 0.16);
    shape.holes.push(handleHole(HANDLE.cx, HANDLE.cy, HANDLE.w, HANDLE.r));

    const boardGeo = new THREE.ExtrudeGeometry(shape, {
      depth: BOARD_T,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 3,
      curveSegments: 28,
    });
    boardGeo.translate(0, 0, -BOARD_T / 2);

    // The laminated court sheet, inset so the wood frame shows around it.
    const inset = roundedRect(BOARD_W - 0.24, BOARD_H - 0.24, 0.12);
    inset.holes.push(
      handleHole(HANDLE.cx, HANDLE.cy, HANDLE.w + 0.07, HANDLE.r + 0.035),
    );
    const sheetGeo = new THREE.ShapeGeometry(inset, 28);
    normalizeUVs(sheetGeo);

    const courtTex = new THREE.CanvasTexture(drawCourt());
    courtTex.colorSpace = THREE.SRGBColorSpace;
    courtTex.anisotropy = 8;

    return { boardGeo, sheetGeo, courtTex };
  }, []);

  const materials = useMemo(() => {
    const cap = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.8 });
    const side = new THREE.MeshStandardMaterial({
      color: WOOD_DARK,
      roughness: 0.85,
    });
    const sheet = new THREE.MeshStandardMaterial({
      map: courtTex,
      roughness: 0.88,
    });
    return { cap, side, sheet };
  }, [courtTex]);

  useEffect(() => {
    return () => {
      boardGeo.dispose();
      sheetGeo.dispose();
      courtTex.dispose();
      materials.cap.dispose();
      materials.side.dispose();
      materials.sheet.dispose();
    };
  }, [boardGeo, sheetGeo, courtTex, materials]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    if (reduced) {
      // Reduced motion: a fixed, flattering pose instead of the tumble.
      g.rotation.set(-0.18, 0.5, 0.06);
      g.position.y = 0;
      return;
    }
    // Everything from elapsed time + sine — no counters, never jittery.
    const t = clock.elapsedTime;
    g.rotation.y = (t * Math.PI * 2) / 14; // one revolution / 14s
    g.rotation.x = 0.25 * Math.sin(t * 0.61);
    g.rotation.z = 0.15 * Math.sin(t * 0.43 + 1.3);
    g.position.y = 0.3 * Math.sin((t * Math.PI * 2) / 5);
  });

  return (
    <group ref={group}>
      <mesh
        geometry={boardGeo}
        material={[materials.cap, materials.side]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={sheetGeo}
        material={materials.sheet}
        position={[0, 0, BOARD_T / 2 + 0.02]}
        receiveShadow
      />
      <Marker y={0.55} cap={INK} />
      <Marker y={-0.35} cap={RED} />
    </group>
  );
}

export default function CourtHeroScene({
  active,
  reduced,
}: {
  active: boolean;
  reduced: boolean;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      shadows
      dpr={[1, 2]}
      camera={{ position: [0.5, 0.1, 7.4], fov: 32 }}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[-4, 5, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[4, 0.5, 3]} intensity={0.5} />
      <Clipboard reduced={reduced} />
    </Canvas>
  );
}
