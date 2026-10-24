import { describe, it, expect, vi } from "vitest";
import { playCelebrationAudio } from "@/components/RewardCelebrationModal";

describe("RewardCelebrationModal & Web Audio Synthesizer", () => {
  it("playCelebrationAudio does not crash in Node/SSR environment where window or AudioContext is undefined", () => {
    expect(() => playCelebrationAudio()).not.toThrow();
  });

  it("playCelebrationAudio creates oscillators and gain nodes when AudioContext is available", () => {
    const startedOscillators: number[] = [];
    const stoppedOscillators: number[] = [];

    class MockAudioContext {
      currentTime = 10;
      state = "running";
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime: vi.fn((freq: number) => startedOscillators.push(freq)) },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(() => stoppedOscillators.push(1)),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }

    vi.stubGlobal("window", {
      AudioContext: MockAudioContext,
    });


    expect(() => playCelebrationAudio()).not.toThrow();
    // 4 harmonic notes: C5, E5, G5, C6
    expect(startedOscillators).toEqual([523.25, 659.25, 783.99, 1046.5]);
    expect(stoppedOscillators.length).toBe(4);

    vi.unstubAllGlobals();
  });
});
