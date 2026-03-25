"use client";

import { useRef, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Float,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ClawMachine3DProps {
  resultGrade?: string;
  prizeName?: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: string) => void;
}

type ClawState3D = "IDLE" | "AIMING" | "DESCENDING" | "GRABBING" | "LIFTING" | "RESULT";

const GRADE_COLORS: Record<string, string> = {
  "A賞": "#f59e0b",
  "B賞": "#3b82f6",
  "C賞": "#10b981",
  "D賞": "#a855f7",
};

// ─────────────────────────────────────────────────────────────────────────────
// Glass case
// ─────────────────────────────────────────────────────────────────────────────

function GlassCase() {
  return (
    <group>
      {/* Back wall */}
      <mesh position={[0, 0.5, -1.1]}>
        <planeGeometry args={[2.2, 3.0]} />
        <MeshTransmissionMaterial
          transmission={0.88}
          thickness={0.08}
          roughness={0.04}
          color="#bfdbfe"
          opacity={0.25}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Front wall */}
      <mesh position={[0, 0.5, 1.1]}>
        <planeGeometry args={[2.2, 3.0]} />
        <MeshTransmissionMaterial
          transmission={0.88}
          thickness={0.08}
          roughness={0.04}
          color="#bfdbfe"
          opacity={0.25}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Left wall */}
      <mesh position={[-1.1, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 3.0]} />
        <MeshTransmissionMaterial
          transmission={0.88}
          thickness={0.08}
          roughness={0.04}
          color="#bfdbfe"
          opacity={0.25}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Right wall */}
      <mesh position={[1.1, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 3.0]} />
        <MeshTransmissionMaterial
          transmission={0.88}
          thickness={0.08}
          roughness={0.04}
          color="#bfdbfe"
          opacity={0.25}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Floor inside case */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
      {/* Top lid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.0, 0]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshStandardMaterial color="#1e3a5f" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Frame edges */}
      {[[-1.1, 0.5, -1.1], [-1.1, 0.5, 1.1], [1.1, 0.5, -1.1], [1.1, 0.5, 1.1]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.06, 3.0, 0.06]} />
          <meshStandardMaterial color="#1e40af" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {/* Cabinet base */}
      <mesh position={[0, -1.25, 0]}>
        <boxGeometry args={[2.4, 0.5, 2.4]} />
        <meshStandardMaterial color="#1e3a5f" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top rail
// ─────────────────────────────────────────────────────────────────────────────

