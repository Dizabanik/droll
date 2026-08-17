import React from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  PerspectiveCamera,
} from '@react-three/drei';
import environment from '../dice-engine/environment.hdr';
import { AudioListenerProvider } from '../dice-engine/audio/AudioListenerProvider';
import { Tray } from '../dice-engine/tray/Tray';
import { InteractiveDiceRoll } from '../dice-engine/dice/InteractiveDiceRoll';
import { TraySuspense } from '../dice-engine/tray/TraySuspense';
import { DiceRollSync } from '../dice-engine/plugin/DiceRollSync';
import { useDiceRollStore } from '../dice-engine/dice/store';

export const Dice3DOverlay: React.FC = () => {
  const roll = useDiceRollStore((state) => state.roll);

  return (
    <>
      {/* Background sync for multiplayer metadata */}
      <DiceRollSync />

      {roll && (
        <div className="fixed inset-y-0 left-6 z-40 pointer-events-none flex items-center justify-start">
          <div className="w-[min(calc(100vh/2),460px)] h-[90vh] max-h-[820px] relative rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md pointer-events-auto">
            <TraySuspense>
              <Canvas frameloop="always">
                <AudioListenerProvider>
                  <Environment files={environment} />
                  <ContactShadows
                    resolution={256}
                    scale={[1, 2]}
                    position={[0, 0, 0]}
                    blur={0.5}
                    opacity={0.6}
                    far={1}
                    color="#111111"
                  />
                  <Tray />
                  <InteractiveDiceRoll />
                  <PerspectiveCamera
                    makeDefault
                    fov={28}
                    position={[0, 4.3, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                  />
                </AudioListenerProvider>
              </Canvas>
            </TraySuspense>
          </div>
        </div>
      )}
    </>
  );
};
