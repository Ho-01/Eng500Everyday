// src/hooks/usePronounce.ts
import { useEffect, useMemo, useRef, useState } from "react";

export function usePronounce(lang = "en-US", rate = 0.95) {
  const supports = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const autoOnceKeys = useRef<Set<string>>(new Set());

  // Load voices
  useEffect(() => {
    if (!supports) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    const prev = window.speechSynthesis.onvoiceschanged as any;
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = prev; };
  }, [supports]);

  // Pick an English voice
  const voice = useMemo(() => {
    if (!voices.length) return null;
    const names = [
      "Google US English",
      "Google 영어(미국)",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Jenny",
      "Samantha",
    ];
    for (const n of names) {
      const v = voices.find(x => x.name === n);
      if (v) return v;
    }
    return (
      voices.find(v => /^en(-|_)(US|GB)/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang)) ||
      voices[0]
    );
  }, [voices]);

  const cancel = () => { try { window.speechSynthesis.cancel(); } catch {} };

  const speak = (text: string) => {
    if (!supports || !text) return;
    try {
      cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      if (voice) u.voice = voice;
      u.onstart = () => setIsSpeaking(true);
      const off = () => setIsSpeaking(false);
      u.onend = off; u.onerror = off;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  // Speak once per key (e.g., "q-3")
  const autoOnce = (key: string, text: string, delayMs = 150) => {
    if (!supports || autoOnceKeys.current.has(key)) return;
    autoOnceKeys.current.add(key);
    const t = setTimeout(() => speak(text), delayMs);
    return () => clearTimeout(t);
  };

  useEffect(() => () => cancel(), []); // cleanup on unmount

  return { supports, isSpeaking, speak, cancel, autoOnce, resetAuto: () => autoOnceKeys.current.clear() };
}
