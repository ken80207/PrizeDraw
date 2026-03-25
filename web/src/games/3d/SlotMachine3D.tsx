"use client";

import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  RoundedBox,
  Text,
  Float,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotMachine3DProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: string) => void;
}

const GRADES = ["A賞", "B賞", "C賞", "D賞"] as const;

const GRADE_COLORS: Record<string, string> = {
  "A賞": "#f59e0b",
  "B賞": "#3b82f6",
  "C賞": "#10b981",
  "D賞": "#a855f7",
};

const REEL_SYMBOLS = ["A賞", "C賞", "B賞", "D賞", "A賞", "B賞", "C賞", "D賞"];
const SYMBOL_ANGLE = (Math.PI * 2) / REEL_SYMBOLS.length;

// ─────────────────────────────────────────────────────────────────────────────
// Reel Drum — spinning cylinder with symbol labels
// ─────────────────────────────────────────────────────────────────────────────

interface ReelProps {
  position: [number, number, number];
  targetIndex: number;
  spinning: boolean;
  onStop?: () => void;
  delay?: number;
}

function ReelDrum({ position, targetIndex, spinning, onStop, delay = 0 }: ReelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spinSpeedRef = useRef(0);
  const stoppedRef = useRef(false);
  const delayCounterRef = useRef(0);
  const targetAngle = -targetIndex * SYMBOL_ANGLE;

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (spinning) {
      stoppedRef.current = false;
      delayCounterRef.current += delta;
      if (delayCounterRef.current < delay) return;
      spinSpeedRef.current = Math.min(spinSpeedRef.current + delta * 8, 12);
      groupRef.current.rotation.x += spinSpeedRef.current * delta;
    } else {
      if (stoppedRef.current) return;
      // Ease out toward target
      const current = groupRef.current.rotation.x;
      // Normalise current to nearest full rotation past start
      const baseRotations = Math.floor(current / (Math.PI * 2));
      const desired = baseRotations * Math.PI * 2 + Math.abs(targetAngle) + Math.PI * 4;
      const diff = desired - current;
      if (Math.abs(diff) < 0.01) {
        groupRef.current.rotation.x = desired;
        spinSpeedRef.current = 0;
        stoppedRef.current = true;
        delayCounterRef.current = 0;
        onStop?.();
      } else {
        groupRef.current.rotation.x += diff * delta * 5;
      }
    }
  });

  const radius = 0.38;
  const height = 0.55;

  return (
    <group ref={groupRef} position={position}>
      {/* Cylinder drum */}
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 16]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Symbol labels around cylinder surface */}
      {REEL_SYMBOLS.map((sym, i) => {
        const angle = i * SYMBOL_ANGLE;
        const x = Math.sin(angle) * (radius + 0.01);
        const z = Math.cos(angle) * (radius + 0.01);
        const color = GRADE_COLORS[sym] ?? "#ffffff";
        return (
          <Text
            key={i}
            position={[x, 0, z]}
            rotation={[0, -angle, 0]}
            fontSize={0.13}
            color={color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.005}
            outlineColor="#000000"
          >
            {sym}
          </Text>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine Body
// ─────────────────────────────────────────────────────────────────────────────

function MachineBody() {
  return (
    <group>
      {/* Main cabinet */}
      <RoundedBox args={[2.2, 2.8, 1.2]} radius={0.08} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color="#4c1d95" metalness={0.8} roughness={0.2} />
      </RoundedBox>
      {/* Top marquee panel */}
      <RoundedBox args={[2.0, 0.5, 0.15]} radius={0.04} smoothness={4} position={[0, 1.6, 0.58]}>
        <meshStandardMaterial color="#6d28d9" metalness={0.6} roughness={0.3} emissive="#3b0764" emissiveIntensity={0.4} />
      </RoundedBox>
      {/* Reel window frame */}
      <RoundedBox args={[1.6, 0.8, 0.08]} radius={0.04} smoothness={4} position={[0, 0.1, 0.61]}>
        <meshStandardMaterial color="#7c3aed" metalness={0.7} roughness={0.2} />
      </RoundedBox>
      {/* Reel window glass */}
      <mesh position={[0, 0.1, 0.62]}>
        <planeGeometry args={[1.45, 0.65]} />
        <MeshTransmissionMaterial
          transmission={0.85}
          thickness={0.1}
          roughness={0.05}
          color="#c4b5fd"
          opacity={0.4}
          transparent
        />
      </mesh>
      {/* Bottom coin tray */}
      <RoundedBox args={[1.2, 0.15, 0.4]} radius={0.04} smoothness={4} position={[0, -1.3, 0.3]}>
        <meshStandardMaterial color="#5b21b6" metalness={0.9} roughness={0.1} />
      </RoundedBox>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lever
// ─────────────────────────────────────────────────────────────────────────────

interface LeverProps {
  onPull: () => void;
  disabled: boolean;
}

function Lever({ onPull, disabled }: LeverProps) {
  const armRef = useRef<THREE.Group>(null);
  const [pulled, setPulled] = useState(false);
  const pullProgressRef = useRef(0);

  useFrame((_, delta) => {
    if (!armRef.current) return;
    const target = pulled ? 1 : 0;
    pullProgressRef.current += (target - pullProgressRef.current) * delta * 8;
    armRef.current.rotation.z = pullProgressRef.current * (Math.PI / 2.5);
    if (pulled && pullProgressRef.current > 0.95) {
      setPulled(false);
    }
  });

  const handleClick = () => {
    if (disabled) return;
    setPulled(true);
    onPull();
  };

  return (
    <group position={[1.35, 0.2, 0]}>
      {/* Base mount */}
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.15, 12]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Arm */}
      <group ref={armRef} position={[0, 0.07, 0]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.9, 8]} />
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.15} />
        </mesh>
        {/* Knob */}
        <mesh
          position={[0, 0.95, 0]}
          onClick={handleClick}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = disabled ? "not-allowed" : "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = "default"; }}
        >
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial
            color={disabled ? "#374151" : "#ef4444"}
            metalness={0.4}
            roughness={0.3}
            emissive={disabled ? "#000" : "#7f1d1d"}
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame chaser lights
// ─────────────────────────────────────────────────────────────────────────────

function FrameLights() {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
  });

  const positions: [number, number, number][] = [];
  // Top edge
  for (let i = 0; i < 7; i++) positions.push([-1.0 + i * 0.33, 1.45, 0.65]);
  // Bottom edge
  for (let i = 0; i < 7; i++) positions.push([-1.0 + i * 0.33, -0.45, 0.65]);
  // Left edge
  for (let i = 0; i < 5; i++) positions.push([-1.1, 1.1 - i * 0.4, 0.65]);
  // Right edge
  for (let i = 0; i < 5; i++) positions.push([1.1, 1.1 - i * 0.4, 0.65]);

  const colors = ["#f59e0b", "#3b82f6", "#10b981", "#a855f7", "#ec4899"];

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => {
        const colorIndex = i % colors.length;
        return (
          <ChaserLight key={i} position={pos} color={colors[colorIndex]} index={i} totalCount={positions.length} />
        );
      })}
    </group>
  );
}

