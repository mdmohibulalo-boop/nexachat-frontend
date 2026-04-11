import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  url: string; // url|DUR=12
  self: boolean;
};

export default function VoiceMessageBubble({ url, self }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  // ✅ Parse url and duration from message
  const parts = url.split("|DUR=");
  const audioUrl = parts[0];
  const msgDur = parts[1] ? parseInt(parts[1]) : 0;

  const bars = useMemo(() => {
    return Array.from({ length: 22 }).map(() => Math.floor(Math.random() * 24) + 6);
  }, []);

  const format = (sec: number) => {
    if (!isFinite(sec) || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const safeDuration =
    msgDur > 0 ? msgDur : isFinite(duration) && !isNaN(duration) ? duration : 0;

  const safeCurrent = isFinite(current) && !isNaN(current) ? current : 0;

  const progress = safeDuration > 0 ? (safeCurrent / safeDuration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      const d = audio.duration;
      if (isFinite(d) && !isNaN(d)) setDuration(d || 0);
    };

    const onTime = () => setCurrent(audio.currentTime || 0);

    const onEnd = () => {
      setIsPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, [audioUrl]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        console.log("Audio play blocked:", e);
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: self ? "#d1ffd8" : "#eee",
        width: 260,
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        onClick={toggle}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
          background: self ? "#25D366" : "#555",
          color: "white",
        }}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 2,
            height: 26,
          }}
        >
          {bars.map((h, i) => {
            const barPos = (i / bars.length) * 100;
            const active = barPos <= progress;

            return (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  borderRadius: 4,
                  opacity: active ? 1 : 0.35,
                  background: active ? (self ? "#25D366" : "#333") : "#999",
                  transition: "opacity 0.15s ease",
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            fontSize: 11,
            marginTop: 4,
            color: "#666",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{format(safeCurrent)}</span>
          <span>{format(safeDuration)}</span>
        </div>
      </div>
    </div>
  );
}
