"use client";

import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Float,
  MeshTransmissionMaterial,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GachaMachine3DProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: string) => void;
}

type GachaState3D = "IDLE" | "TURNING" | "DISPENSING" | "RESULT";

const GRADE_COLORS: Record<string, string> = {
  "A賞": "#f59e0b",
  "B賞": "#3b82f6",
  "C賞": "#10b981",
  "D賞": "#a855f7",
};

// ─────────────────────────────────────────────────────────────────────────────
// Machine body (red metallic base)
// ─────────────────────────────────────────────────────────────────────────────

function MachineBody() {
  return (
    <group>
      {/* Base pedestal */}
      <mesh position={[0, -1.1, 0]}>
        <cylinderGeometry args={[0.6, 0.75, 0.6, 24]} />
        <meshStandardMaterial color="#991b1b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Middle neck */}
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.5, 20]} />
        <meshStandardMaterial color="#b91c1c" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Dome collar ring */}
      <mesh position={[0, -0.35, 0]}>
        <torusGeometry args={[0.52, 0.07, 10, 32]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} emissive="#78350f" emissiveIntensity={0.3} />
      </mesh>
      {/* Coin slot slit */}
      <mesh position={[0.38, -0.7, 0.18]}>
        <boxGeometry args={[0.06, 0.14, 0.04]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {/* Label plate */}
      <RoundedBox args={[0.5, 0.2, 0.05]} radius={0.02} smoothness={4} position={[0, -1.0, 0.74]}>
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </RoundedBox>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass dome with floating capsules inside
// ─────────────────────────────────────────────────────────────────────────────

const CAPSULE_DATA = [
  { pos: [0.0,  0.1,  0.0],  colorA: "#f59e0b", colorB: "#fde68a", grade: "A賞" },
  { pos: [-0.3, -0.1,  0.15], colorA: "#3b82f6", colorB: "#bae6fd", grade: "B賞" },
  { pos: [0.25, 0.15, -0.2], colorA: "#10b981", colorB: "#a7f3d0", grade: "C賞" },
  { pos: [0.1, -0.2,  0.2], colorA: "#a855f7", colorB: "#ddd6fe", grade: "D賞" },
  { pos: [-0.2, 0.2, -0.1], colorA: "#ec4899", colorB: "#fbcfe8", grade: "B賞" },
  { pos: [0.35, -0.05, 0.1],colorA: "#06b6d4", colorB: "#cffafe", grade: "C賞" },
] as const;

function GlassDome({ spinning }: { spinning: boolean }) {
  const capsulesRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!capsulesRef.current) return;
    if (spinning) {
      capsulesRef.current.rotation.y += delta * 2.5;
      capsulesRef.current.rotation.x += delta * 0.8;
    } else {
      capsulesRef.current.rotation.y += delta * 0.15;
    }
  });

  return (
    <group position={[0, 0.35, 0]}>
      {/* Transparent dome sphere */}
      <mesh>
        <sphereGeometry args={[0.62, 32, 32]} />
        <MeshTransmissionMaterial
          transmission={0.92}
          thickness={0.15}
          roughness={0.03}
          color="#bfdbfe"
          opacity={0.25}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Capsules inside */}
      <group ref={capsulesRef}>
        {CAPSULE_DATA.map((c, i) => (
          <Capsule key={i} position={c.pos as [number, number, number]} colorTop={c.colorA} colorBottom={c.colorB} index={i} />
        ))}
      </group>
    </group>
  );
}

function Capsule({ position, colorTop, colorBottom, index }: {
  position: [number, number, number];
  colorTop: string;
  colorBottom: string;
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() + index * 0.7;
    groupRef.current.rotation.x = Math.sin(t * 0.8) * 0.3;
    groupRef.current.rotation.z = Math.cos(t * 0.6) * 0.3;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Bottom half */}
      <mesh position={[0, -0.075, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.15, 14, 1, false, 0, Math.PI * 2]} />
        <meshStandardMaterial color={colorBottom} roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <sphereGeometry args={[0.08, 14, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color={colorBottom} roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Top half */}
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.15, 14, 1, false, 0, Math.PI * 2]} />
        <meshStandardMaterial color={colorTop} roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.08, 14, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={colorTop} roughness={0.3} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle (rotatable crank)
// ─────────────────────────────────────────────────────────────────────────────

interface HandleProps {
  onTurn: () => void;
  disabled: boolean;
}