function Rail() {
  return (
    <group position={[0, 1.95, 0]}>
      {/* X-axis rail */}
      <mesh>
        <boxGeometry args={[2.0, 0.06, 0.08]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Y-axis rail */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[2.0, 0.06, 0.08]} />
        <meshStandardMaterial color="#4b5563" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Claw assembly
// ─────────────────────────────────────────────────────────────────────────────

interface ClawProps {
  clawX: number;
  clawZ: number;
  clawY: number;
  open: boolean;
  grabbed: boolean;
  grabbedColor: string;
}

function Claw({ clawX, clawZ, clawY, open, grabbed, grabbedColor }: ClawProps) {
  const prongOpen = open ? 0.45 : 0.12;
  const prongY = clawY;

  return (
    <group position={[clawX, prongY, clawZ]}>
      {/* Vertical cable */}
      <mesh position={[0, (2.0 - prongY) / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 2.0 - prongY, 6]} />
        <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Claw head body */}
      <mesh>
        <cylinderGeometry args={[0.12, 0.08, 0.22, 12]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* 3 prongs */}
      {[0, 1, 2].map((i) => {
        const baseAngle = (i / 3) * Math.PI * 2;
        const spread = prongOpen;
        return (
          <group key={i} rotation={[0, baseAngle, 0]}>
            <mesh
              position={[spread * 0.5, -0.22, 0]}
              rotation={[0, 0, -spread * 1.8]}
            >
              <cylinderGeometry args={[0.025, 0.018, 0.38, 6]} />
              <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.15} />
            </mesh>
          </group>
        );
      })}
      {/* Grabbed prize indicator */}
      {grabbed && (
        <mesh position={[0, -0.55, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color={grabbedColor} emissive={grabbedColor} emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plush toys inside case
// ─────────────────────────────────────────────────────────────────────────────

function PlushToys({ resultGrade }: { resultGrade: string }) {
  const toyData: Array<{ pos: [number, number, number]; color: string; grade: string; scale: number }> = [
    { pos: [-0.55, -0.78, -0.45], color: "#f59e0b", grade: "A賞", scale: 0.22 },
    { pos: [0.45, -0.82, -0.3],  color: "#3b82f6", grade: "B賞", scale: 0.18 },
    { pos: [-0.25, -0.84, 0.4],  color: "#10b981", grade: "C賞", scale: 0.16 },
    { pos: [0.6,  -0.82, 0.5],  color: "#a855f7", grade: "D賞", scale: 0.14 },
    { pos: [0.0,  -0.82, -0.55], color: "#ec4899", grade: "B賞", scale: 0.16 },
    { pos: [-0.7, -0.84, 0.3],  color: "#06b6d4", grade: "C賞", scale: 0.14 },
  ];

  return (
    <group>
      {toyData.map((toy, i) => {
        const isTarget = toy.grade === resultGrade;
        return (
          <Float key={i} speed={1.2} floatIntensity={0.04} rotationIntensity={0.1}>
            <group position={toy.pos}>
              <mesh scale={toy.scale}>
                <sphereGeometry args={[1, 14, 14]} />
                <meshStandardMaterial
                  color={toy.color}
                  roughness={0.85}
                  metalness={0.0}
                  emissive={isTarget ? toy.color : "#000"}
                  emissiveIntensity={isTarget ? 0.35 : 0}
                />
              </mesh>
              {/* Ear bumps */}
              <mesh position={[-toy.scale * 0.55, toy.scale * 0.7, 0]} scale={toy.scale * 0.42}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color={toy.color} roughness={0.9} />
              </mesh>
              <mesh position={[toy.scale * 0.55, toy.scale * 0.7, 0]} scale={toy.scale * 0.42}>
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial color={toy.color} roughness={0.9} />
              </mesh>
            </group>
          </Float>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Control panel
// ─────────────────────────────────────────────────────────────────────────────

interface ControlPanelProps {
  onMove: (dx: number, dz: number) => void;
  onDrop: () => void;
  disabled: boolean;
}

function ControlPanel({ onMove, onDrop, disabled }: ControlPanelProps) {
  return (
    <group position={[1.5, -0.6, 0]}>
      {/* Panel body */}
      <mesh>
        <boxGeometry args={[0.55, 1.0, 0.35]} />
        <meshStandardMaterial color="#1e3a5f" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Joystick base */}
      <mesh position={[0, 0.12, 0.1]}>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Joystick stick */}
      <mesh position={[0, 0.22, 0.1]}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
        <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Joystick knob */}
      <mesh position={[0, 0.33, 0.1]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#ef4444" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Drop button */}
      <mesh
        position={[0, -0.12, 0.15]}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (!disabled) onDrop(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = disabled ? "not-allowed" : "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <cylinderGeometry args={[0.1, 0.1, 0.06, 12]} />
        <meshStandardMaterial
          color={disabled ? "#374151" : "#22c55e"}
          emissive={disabled ? "#000" : "#14532d"}
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      {/* Arrow buttons */}
      {[
        { dx: -0.18, dz: 0,    move: [-1, 0],  label: "←" },
        { dx:  0.18, dz: 0,    move: [1, 0],   label: "→" },
        { dx: 0,    dz: -0.18, move: [0, -1],  label: "↑" },
        { dx: 0,    dz:  0.18, move: [0, 1],   label: "↓" },
      ].map((btn, i) => (
        <mesh
          key={i}
          position={[btn.dx, 0.1 + btn.dz * 0.5, -0.08]}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if (!disabled) onMove(btn.move[0] ?? 0, btn.move[1] ?? 0);
          }}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = "default"; }}
        >
          <boxGeometry args={[0.1, 0.06, 0.1]} />
          <meshStandardMaterial color="#1d4ed8" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result banner
// ─────────────────────────────────────────────────────────────────────────────

function ResultBanner({ result }: { result: string | null }) {
  if (!result) return null;
  return (
    <Float speed={2} floatIntensity={0.1}>
      <Text
        position={[0, 2.5, 1.2]}
        fontSize={0.32}
        color={GRADE_COLORS[result] ?? "#ffffff"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.012}
        outlineColor="#000000"
      >
        {result} 获得!
      </Text>
    </Float>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene root
// ─────────────────────────────────────────────────────────────────────────────

function ClawScene({ resultGrade, onResult, onStateChange }: {
  resultGrade: string;
  onResult?: (grade: string) => void;
  onStateChange?: (state: string) => void;
}) {
  const [gameState, setGameState] = useState<ClawState3D>("IDLE");
  const [clawX, setClawX] = useState(0);
  const [clawZ, setClawZ] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  const clawYRef = useRef(1.9);
  const clawYDisplayRef = useRef(1.9);
  const [clawYDisplay, setClawYDisplay] = useState(1.9);
  const [clawOpen, setClawOpen] = useState(true);
  const [grabbed, setGrabbed] = useState(false);

  const phaseRef = useRef<ClawState3D>("IDLE");

  useFrame((_, delta) => {
    if (phaseRef.current === "DESCENDING") {
      clawYRef.current = Math.max(clawYRef.current - delta * 0.9, -0.65);
      clawYDisplayRef.current = clawYRef.current;
      setClawYDisplay(clawYRef.current);
      if (clawYRef.current <= -0.65) {
        phaseRef.current = "GRABBING";
        setGameState("GRABBING");
        setClawOpen(false);
        onStateChange?.("GRABBING");
        setTimeout(() => {
          phaseRef.current = "LIFTING";
          setGameState("LIFTING");
          setGrabbed(true);
          onStateChange?.("LIFTING");
        }, 600);
      }
    } else if (phaseRef.current === "LIFTING") {
      clawYRef.current = Math.min(clawYRef.current + delta * 0.9, 1.9);
      clawYDisplayRef.current = clawYRef.current;
      setClawYDisplay(clawYRef.current);
      if (clawYRef.current >= 1.9) {
        phaseRef.current = "RESULT";
        setGameState("RESULT");
        setResult(resultGrade);
        onResult?.(resultGrade);
        onStateChange?.("RESULT");
      }
    }
  });

  const handleMove = useCallback((dx: number, dz: number) => {
    if (gameState !== "IDLE") return;
    setClawX((x) => Math.max(-0.7, Math.min(0.7, x + dx * 0.25)));
    setClawZ((z) => Math.max(-0.7, Math.min(0.7, z + dz * 0.25)));
  }, [gameState]);

  const handleDrop = useCallback(() => {
    if (gameState !== "IDLE") return;
    phaseRef.current = "DESCENDING";
    setGameState("DESCENDING");
    onStateChange?.("DESCENDING");
  }, [gameState, onStateChange]);

  return (
    <>
      <ambientLight intensity={1.2} />
      <spotLight position={[0, 5, 3]} intensity={3.0} angle={0.5} penumbra={0.4} castShadow />
      <pointLight position={[0, 1.8, 0]} intensity={2.6} color="#bfdbfe" />
      <pointLight position={[-2, 0, 0]} intensity={2.3} color="#c4b5fd" />

      <GlassCase />
      <Rail />
      <PlushToys resultGrade={resultGrade} />
      <Claw
        clawX={clawX}
        clawZ={clawZ}
        clawY={clawYDisplay}
        open={clawOpen}
        grabbed={grabbed}
        grabbedColor={GRADE_COLORS[resultGrade] ?? "#ffffff"}
      />
      <ControlPanel
        onMove={handleMove}
        onDrop={handleDrop}
        disabled={gameState !== "IDLE"}
      />
      <ResultBanner result={result} />

      {/* Aiming crosshair on floor */}
      {gameState === "IDLE" && (
        <mesh position={[clawX, -0.98, clawZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.14, 0.18, 20]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.8} transparent opacity={0.7} />
        </mesh>
      )}

    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────

export function ClawMachine3D({
  resultGrade = "A賞",
  prizeName,
  onResult,
  onStateChange,
}: ClawMachine3DProps) {
  return (
    <div style={{ width: "100%", height: 480 }}>
      <Canvas onCreated={(state) => { state.scene.background = new THREE.Color("#1a1025"); }} shadows camera={{ position: [3, 2.5, 4], fov: 45 }}>
        <ClawScene
          resultGrade={resultGrade}
          onResult={onResult}
          onStateChange={onStateChange}
        />
      </Canvas>
    </div>
  );
}
