import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Environment, PerspectiveCamera, Sparkles, ContactShadows } from '@react-three/drei';
import { Physics, useConvexPolyhedron, usePlane, useBox } from '@react-three/cannon';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { DamageType } from '../../types';
import { PendingDie } from '../../utils/engine';

// -- Constants --
const FLOOR_Y = 0;
const D6_SIZE = 2.2;

// -- Texture Generation --
const createMarbleTexture = (baseColor: string, secondaryColor: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Fill background
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Add noise/marble veins
    ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.bezierCurveTo(
            Math.random() * 512, Math.random() * 512,
            Math.random() * 512, Math.random() * 512,
            Math.random() * 512, Math.random() * 512
        );
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 2 + Math.random() * 8;
        ctx.globalAlpha = 0.3 + Math.random() * 0.2;
        ctx.stroke();
    }

    // Add glitter/specks
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 100; i++) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
};

// -- FX Components --

const ParticleBurst = ({ position, color, count = 25 }: { position: THREE.Vector3; color: string; count?: number }) => {
    const mesh = useRef<THREE.InstancedMesh>(null);
    const [dummy] = useState(() => new THREE.Object3D());
    const [particles] = useState(() => {
        return new Array(count).fill(0).map(() => ({
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                (Math.random()) * 5 + 2,
                (Math.random() - 0.5) * 3
            ),
            position: position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5)),
            scale: Math.random() * 0.4 + 0.1,
            life: 1.0,
            decay: 1.5 + Math.random()
        }));
    });

    useFrame((state, delta) => {
        if (!mesh.current) return;

        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= delta * p.decay;
                p.position.add(p.velocity.clone().multiplyScalar(delta));
                p.velocity.y -= delta * 8;

                dummy.position.copy(p.position);
                dummy.scale.setScalar(p.scale * p.life);
                dummy.rotation.x += delta * 2;
                dummy.rotation.z += delta * 2;
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            } else {
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                mesh.current!.setMatrixAt(i, dummy.matrix);
            }
        });

        mesh.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
            <dodecahedronGeometry args={[0.1, 0]} />
            <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.8} />
        </instancedMesh>
    );
};

// -- Environment Components --

const Floor = () => {
    usePlane(() => ({
        position: [0, FLOOR_Y, 0],
        rotation: [-Math.PI / 2, 0, 0],
        material: { friction: 0.3, restitution: 0.5 }
    }));

    return (
        <group position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh receiveShadow>
                <planeGeometry args={[100, 100]} />
                <shadowMaterial transparent opacity={0.3} color="#000" />
            </mesh>
        </group>
    );
};

const Walls = () => {
    const h = 40;
    const width = 12;
    const depth = 8;
    useBox(() => ({ position: [0, h / 2, -depth], args: [25, h, 2] }));
    useBox(() => ({ position: [0, h / 2, depth], args: [25, h, 2] }));
    useBox(() => ({ position: [-width, h / 2, 0], args: [2, h, 20] }));
    useBox(() => ({ position: [width, h / 2, 0], args: [2, h, 20] }));
    return null;
};

interface DieProps {
    dieId: string;
    sides: number;
    damageType: DamageType;
    specialType?: 'hope' | 'fear';
    isActive: boolean;
    outcome?: 'crit' | 'fail' | 'neutral';
    onResult: (id: string, value: number) => void;
    onExplode: (pos: THREE.Vector3, type: 'crit' | 'fail') => void;
}