function Handle({ onTurn, disabled }: HandleProps) {
  const handleRef = useRef<THREE.Group>(null);
  const spinRef = useRef(0);
  const targetRef = useRef(0);

  useFrame((_, delta) => {
    if (!handleRef.current) return;
    const diff = targetRef.current - spinRef.current;
    if (Math.abs(diff) > 0.01) {
      spinRef.current += diff * delta * 6;
      handleRef.current.rotation.z = spinRef.current;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (disabled) return;
    targetRef.current -= Math.PI * 1.2;
    onTurn();
  };

  return (
    <group position={[0.5, -0.7, 0]}>
      {/* Handle arm group */}
      <group ref={handleRef}>
        {/* Arm */}
        <mesh position={[0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.44, 10]} />
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Vertical part */}
        <mesh position={[0.44, -0.14, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.28, 10]} />
          <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Knob */}
        <mesh
          position={[0.44, -0.3, 0]}
          onClick={handleClick}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = disabled ? "not-allowed" : "grab"; }}
          onPointerOut={() => { document.body.style.cursor = "default"; }}
        >
          <sphereGeometry args={[0.09, 14, 14]} />
          <meshStandardMaterial
            color={disabled ? "#374151" : "#fbbf24"}
            metalness={0.4}
            roughness={0.3}
            emissive={disabled ? "#000" : "#78350f"}
            emissiveIntensity={0.4}
          />
        </mesh>
      </group>
      {/* Center hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.08, 12]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispensing chute
// ─────────────────────────────────────────────────────────────────────────────

function Chute({ dispensing, capsuleColor }: { dispensing: boolean; capsuleColor: string }) {
  const capsuleRef = useRef<THREE.Mesh>(null);
  const yRef = useRef(0.0);
  const activeRef = useRef(false);

  useFrame((_, delta) => {
    if (!capsuleRef.current) return;
    if (dispensing && !activeRef.current) {
      activeRef.current = true;
      yRef.current = 0.0;
    }
    if (activeRef.current) {
      yRef.current = Math.max(yRef.current - delta * 1.2, -0.6);
      capsuleRef.current.position.y = yRef.current;
      if (yRef.current <= -0.6) {
        activeRef.current = false;
      }
    }
    if (!dispensing) {
      activeRef.current = false;
    }
  });

  return (
    <group position={[0, -0.62, 0.55]}>
      {/* Chute opening */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.14, 0.035, 10, 24]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Chute tube */}
      <mesh position={[0, -0.22, 0.1]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.44, 14, 1, true]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Dispensed capsule */}
      {dispensing && (
        <mesh ref={capsuleRef} position={[0, 0, 0]}>
          <sphereGeometry args={[0.1, 14, 14]} />
          <meshStandardMaterial
            color={capsuleColor}
            emissive={capsuleColor}
            emissiveIntensity={0.5}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene root
// ─────────────────────────────────────────────────────────────────────────────

function GachaScene({ resultGrade, onResult, onStateChange }: {
  resultGrade: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: string) => void;
}) {
  const [gameState, setGameState] = useState<GachaState3D>("IDLE");
  const [result, setResult] = useState<string | null>(null);
  const [dispensing, setDispensing] = useState(false);

  const handleTurn = useCallback(() => {
    if (gameState !== "IDLE") return;
    setGameState("TURNING");
    onStateChange?.("TURNING");

    setTimeout(() => {
      setGameState("DISPENSING");
      setDispensing(true);
      onStateChange?.("DISPENSING");

      setTimeout(() => {
        setGameState("RESULT");
        setResult(resultGrade);
        onResult?.(resultGrade);
        onStateChange?.("RESULT");
      }, 1500);
    }, 1200);
  }, [gameState, resultGrade, onResult, onStateChange]);

  const capsuleColor = GRADE_COLORS[resultGrade] ?? "#ffffff";

  return (
    <>
      <ambientLight intensity={0.4} />
      <spotLight position={[2, 5, 3]} intensity={1.1} angle={0.5} penumbra={0.4} castShadow />
      <pointLight position={[-2, 1, 2]} intensity={0.4} color="#fbbf24" />
      <pointLight position={[1, 2, -1]} intensity={0.35} color="#c4b5fd" />

      {/* Floor shadow plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.42, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <MachineBody />
      <GlassDome spinning={gameState === "TURNING"} />
      <Handle onTurn={handleTurn} disabled={gameState !== "IDLE"} />
      <Chute dispensing={dispensing} capsuleColor={capsuleColor} />

      {/* Machine label */}
      <Text
        position={[0, -0.98, 0.77]}
        fontSize={0.1}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        扭蛋機
      </Text>

      {/* Result display */}
      {result && (
        <Float speed={2.5} floatIntensity={0.12}>
          <Text
            position={[0, 1.4, 0]}
            fontSize={0.35}
            color={GRADE_COLORS[result] ?? "#ffffff"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#000000"
          >
            {result}!
          </Text>
        </Float>
      )}

      {/* Idle hint */}
      {gameState === "IDLE" && !result && (
        <Text
          position={[0, 1.2, 0]}
          fontSize={0.12}
          color="#9ca3af"
          anchorX="center"
          anchorY="middle"
        >
          轉動把手投入硬幣
        </Text>
      )}

      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={5.5}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 1.8}
        target={[0, -0.2, 0]}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function GachaMachine3D({
  resultGrade = "A賞",
  prizeName,
  onResult,
  onStateChange,
}: GachaMachine3DProps) {
  return (
    <div style={{ width: "100%", height: 480 }}>
      <Canvas shadows camera={{ position: [0, 1, 3.2], fov: 50 }}>
        <GachaScene
          resultGrade={resultGrade}
          onResult={onResult}
          onStateChange={onStateChange}
        />
      </Canvas>
    </div>
  );
}
