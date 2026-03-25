"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Float,
  ContactShadows,
  Environment,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PrizeDrawRoom3DProps {
  npcCount?: number;
  onDrawResult?: (grade: string, prizeName: string) => void;
  onStateChange?: (info: {
    yourPos: { x: number; z: number };
    queue: string[];
    activeDrawer: string | null;
  }) => void;
  resultGrade?: string;
  playerNickname?: string;
}

interface CharacterData {
  id: string;
  nickname: string;
  color: string;
  isPlayer: boolean;
}

const NPC_COLORS = ["#6366f1", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#14b8a6"];
const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Room structure components
// ─────────────────────────────────────────────────────────────────────────────

function Floor({ onClick }: { onClick?: (point: THREE.Vector3) => void }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick?.(e.point);
      }}
    >
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="#7c5c2a" roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

function FloorTiles() {
  const tiles = [];
  for (let x = -4; x < 5; x++) {
    for (let z = -4; z < 5; z++) {
      const isEven = (x + z) % 2 === 0;
      tiles.push(
        <mesh key={`${x}-${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x + 0.5, 0.001, z + 0.5]} receiveShadow>
          <planeGeometry args={[0.98, 0.98]} />
          <meshStandardMaterial
            color={isEven ? "#8B6914" : "#7c5c22"}
            roughness={0.75}
            metalness={0.05}
          />
        </mesh>
      );
    }
  }
  return <group>{tiles}</group>;
}

function BackWall() {
  return (
    <mesh position={[0, 2, -5]} receiveShadow>
      <planeGeometry args={[10, 4]} />
      <meshStandardMaterial color="#f5f0e8" roughness={0.9} />
    </mesh>
  );
}

function SideWallLeft() {
  return (
    <mesh position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
      <planeGeometry args={[10, 4]} />
      <meshStandardMaterial color="#ede8e0" roughness={0.9} />
    </mesh>
  );
}

function SideWallRight() {
  return (
    <mesh position={[5, 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
      <planeGeometry args={[10, 4]} />
      <meshStandardMaterial color="#ede8e0" roughness={0.9} />
    </mesh>
  );
}

function Ceiling() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
      <planeGeometry args={[10, 10]} />
      <meshStandardMaterial color="#e8e4dc" roughness={0.95} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter
// ─────────────────────────────────────────────────────────────────────────────

function Counter() {
  return (
    <group position={[0, 0, -3.5]}>
      {/* Main counter top */}
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.12, 0.85]} />
        <meshStandardMaterial color="#5c3d11" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Counter body */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.88, 0.8]} />
        <meshStandardMaterial color="#7c5c2a" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Label */}
      <Float speed={1.5} floatIntensity={0.04}>
        <Text
          position={[0, 1.45, 0.05]}
          fontSize={0.28}
          color="#fbbf24"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#000"
        >
          抽獎台
        </Text>
      </Float>
      {/* Counter top items — coin tray */}
      <mesh position={[-0.8, 0.95, 0]}>
        <cylinderGeometry args={[0.18, 0.2, 0.06, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Bell */}
      <mesh position={[0.8, 0.98, 0]}>
        <sphereGeometry args={[0.1, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.2} emissive="#78350f" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Display shelves
// ─────────────────────────────────────────────────────────────────────────────

function DisplayShelves() {
  const shelfData: Array<{ x: number; grade: string; color: string; glowColor: string }> = [
    { x: -3.5, grade: "A賞", color: "#f59e0b", glowColor: "#f59e0b" },
    { x: 0,    grade: "B賞", color: "#3b82f6", glowColor: "#3b82f6" },
    { x: 3.5,  grade: "C賞", color: "#10b981", glowColor: "#10b981" },
  ];

  return (
    <group position={[0, 0, -4.5]}>
      {shelfData.map((s) => (
        <group key={s.grade} position={[s.x, 0, 0]}>
          {/* Shelf board */}
          <mesh position={[0, 1.4, 0.15]} castShadow>
            <boxGeometry args={[1.2, 0.08, 0.45]} />
            <meshStandardMaterial color="#5c3d11" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.7, 0.15]} castShadow>
            <boxGeometry args={[1.2, 0.08, 0.45]} />
            <meshStandardMaterial color="#5c3d11" roughness={0.6} />
          </mesh>
          {/* Bracket */}
          <mesh position={[0, 1.05, 0.38]} castShadow>
            <boxGeometry args={[0.06, 0.7, 0.06]} />
            <meshStandardMaterial color="#7c5c2a" roughness={0.7} />
          </mesh>
          {/* Prize box on upper shelf */}
          <Float speed={2} floatIntensity={0.06} rotationIntensity={0.08}>
            <group position={[0, 1.65, 0.15]}>
              <RoundedBox args={[0.28, 0.28, 0.28]} radius={0.04} smoothness={4} castShadow>
                <meshStandardMaterial
                  color={s.color}
                  emissive={s.glowColor}
                  emissiveIntensity={0.4}
                  metalness={0.3}
                  roughness={0.35}
                />
              </RoundedBox>
              {/* Ribbon cross */}
              <mesh>
                <boxGeometry args={[0.32, 0.04, 0.04]} />
                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
              </mesh>
              <mesh>
                <boxGeometry args={[0.04, 0.04, 0.32]} />
                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
              </mesh>
              {/* Grade label */}
              <Text
                position={[0, 0.22, 0.16]}
                fontSize={0.1}
                color="#fff"
                anchorX="center"
                anchorY="middle"
              >
                {s.grade}
              </Text>
            </group>
          </Float>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrance mat
// ─────────────────────────────────────────────────────────────────────────────

function EntranceMat() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 4]} receiveShadow>
      <planeGeometry args={[2.5, 1.2]} />
      <meshStandardMaterial color="#4c1d95" roughness={0.9} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ceiling lights
// ─────────────────────────────────────────────────────────────────────────────

function CeilingLights() {
  const lightPositions: [number, number, number][] = [
    [-3, 3.8, -2], [0, 3.8, 0], [3, 3.8, -2],
    [-2, 3.8, 2], [2, 3.8, 2],
  ];

  return (
    <group>
      {lightPositions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Light fixture housing */}
          <mesh>
            <cylinderGeometry args={[0.12, 0.18, 0.08, 12]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Bulb glow */}
          <mesh position={[0, -0.06, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial color="#fffbeb" emissive="#fde68a" emissiveIntensity={1.5} />
          </mesh>
          {/* Actual light */}
          <pointLight
            position={[0, -0.1, 0]}
            intensity={0.8}
            color="#fffbeb"
            distance={6}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Character (player + NPC) — capsule + head
// ─────────────────────────────────────────────────────────────────────────────

interface CharacterMeshProps {
  position: [number, number, number];
  color: string;
  isPlayer: boolean;
  nickname: string;
  bubbleText?: string | null;
  state: "IDLE" | "WALKING" | "CELEBRATING";
}

function CharacterMesh({ position, color, isPlayer, nickname, bubbleText, state }: CharacterMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  // Stable random phase offset — useMemo with empty deps runs once per mount
  const initialPhase = useMemo(() => Math.random() * Math.PI * 2, []);
  const timeRef = useRef<number>(initialPhase);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!groupRef.current) return;
    // Bob animation
    const bobAmt = state === "CELEBRATING" ? 0.15 : 0.03;
    const bobSpeed = state === "CELEBRATING" ? 6 : 2;
    groupRef.current.position.y = position[1] + Math.sin(timeRef.current * bobSpeed) * bobAmt;
    // Celebratory spin
    if (state === "CELEBRATING") {
      groupRef.current.rotation.y += delta * 3;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Body capsule */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.5, 8, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          emissive={isPlayer ? color : "#000"}
          emissiveIntensity={isPlayer ? 0.15 : 0}
        />
      </mesh>
      {/* Head sphere */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#f5cba7" roughness={0.8} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.07, 1.07, 0.19]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.07, 1.07, 0.19]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* Player indicator ring */}
      {isPlayer && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.3, 24]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} transparent opacity={0.7} />
        </mesh>
      )}
      {/* Nickname text */}
      <Text
        position={[0, 1.4, 0]}
        fontSize={0.14}
        color={isPlayer ? "#fbbf24" : "#e5e7eb"}
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.006}
        outlineColor="#000"
      >
        {nickname}
      </Text>
      {/* Chat bubble */}
      {bubbleText && (
        <Float speed={3} floatIntensity={0.04}>
          <Text
            position={[0, 1.8, 0]}
            fontSize={0.13}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.005}
            outlineColor="#000"
            maxWidth={1.5}
          >
            {bubbleText}
          </Text>
        </Float>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Moving character wrapper — handles smooth lerp movement
// ─────────────────────────────────────────────────────────────────────────────

interface MovingCharacterProps {
  character: CharacterData;
  targetX: number;
  targetZ: number;
  bubbleText?: string | null;
  state: "IDLE" | "WALKING" | "CELEBRATING";
}

function MovingCharacter({ character, targetX, targetZ, bubbleText, state }: MovingCharacterProps) {
  const posRef = useRef<THREE.Vector3>(new THREE.Vector3(targetX, 0, targetZ));
  const [displayPos, setDisplayPos] = useState<[number, number, number]>([targetX, 0, targetZ]);

  useFrame((_, delta) => {
    const target = new THREE.Vector3(targetX, 0, targetZ);
    posRef.current.lerp(target, delta * 4.5);
    setDisplayPos([posRef.current.x, 0, posRef.current.z]);
  });

  return (
    <CharacterMesh
      position={displayPos}
      color={character.color}
      isPlayer={character.isPlayer}
      nickname={character.nickname}
      bubbleText={bubbleText}
      state={state}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decorative elements
// ─────────────────────────────────────────────────────────────────────────────

function WallArt() {
  return (
    <group position={[0, 2.5, -4.95]}>
      {/* Poster frame */}
      <mesh>
        <boxGeometry args={[1.8, 1.2, 0.04]} />
        <meshStandardMaterial color="#5c3d11" roughness={0.7} />
      </mesh>
      {/* Poster content */}
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[1.6, 1.0]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.9} />
      </mesh>
      <Text
        position={[0, 0.1, 0.06]}
        fontSize={0.2}
        color="#92400e"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.006}
        outlineColor="#fff8e1"
      >
        一番賞
      </Text>
      <Text
        position={[0, -0.22, 0.06]}
        fontSize={0.1}
        color="#b45309"
        anchorX="center"
        anchorY="middle"
      >
        PrizeDraw
      </Text>
    </group>
  );
}

function PottedPlant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.14, 0.1, 0.36, 12]} />
        <meshStandardMaterial color="#92400e" roughness={0.8} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.14, 12]} />
        <meshStandardMaterial color="#3d1c02" roughness={0.95} />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.48, 8]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>
      {/* Leaves */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.18, 0.75 + i * 0.1, Math.sin(a) * 0.18]}
            rotation={[0.3, a, 0.5]}
            scale={[1.8, 1.0, 1.0]}
          >
            <circleGeometry args={[0.1, 8]} />
            <meshStandardMaterial color="#16a34a" roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene root — full room with characters
// ─────────────────────────────────────────────────────────────────────────────

function RoomScene({
  npcCount,
  playerNickname,
  onDrawResult,
  onStateChange,
}: {
  npcCount: number;
  playerNickname: string;
  onDrawResult?: (grade: string, prizeName: string) => void;
  onStateChange?: (info: {
    yourPos: { x: number; z: number };
    queue: string[];
    activeDrawer: string | null;
  }) => void;
}) {
  const [playerTarget, setPlayerTarget] = useState<{ x: number; z: number }>({ x: 0, z: 2.5 });
  const [playerBubble, setPlayerBubble] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<"IDLE" | "WALKING" | "CELEBRATING">("IDLE");

  // NPC positions, targets, bubbles
  const [npcTargets, setNpcTargets] = useState<{ x: number; z: number }[]>(() =>
    Array.from({ length: npcCount }, (_, i) => ({
      x: -3 + (i % 3) * 2.0,
      z: 1 + Math.floor(i / 3) * 1.5,
    }))
  );
  const [npcBubbles, setNpcBubbles] = useState<(string | null)[]>(Array(npcCount).fill(null));
  const [npcStates, setNpcStates] = useState<("IDLE" | "WALKING" | "CELEBRATING")[]>(Array(npcCount).fill("IDLE"));

  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  // Characters definition
  const playerChar: CharacterData = {
    id: "player",
    nickname: playerNickname,
    color: "#fbbf24",
    isPlayer: true,
  };

  const npcChars: CharacterData[] = Array.from({ length: npcCount }, (_, i) => ({
    id: `npc-${i}`,
    nickname: `NPC${i + 1}`,
    color: NPC_COLORS[i % NPC_COLORS.length] ?? "#6366f1",
    isPlayer: false,
  }));

  // NPC wandering
  useEffect(() => {
    const interval = setInterval(() => {
      setNpcTargets((prev) =>
        prev.map((_, i) => ({
          x: (Math.random() - 0.5) * 6,
          z: (Math.random() - 0.5) * 6,
        }))
      );
      setNpcStates((prev) => prev.map(() => "WALKING"));
      setTimeout(() => {
        setNpcStates((prev) => prev.map(() => "IDLE"));
      }, 2000);
    }, 4000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [npcCount]);

  // Periodic NPC draw at counter
  useEffect(() => {
    if (npcCount === 0) return;
    const interval = setInterval(() => {
      if (activeDrawer) return;
      const idx = Math.floor(Math.random() * npcCount);
      const npc = npcChars[idx];
      if (!npc) return;
      setActiveDrawer(npc.id);
      setNpcTargets((prev) => {
        const next = [...prev];
        next[idx] = { x: 0, z: -2.5 };
        return next;
      });
      setNpcStates((prev) => {
        const next = [...prev] as ("IDLE" | "WALKING" | "CELEBRATING")[];
        next[idx] = "WALKING";
        return next;
      });

      setTimeout(() => {
        const grade = GRADES[Math.floor(Math.random() * GRADES.length)] ?? "C賞";
        setNpcBubbles((prev) => {
          const next = [...prev];
          next[idx] = `${grade}!`;
          return next;
        });
        setNpcStates((prev) => {
          const next = [...prev] as ("IDLE" | "WALKING" | "CELEBRATING")[];
          next[idx] = "CELEBRATING";
          return next;
        });
        setActiveDrawer(null);
        setTimeout(() => {
          setNpcBubbles((prev) => {
            const next = [...prev];
            next[idx] = null;
            return next;
          });
          setNpcStates((prev) => {
            const next = [...prev] as ("IDLE" | "WALKING" | "CELEBRATING")[];
            next[idx] = "IDLE";
            return next;
          });
        }, 3000);
      }, 3000);
    }, 7000 + Math.random() * 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcCount, activeDrawer]);

  // Notify parent
  useEffect(() => {
    onStateChange?.({
      yourPos: playerTarget,
      queue: [],
      activeDrawer,
    });
  }, [playerTarget, activeDrawer, onStateChange]);

  const handleFloorClick = useCallback((point: THREE.Vector3) => {
    const clampedX = Math.max(-4.5, Math.min(4.5, point.x));
    const clampedZ = Math.max(-4.5, Math.min(4.5, point.z));
    setPlayerTarget({ x: clampedX, z: clampedZ });
    setPlayerState("WALKING");
    setTimeout(() => setPlayerState("IDLE"), 2000);
  }, []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={1.2} />
      <directionalLight
        position={[4, 8, 4]}
        intensity={0.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={20}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      

      {/* Room structure */}
      <Floor onClick={handleFloorClick} />
      <FloorTiles />
      <BackWall />
      <SideWallLeft />
      <SideWallRight />
      <Ceiling />
      <Counter />
      <DisplayShelves />
      <EntranceMat />
      <WallArt />
      <CeilingLights />

      {/* Decorative plants */}
      <PottedPlant position={[-4.6, 0, 4.4]} />
      <PottedPlant position={[4.6, 0, 4.4]} />
      <PottedPlant position={[-4.6, 0, -4.0]} />

      {/* Contact shadows */}
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={10} blur={1.5} far={2} />

      {/* Characters */}
      <MovingCharacter
        character={playerChar}
        targetX={playerTarget.x}
        targetZ={playerTarget.z}
        bubbleText={playerBubble}
        state={playerState}
      />
      {npcChars.map((npc, i) => (
        <MovingCharacter
          key={npc.id}
          character={npc}
          targetX={npcTargets[i]?.x ?? 0}
          targetZ={npcTargets[i]?.z ?? 0}
          bubbleText={npcBubbles[i]}
          state={npcStates[i] ?? "IDLE"}
        />
      ))}

      {/* Fixed camera */}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function PrizeDrawRoom3D({
  npcCount = 3,
  onDrawResult,
  onStateChange,
  resultGrade,
  playerNickname = "你",
}: PrizeDrawRoom3DProps) {
  return (
    <div style={{ width: "100%", height: 560 }}>
      <Canvas onCreated={(state) => { state.scene.background = new THREE.Color("#f5f0e8"); }}
        shadows
        camera={{ position: [8, 8, 8], fov: 45 }}
        gl={{ antialias: true }}
      >
        <RoomScene
          npcCount={Math.min(npcCount, 6)}
          playerNickname={playerNickname}
          onDrawResult={onDrawResult}
          onStateChange={onStateChange}
        />
      </Canvas>
    </div>
  );
}
