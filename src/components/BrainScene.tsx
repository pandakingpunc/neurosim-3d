import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { BrainSim } from "../brain/simulation";
import { REGIONS } from "../brain/regions";
import { flattenMedial, wrinkle } from "../brain/network";
import type { Lang } from "../i18n";

export interface VisualSettings {
  showSynapses: boolean;
  showPulses: boolean;
  showShell: boolean;
  showLabels: boolean;
  autoRotate: boolean;
  visibleRegions: boolean[];
  neuronSize: number;
}

interface SceneProps {
  sim: BrainSim;
  visual: VisualSettings;
  lang: Lang;
  onNeuronClick: (idx: number) => void;
}

const WHITE = new THREE.Color("#ffffff");

/* ---------------- Nöronlar ---------------- */
function Neurons({ sim, visual }: { sim: BrainSim; visual: VisualSettings }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const regionColors = useMemo(() => REGIONS.map((r) => new THREE.Color(r.color)), []);
  const visRef = useRef(visual);
  visRef.current = visual;

  useFrame(() => {
    const mesh = meshRef.current;
    const halo = haloRef.current;
    if (!mesh || !halo) return;
    const { net, glow } = sim;
    const vis = visRef.current.visibleRegions;
    const base = 0.02 * visRef.current.neuronSize;
    for (let i = 0; i < net.count; i++) {
      const reg = net.region[i];
      const g = glow[i];
      const show = vis[reg];
      dummy.position.set(net.positions[i * 3], net.positions[i * 3 + 1], net.positions[i * 3 + 2]);
      dummy.scale.setScalar(show ? base * (1 + g * 1.8) : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.copy(regionColors[reg]).multiplyScalar(0.3 + g * 0.9).lerp(WHITE, g * 0.6);
      mesh.setColorAt(i, color);

      dummy.scale.setScalar(show && g > 0.05 ? base * 5 * g : 0);
      dummy.updateMatrix();
      halo.setMatrixAt(i, dummy.matrix);
      color.copy(regionColors[reg]).multiplyScalar(g * 0.7);
      halo.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, sim.net.count]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={haloRef} args={[undefined, undefined, sim.net.count]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}

/* ---------------- Sinapslar ---------------- */
function Synapses({ sim, visual }: { sim: BrainSim; visual: VisualSettings }) {
  const regionColors = useMemo(() => REGIONS.map((r) => new THREE.Color(r.color)), []);
  const visRef = useRef(visual);
  visRef.current = visual;

  const geom = useMemo(() => {
    const { net } = sim;
    const pos = new Float32Array(net.edgeCount * 6);
    const col = new Float32Array(net.edgeCount * 6);
    for (let e = 0; e < net.edgeCount; e++) {
      const a = net.edgeFrom[e], b = net.edgeTargets[e];
      pos[e * 6] = net.positions[a * 3];
      pos[e * 6 + 1] = net.positions[a * 3 + 1];
      pos[e * 6 + 2] = net.positions[a * 3 + 2];
      pos[e * 6 + 3] = net.positions[b * 3];
      pos[e * 6 + 4] = net.positions[b * 3 + 1];
      pos[e * 6 + 5] = net.positions[b * 3 + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, [sim]);

  useEffect(() => () => geom.dispose(), [geom]);

  useFrame(() => {
    if (!visRef.current.showSynapses) return;
    const { net, edgeGlow } = sim;
    const vis = visRef.current.visibleRegions;
    const attr = geom.getAttribute("color") as THREE.BufferAttribute;
    const col = attr.array as Float32Array;
    for (let e = 0; e < net.edgeCount; e++) {
      const a = net.edgeFrom[e];
      const b = net.edgeTargets[e];
      const ra = net.region[a];
      if (!vis[ra] || !vis[net.region[b]]) {
        col[e * 6] = col[e * 6 + 1] = col[e * 6 + 2] = 0;
        col[e * 6 + 3] = col[e * 6 + 4] = col[e * 6 + 5] = 0;
        continue;
      }
      const c = regionColors[ra];
      const g = edgeGlow[e];
      const k = 0.06 + g * 0.9;
      col[e * 6] = c.r * k;
      col[e * 6 + 1] = c.g * k;
      col[e * 6 + 2] = c.b * k;
      const k2 = 0.03 + g * 0.5;
      col[e * 6 + 3] = c.r * k2;
      col[e * 6 + 4] = c.g * k2;
      col[e * 6 + 5] = c.b * k2;
    }
    attr.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geom} visible={visual.showSynapses} frustumCulled={false}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

/* ---------------- Sinyal darbeleri ---------------- */
function Pulses({ sim, visual }: { sim: BrainSim; visual: VisualSettings }) {
  const visRef = useRef(visual);
  visRef.current = visual;
  const regionColors = useMemo(() => REGIONS.map((r) => new THREE.Color(r.color)), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sim.pulseCap * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(sim.pulseCap * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, [sim]);
  useEffect(() => () => geom.dispose(), [geom]);

  useFrame(() => {
    if (!visRef.current.showPulses) return;
    const { net } = sim;
    const vis = visRef.current.visibleRegions;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = geom.getAttribute("color") as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;
    let n = 0;
    for (let p = 0; p < sim.pulseCount; p++) {
      const e = sim.pulseEdge[p];
      const a = net.edgeFrom[e], b = net.edgeTargets[e];
      if (!vis[net.region[a]] || !vis[net.region[b]]) continue;
      const t = sim.pulseT[p] + sim.pulseSpeed[p] * sim.acc; // ara kare yumuşatma
      const tt = Math.min(t, 1);
      pos[n * 3] = net.positions[a * 3] + (net.positions[b * 3] - net.positions[a * 3]) * tt;
      pos[n * 3 + 1] = net.positions[a * 3 + 1] + (net.positions[b * 3 + 1] - net.positions[a * 3 + 1]) * tt;
      pos[n * 3 + 2] = net.positions[a * 3 + 2] + (net.positions[b * 3 + 2] - net.positions[a * 3 + 2]) * tt;
      const c = regionColors[net.region[a]];
      col[n * 3] = 0.5 + c.r * 0.5;
      col[n * 3 + 1] = 0.5 + c.g * 0.5;
      col[n * 3 + 2] = 0.5 + c.b * 0.5;
      n++;
    }
    geom.setDrawRange(0, n);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points geometry={geom} visible={visual.showPulses} frustumCulled={false}>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

/* ---------------- Beyin kabuğu ---------------- */
function makeHemisphere(side: number) {
  const g = new THREE.SphereGeometry(1, 72, 54);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 0.8;
    let y = p.getY(i) * 0.86;
    let z = p.getZ(i) * 1.2;
    if (y < 0) y *= 0.72;
    const w = wrinkle(x + side * 0.42, y, z);
    x *= w;
    y *= w;
    z *= w;
    // medial yüzeyi düzleştir (fissür)
    p.setXYZ(i, flattenMedial(x, side) + side * 0.42, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function BrainShell({ visible }: { visible: boolean }) {
  const left = useMemo(() => makeHemisphere(-1), []);
  const right = useMemo(() => makeHemisphere(1), []);
  useEffect(
    () => () => {
      left.dispose();
      right.dispose();
    },
    [left, right]
  );
  const mat = (
    <meshPhysicalMaterial
      color="#7f9cff"
      transparent
      opacity={0.09}
      roughness={0.35}
      metalness={0.1}
      depthWrite={false}
      side={THREE.FrontSide}
    />
  );
  return (
    <group visible={visible}>
      <mesh geometry={left}>{mat}</mesh>
      <mesh geometry={right}>{mat}</mesh>
      <mesh position={[0, -0.85, -0.85]} scale={[0.66, 0.36, 0.45]}>
        <sphereGeometry args={[1, 32, 24]} />
        {mat}
      </mesh>
      <mesh position={[0, -1.1, -0.35]} rotation={[0.18, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 1.4, 20]} />
        {mat}
      </mesh>
      {/* Hafif wireframe */}
      <mesh geometry={left}>
        <meshBasicMaterial color="#5b7cff" wireframe transparent opacity={0.035} depthWrite={false} />
      </mesh>
      <mesh geometry={right}>
        <meshBasicMaterial color="#5b7cff" wireframe transparent opacity={0.035} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------------- Etiketler ---------------- */
// Html kökleri hep bağlı kalır, yalnızca gizlenir: drei Html'i React 19'da sökmek
// "synchronously unmount a root" hatası veriyor.
function Labels({ visual, lang }: { visual: VisualSettings; lang: Lang }) {
  return (
    <>
      {REGIONS.map((r, i) => (
        <Html
          key={r.id}
          position={r.labelPos}
          center
          distanceFactor={6}
          zIndexRange={[5, 0]} // varsayılan dev z-index etiketleri yan panellerin üstüne çıkarıyordu
          style={{ pointerEvents: "none" }}
        >
          <div
            className="whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide backdrop-blur-sm"
            style={{
              display: visual.showLabels && visual.visibleRegions[i] ? "block" : "none",
              color: r.color,
              borderColor: r.color + "66",
              background: "rgba(5,8,20,0.65)",
              boxShadow: `0 0 12px ${r.color}44`,
            }}
          >
            {r.name[lang]}
          </div>
        </Html>
      ))}
    </>
  );
}

/* ---------------- Tıklama ile uyarma ---------------- */
function ClickPicker({ sim, visual, onPick }: { sim: BrainSim; visual: VisualSettings; onPick: (i: number) => void }) {
  const { gl, camera } = useThree();
  const simRef = useRef(sim);
  simRef.current = sim;
  const visRef = useRef(visual);
  visRef.current = visual;
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pt = new THREE.Vector3();
    let down: [number, number] | null = null;
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]);
      down = null;
      if (moved > 5) return;
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const s = simRef.current;
      const vis = visRef.current.visibleRegions;
      let best = -1;
      let bestScore = Infinity;
      for (let i = 0; i < s.net.count; i++) {
        if (!vis[s.net.region[i]]) continue; // gizli bölgedeki nöronlar tıklanamaz
        pt.set(s.net.positions[i * 3], s.net.positions[i * 3 + 1], s.net.positions[i * 3 + 2]);
        const d = ray.ray.distanceSqToPoint(pt);
        if (d < 0.012) {
          const depth = pt.distanceTo(camera.position);
          const score = depth + d * 20;
          if (score < bestScore) {
            bestScore = score;
            best = i;
          }
        }
      }
      if (best >= 0) onPick(best);
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, onPick]);
  return null;
}

/* ---------------- Simülasyon döngüsü ---------------- */
function SimTicker({ sim }: { sim: BrainSim }) {
  useFrame((_, delta) => sim.tick(delta));
  return null;
}

function StimFlash({ sim }: { sim: BrainSim }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (ref.current) ref.current.intensity = sim.stimFlash * 6;
  });
  return <pointLight ref={ref} position={[0, 0, 0]} color="#ffffff" intensity={0} distance={5} />;
}

export function BrainScene({ sim, visual, lang, onNeuronClick }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [2.4, 1.3, 3.6], fov: 45, near: 0.05, far: 100 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => gl.setClearColor("#05070f")}
    >
      <color attach="background" args={["#05070f"]} />
      <fog attach="fog" args={["#05070f", 6, 14]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 4, 4]} intensity={30} color="#9bb4ff" />
      <pointLight position={[-4, -2, -3]} intensity={16} color="#ff7aa8" />
      <Stars radius={40} depth={30} count={1800} factor={3} saturation={0.3} fade speed={0.4} />

      <SimTicker sim={sim} />
      <StimFlash sim={sim} />
      <group rotation={[0, 0, 0]}>
        <BrainShell visible={visual.showShell} />
        <Synapses sim={sim} visual={visual} />
        <Neurons sim={sim} visual={visual} />
        <Pulses sim={sim} visual={visual} />
        <Labels visual={visual} lang={lang} />
      </group>
      <ClickPicker sim={sim} visual={visual} onPick={onNeuronClick} />
      <OrbitControls
        enablePan={false}
        minDistance={1.6}
        maxDistance={8}
        autoRotate={visual.autoRotate}
        autoRotateSpeed={0.6}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