const Die: React.FC<DieProps> = ({ dieId, sides, damageType, specialType, isActive, outcome, onResult, onExplode }) => {
    // 1. Mappings
    const { visualSides, mapResult } = useMemo(() => {
        if (sides === 2) return { visualSides: 6, mapResult: (v: number) => Math.ceil(v / 3) };
        if (sides === 3) return { visualSides: 6, mapResult: (v: number) => Math.ceil(v / 2) };
        if (sides === 4) return { visualSides: 4, mapResult: (v: number) => v };
        if (sides === 5) return { visualSides: 20, mapResult: (v: number) => Math.ceil(v / 4) };
        if (sides === 6) return { visualSides: 6, mapResult: (v: number) => v };
        if (sides === 8) return { visualSides: 8, mapResult: (v: number) => v };
        if (sides === 10) return { visualSides: 20, mapResult: (v: number) => Math.ceil(v / 2) };
        if (sides === 12) return { visualSides: 12, mapResult: (v: number) => v };
        if (sides === 20) return { visualSides: 20, mapResult: (v: number) => v };
        return { visualSides: 20, mapResult: (v: number) => ((v - 1) % sides) + 1 };
    }, [sides]);

    // 2. Materials & Textures (Brighter Colors)
    const { baseColor, textColor, texture } = useMemo(() => {
        const map: Record<string, string> = {
            fire: '#b91c1c',     // Red-700
            cold: '#0284c7',     // Sky-600
            lightning: '#eab308',// Yellow-500
            necrotic: '#581c87', // Purple-900
            radiant: '#fcd34d',  // Amber-300
            acid: '#16a34a',     // Green-600
            poison: '#059669',   // Emerald-600
            psychic: '#db2777',  // Pink-600
            force: '#4f46e5',    // Indigo-600
            magic: '#c026d3',    // Fuchsia-600
            physical: '#52525b', // Zinc-600
            none: '#3f3f46'      // Zinc-700
        };
        const secMap: Record<string, string> = {
            fire: '#fee2e2', cold: '#e0f2fe', lightning: '#fef9c3', necrotic: '#e9d5ff',
            radiant: '#fffbeb', acid: '#dcfce7', poison: '#d1fae5', psychic: '#fce7f3', force: '#e0e7ff',
            magic: '#fae8ff', physical: '#e4e4e7', none: '#d4d4d8'
        }

        let prim = map[damageType] || map.none;
        let sec = secMap[damageType] || secMap.none;
        let txt = '#ffffff';

        if (specialType === 'hope') { prim = '#2563eb'; sec = '#bfdbfe'; txt = '#ffffff'; } // Brighter Blue
        if (specialType === 'fear') { prim = '#7e22ce'; sec = '#e9d5ff'; txt = '#ffffff'; } // Brighter Purple

        // Generate Texture
        const tex = createMarbleTexture(prim, sec);

        return { baseColor: prim, textColor: txt, texture: tex };
    }, [damageType, specialType]);

    // 3. Labels
    const labels = useMemo(() => getFaceLabels(visualSides), [visualSides]);

    // 4. Physics
    const [ref, api] = useDiePhysics(visualSides, isActive);

    // 5. Logic
    const finishedRef = useRef(false);
    const stableFrames = useRef(0);
    const [settledValue, setSettledValue] = useState<number | null>(null);

    // Initial Impulse
    useEffect(() => {
        if (isActive && !finishedRef.current) {
            const timeout = setTimeout(() => {
                api.applyImpulse(
                    [(Math.random() - 0.5) * 12, -15, (Math.random() - 0.5) * 12],
                    [0, 0, 0]
                );
                api.applyTorque([
                    (Math.random() - 0.5) * 60,
                    (Math.random() - 0.5) * 60,
                    (Math.random() - 0.5) * 60
                ]);
            }, Math.random() * 200);
            return () => clearTimeout(timeout);
        }
    }, [api, isActive]);

    const calculateResult = () => {
        if (!ref.current || finishedRef.current) return;
        finishedRef.current = true;

        const q = new THREE.Quaternion();
        ref.current.getWorldQuaternion(q);
        const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q.invert());

        let best = labels[0];
        let maxDot = -Infinity;
        for (const l of labels) {
            const dot = l.norm.dot(localUp);
            if (dot > maxDot) { maxDot = dot; best = l; }
        }

        const val = mapResult(best.value);
        setSettledValue(val);
        onResult(dieId, val);
    };

    // Physics Monitor
    useEffect(() => {
        if (!isActive) return;

        const forceStopTimer = setTimeout(() => {
            if (!finishedRef.current) calculateResult();
        }, 3500);

        const unsub = api.velocity.subscribe(v => {
            if (finishedRef.current) return;
            const speedSq = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
            if (speedSq < 0.05) {
                stableFrames.current++;
                if (stableFrames.current > 20) calculateResult();
            } else {
                stableFrames.current = 0;
            }
        });

        return () => { clearTimeout(forceStopTimer); unsub(); };
    }, [api, visualSides, isActive]);

    // Outcome Effect (Particles)
    useEffect(() => {
        if (outcome && ref.current && settledValue !== null) {
            if (outcome === 'crit' || outcome === 'fail') {
                // Calculate exact world position of the face text
                const q = new THREE.Quaternion();
                ref.current.getWorldQuaternion(q);
                const pos = new THREE.Vector3();
                ref.current.getWorldPosition(pos);

                const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q.clone().invert());

                let best = labels[0];
                let maxDot = -Infinity;
                for (const l of labels) {
                    const dot = l.norm.dot(localUp);
                    if (dot > maxDot) { maxDot = dot; best = l; }
                }

                // World Position of the label
                const labelWorldPos = best.pos.clone().applyQuaternion(q).add(pos);

                onExplode(labelWorldPos, outcome);
            }
        }
    }, [outcome, settledValue, onExplode, labels]);

    const fontSize = getFontSize(visualSides);

    return (
        <mesh ref={ref} castShadow receiveShadow>
            {getVisualGeometry(visualSides)}
            <meshPhysicalMaterial
                map={texture}
                color={baseColor}
                roughness={0.4}
                metalness={0.1}
                transmission={0}
                opacity={1}
                clearcoat={0.2}
                clearcoatRoughness={0.3}
                reflectivity={0.2}
                emissive={baseColor}
                emissiveIntensity={0.05}
            />

            {labels.map((l, i) => {
                const quaternion = new THREE.Quaternion();
                quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), l.norm.clone());
                const displayValue = mapResult(l.value);

                const isResultFace = settledValue === displayValue;
                let emissiveColor = textColor;
                let emissiveIntensity = 0.4; // Base readability
                let displayTextColor = textColor;

                if (isResultFace && outcome) {
                    if (outcome === 'crit') {
                        emissiveColor = '#fbbf24';
                        emissiveIntensity = 4;
                        displayTextColor = '#fbbf24';
                    } else if (outcome === 'fail') {
                        emissiveColor = '#ef4444';
                        emissiveIntensity = 4;
                        displayTextColor = '#ef4444';
                    } else if (outcome === 'neutral') {
                        emissiveColor = textColor;
                        emissiveIntensity = 0.8;
                    }
                }

                return (
                    <group key={i} position={l.pos} quaternion={quaternion}>
                        <Text
                            fontSize={fontSize}
                            anchorX="center"
                            anchorY="middle"
                            font="https://fonts.gstatic.com/s/cinzel/v11/8vIJ7ww63mVu7gt78Uk6.woff"
                            characters="0123456789"
                        >
                            {displayValue}
                            <meshStandardMaterial
                                color={displayTextColor}
                                roughness={0.1}
                                metalness={0.9}
                                emissive={emissiveColor}
                                emissiveIntensity={emissiveIntensity}
                                toneMapped={false}
                            />
                        </Text>
                    </group>
                );
            })}
        </mesh>
    );
};