function ChaserLight({ position, color, index, totalCount }: {
  position: [number, number, number];
  color: string;
  index: number;
  totalCount: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const phase = (timeRef.current * 3 - index * (6 / totalCount)) % (Math.PI * 2);
    const brightness = (Math.sin(phase) + 1) / 2;
    mat.emissiveIntensity = brightness * 1.5;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.04, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Jackpot Display
// ─────────────────────────────────────────────────────────────────────────────

function JackpotDisplay({ result }: { result: string | null }) {
  return (
    <group position={[0, 1.62, 0.66]}>
      <Float speed={result ? 3 : 1} floatIntensity={result ? 0.08 : 0.02}>
        <Text
          fontSize={result ? 0.22 : 0.16}
          color={result ? (GRADE_COLORS[result] ?? "#ffffff") : "#fbbf24"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#000000"
        >
          {result ? `${result}!` : "拉霸機"}
        </Text>
      </Float>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene root — orchestrates game state
// ─────────────────────────────────────────────────────────────────────────────

type GameState3D = "IDLE" | "SPINNING" | "RESULT";

interface SceneProps {
  resultGrade: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: string) => void;
}

function SlotScene({ resultGrade, onResult, onStateChange }: SceneProps) {
  const [gameState, setGameState] = useState<GameState3D>("IDLE");
  const [result, setResult] = useState<string | null>(null);
  const stoppedReelsRef = useRef(0);

  const targetIndex = REEL_SYMBOLS.indexOf(resultGrade as typeof REEL_SYMBOLS[number]);
  const safeTargetIndex = targetIndex === -1 ? 0 : targetIndex;

  const handleLeverPull = useCallback(() => {
    if (gameState !== "IDLE") return;
    setResult(null);
    setGameState("SPINNING");
    stoppedReelsRef.current = 0;
    onStateChange?.("SPINNING");
  }, [gameState, onStateChange]);

  const handleReelStop = useCallback(() => {
    stoppedReelsRef.current += 1;
    if (stoppedReelsRef.current >= 3) {
      setGameState("RESULT");
      setResult(resultGrade);
      onResult?.(resultGrade);
      onStateChange?.("RESULT");
    }
  }, [resultGrade, onResult, onStateChange]);

  const spinning = gameState === "SPINNING";

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={1.2} />
      <spotLight position={[0, 4, 3]} intensity={3.2} angle={0.5} penumbra={0.5} castShadow />
      <pointLight position={[-2, 2, 2]} intensity={2.4} color="#c4b5fd" />
      <pointLight position={[2, 2, 2]} intensity={2.4} color="#fbbf24" />

      {/* Machine */}
      <MachineBody />
      <FrameLights />
      <JackpotDisplay result={result} />

      {/* Reels */}
      <ReelDrum
        position={[-0.52, 0.1, 0.68]}
        targetIndex={safeTargetIndex}
        spinning={spinning}
        onStop={handleReelStop}
        delay={0}
      />
      <ReelDrum
        position={[0, 0.1, 0.68]}
        targetIndex={safeTargetIndex}
        spinning={spinning}
        onStop={handleReelStop}
        delay={0.4}
      />
      <ReelDrum
        position={[0.52, 0.1, 0.68]}
        targetIndex={safeTargetIndex}
        spinning={spinning}
        onStop={handleReelStop}
        delay={0.8}
      />

      {/* Lever */}
      <Lever onPull={handleLeverPull} disabled={gameState === "SPINNING"} />

      {/* Fixed camera — no orbit controls */}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function SlotMachine3D({
  resultGrade = "A賞",
  prizeName,
  onResult,
  onStateChange,
}: SlotMachine3DProps) {
  return (
    <div style={{ width: "100%", height: 480 }}>
      <Canvas onCreated={(state) => { state.scene.background = new THREE.Color("#1a1025"); }} shadows camera={{ position: [0, 1.5, 3.5], fov: 50 }}>
        <SlotScene
          resultGrade={resultGrade}
          onResult={onResult}
          onStateChange={onStateChange}
        />
      </Canvas>
    </div>
  );
}