// --- Main Scene ---

export const DiceScene: React.FC<{
    dice: PendingDie[];
    activeDiceIds: string[];
    damageType: DamageType;
    outcomes: Record<string, 'crit' | 'fail' | 'neutral'>;
    onRollComplete: (results: Record<string, number>) => void;
}> = ({ dice, activeDiceIds, damageType, outcomes, onRollComplete }) => {
    const [results, setResults] = useState<Record<string, number>>({});
    const reportedDice = useRef<Set<string>>(new Set());
    const [explosions, setExplosions] = useState<{ id: string, pos: THREE.Vector3, color: string }[]>([]);

    useEffect(() => {
        reportedDice.current = new Set();
        setResults({});
    }, [activeDiceIds.join(',')]);

    const handleResult = (id: string, val: number) => {
        if (!activeDiceIds.includes(id)) return;

        setResults(prev => {
            if (prev[id]) return prev;
            const next = { ...prev, [id]: val };

            const allActiveReported = activeDiceIds.every(activeId => next[activeId] !== undefined);

            if (allActiveReported && !reportedDice.current.has(activeDiceIds[0])) {
                activeDiceIds.forEach(i => reportedDice.current.add(i));
                setTimeout(() => onRollComplete(next), 500);
            }
            return next;
        });
    };

    const handleExplode = (pos: THREE.Vector3, type: 'crit' | 'fail') => {
        const id = Math.random().toString();
        setExplosions(prev => [...prev, {
            id,
            pos,
            color: type === 'crit' ? '#fbbf24' : '#ef4444'
        }]);
        setTimeout(() => {
            setExplosions(prev => prev.filter(e => e.id !== id));
        }, 2000);
    };

    if (!dice.length) return null;

    return (
        <div className="w-full h-full relative" style={{ background: 'transparent' }}>
            <Canvas
                shadows
                dpr={[1, 1.5]}
                gl={{
                    antialias: false,
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: 1.5,
                    alpha: true,
                    premultipliedAlpha: false,
                }}
                style={{ background: 'transparent' }}
            >
                <PerspectiveCamera makeDefault position={[0, 22, 12]} fov={35} onUpdate={c => c.lookAt(0, 0, 0)} />

                {/* Improved Lighting Setup */}
                <ambientLight intensity={0.7} />
                <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#000000" />

                <directionalLight
                    position={[5, 10, 5]}
                    intensity={4}
                    castShadow
                    shadow-bias={-0.0001}
                    color="#ffffff"
                />
                <pointLight position={[-10, 5, -10]} intensity={20} color="#3b82f6" distance={30} />
                <pointLight position={[10, 5, 10]} intensity={20} color="#a855f7" distance={30} />

                {/* Environment Map */}
                <Environment preset="warehouse" blur={0.6} background={false} />

                <Sparkles count={40} scale={25} size={3} speed={0.4} opacity={0.3} color="#fff" />
                {explosions.map(ex => (
                    <ParticleBurst key={ex.id} position={ex.pos} color={ex.color} />
                ))}

                <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={40} blur={2} far={4} color="#000000" />

                <Physics gravity={[0, -60, 0]} defaultContactMaterial={{ restitution: 0.4, friction: 0.2 }}>
                    <Floor />
                    <Walls />
                    {dice.map(d => (
                        <Die
                            key={d.id}
                            dieId={d.id}
                            sides={d.sides}
                            damageType={activeDiceIds.includes(d.id) ? damageType : 'none'}
                            specialType={d.type === 'standard' ? undefined : d.type}
                            isActive={activeDiceIds.includes(d.id)}
                            outcome={outcomes[d.id]}
                            onResult={handleResult}
                            onExplode={handleExplode}
                        />
                    ))}
                </Physics>

                {/* Post-processing removed to fix transparency issues */}
                {/* <EffectComposer disableNormalPass>
                    <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.2} radius={0.4} />
                    <Noise opacity={0.03} />
                    <Vignette eskil={false} offset={0.1} darkness={0.8} />
                </EffectComposer> */}
            </Canvas>
        </div>
    );
};

// --- Helpers ---
function useDiePhysics(sides: number, isActive: boolean) {
    const commonProps = {
        mass: 1,
        material: { friction: 0.3, restitution: 0.5 },
        linearDamping: 0.5,
        angularDamping: 0.5,
    };

    const spawnPos = useMemo(() => {
        return [(Math.random() - 0.5) * 3, 10 + Math.random() * 3, (Math.random() - 0.5) * 3] as [number, number, number];
    }, []);

    const rotation = useMemo(() => {
        return [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number];
    }, []);

    if (sides === 6) {
        // Use Reduced D6 Size
        return useBox(() => ({ ...commonProps, args: [D6_SIZE, D6_SIZE, D6_SIZE], position: spawnPos, rotation }), useRef<THREE.Mesh>(null));
    }
    const { vertices, faces } = useMemo(() => getPolyhedronData(sides), [sides]);
    return useConvexPolyhedron(() => ({ ...commonProps, args: [vertices, faces], position: spawnPos, rotation }), useRef<THREE.Mesh>(null));
}

function getFontSize(shape: number) {
    switch (shape) {
        case 4: return 0.5;
        case 6: return 0.8;
        case 8: return 0.55;
        case 12: return 0.55;
        case 20: return 0.45;
        default: return 0.5;
    }
}

function getVisualGeometry(sides: number) {
    switch (sides) {
        case 4: return <tetrahedronGeometry args={[1.5]} />;
        case 6: return <boxGeometry args={[D6_SIZE, D6_SIZE, D6_SIZE]} />; // Reduced D6
        case 8: return <octahedronGeometry args={[1.4]} />;
        case 12: return <dodecahedronGeometry args={[1.6]} />;
        case 20: return <icosahedronGeometry args={[1.6]} />;
        default: return <sphereGeometry args={[1.5]} />;
    }
}

function getPolyhedronData(sides: number) {
    if (sides === 4) return { vertices: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(v => v.map(x => x * 1.5)) as [number, number, number][], faces: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]] };

    let geo: THREE.BufferGeometry;
    if (sides === 12) geo = new THREE.DodecahedronGeometry(1.6);
    else geo = new THREE.IcosahedronGeometry(1.6);

    const pos = geo.attributes.position;
    const verts: THREE.Vector3[] = [];
    const map: Record<string, number> = {};
    for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
        if (map[key] === undefined) { map[key] = verts.length; verts.push(v); }
    }
    const faces: number[][] = [];
    const getIndex = (i: number) => geo.index ? geo.index.array[i] : i;
    for (let i = 0; i < (geo.index ? geo.index.count : pos.count); i += 3) {
        const a = getIndex(i), b = getIndex(i + 1), c = getIndex(i + 2);
        const getV = (idx: number) => { const v = new THREE.Vector3().fromBufferAttribute(pos, idx); return `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`; };
        faces.push([map[getV(a)], map[getV(b)], map[getV(c)]]);
    }
    return { vertices: verts.map(v => [v.x, v.y, v.z]) as [number, number, number][], faces };
}

function getFaceLabels(sides: number) {
    let geo: THREE.BufferGeometry;
    if (sides === 4) geo = new THREE.TetrahedronGeometry(1.5);
    else if (sides === 6) geo = new THREE.BoxGeometry(D6_SIZE, D6_SIZE, D6_SIZE); // Reduced D6
    else if (sides === 8) geo = new THREE.OctahedronGeometry(1.4);
    else if (sides === 12) geo = new THREE.DodecahedronGeometry(1.6);
    else geo = new THREE.IcosahedronGeometry(1.6);

    const pos = geo.attributes.position;
    const getV = (i: number) => {
        const idx = geo.index ? geo.index.array[i] : i;
        return new THREE.Vector3().fromBufferAttribute(pos, idx);
    };

    interface FaceGroup { norm: THREE.Vector3; centers: THREE.Vector3[]; }
    const groups: FaceGroup[] = [];

    for (let i = 0; i < (geo.index ? geo.index.count : pos.count); i += 3) {
        const a = getV(i), b = getV(i + 1), c = getV(i + 2);
        const triCenter = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
        const norm = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();

        let match = groups.find(g => g.norm.angleTo(norm) < 0.05);
        if (!match) { match = { norm: norm.clone(), centers: [] }; groups.push(match); }
        match.centers.push(triCenter);
    }

    const centers = groups.map(g => {
        const center = new THREE.Vector3();
        g.centers.forEach(tc => center.add(tc));
        center.divideScalar(g.centers.length);
        return { pos: center, norm: g.norm };
    });

    const valid = centers.slice(0, sides);
    const shuffled = Array.from({ length: sides }, (_, k) => k + 1).sort(() => Math.random() - 0.5);

    return valid.map((c, i) => ({
        pos: c.pos.clone().multiplyScalar(1.03),
        norm: c.norm,
        value: shuffled[i]
    }));
}