import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import axios from "axios";

type Props = {
  onSendUrl: (audioUrlWithDur: string) => void; // ✅ url|DUR=xx
};

export default function VoiceHoldRecorder({ onSendUrl }: Props) {
  const [isHolding, setIsHolding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  // ✅ TIMER
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // ✅ slide to cancel + lock
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const cancelledRef = useRef(false);

  const [isLocked, setIsLocked] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const waveContainerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ✅ init wavesurfer
  useEffect(() => {
    if (!waveContainerRef.current) return;

    waveSurferRef.current = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: "#999",
      progressColor: "#25D366",
      cursorColor: "transparent",
      height: 40,
      barWidth: 2,
      barGap: 2,
      normalize: true,
    });

    return () => {
      waveSurferRef.current?.destroy();
      waveSurferRef.current = null;
    };
  }, []);

  // ✅ load preview
  useEffect(() => {
    if (audioUrl && waveSurferRef.current) {
      waveSurferRef.current.load(audioUrl);
    }
  }, [audioUrl]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
  };

  const cancelAll = () => {
    setAudioBlob(null);
    setAudioUrl("");
    setIsHolding(false);
    setIsRecording(false);
    setDragX(0);
    setDragY(0);
    setIsLocked(false);

    stopTimer();
    setSeconds(0);

    chunksRef.current = [];

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const start = async () => {
    try {
      cancelledRef.current = false;
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // ✅ FIX: choose supported mime
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      startTimer();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopTimer();
        setIsRecording(false);

        // cancelled → no preview
        if (cancelledRef.current) {
          cancelAll();
          return;
        }

        if (chunksRef.current.length === 0) {
          alert("❌ Voice record nahi hua! Mic/browser issue.");
          cancelAll();
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
    } catch (err) {
      console.log(err);
      alert("Microphone permission required!");
      cancelAll();
    }
  };

  const stop = () => {
    stopTimer();
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  // ✅ Upload + Send (FIXED DURATION)
  const uploadAndSend = async () => {
    if (!audioBlob) return;

    try {
      setUploading(true);

      const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";

      const formData = new FormData();
      formData.append("file", audioBlob, `voice-${Date.now()}.${ext}`);

      const res = await axios.post("http://https://mahi-0iap.onrender.com:5000/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const finalUrl = res.data?.file?.url;
      if (!finalUrl) {
        alert("Upload ok but URL missing ❌");
        return;
      }

      // ✅ ✅ FIX: use TIMER duration (100% correct)
      const dur = seconds;

      // ✅ send: url|DUR=12
      onSendUrl(`${finalUrl}|DUR=${dur}`);

      cancelAll();
    } catch (err) {
      console.log(err);
      alert("Voice upload failed ❌");
    } finally {
      setUploading(false);
    }
  };

  // ✅ HOLD START
  const handleHoldStart = (x: number, y: number) => {
    if (audioUrl) return;
    setIsHolding(true);
    setIsLocked(false);
    setDragX(0);
    setDragY(0);
    startXRef.current = x;
    startYRef.current = y;
    start();
  };

  // ✅ HOLD MOVE (slide cancel / lock)
  const handleHoldMove = (x: number, y: number) => {
    if (!isRecording) return;

    const dx = x - startXRef.current;
    const dy = y - startYRef.current;

    setDragX(dx);
    setDragY(dy);

    // lock
    if (!isLocked && dy < -80) {
      setIsLocked(true);
      setIsHolding(false);
      setDragX(0);
      setDragY(0);
      return;
    }

    // cancel
    if (!isLocked && dx < -120) {
      cancelledRef.current = true;
      stop();
    }
  };

  // ✅ HOLD END
  const handleHoldEnd = () => {
    if (!isHolding) return;

    setIsHolding(false);
    setDragX(0);
    setDragY(0);

    if (isLocked) return;
    if (!cancelledRef.current) stop();
  };

  const stopLockedRecording = () => {
    if (!isLocked) return;
    stop();
    setIsLocked(false);
  };

  return (
    <div style={{ width: "100%", marginTop: 10 }}>
      {/* Preview */}
      {audioUrl ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div ref={waveContainerRef} style={{ flex: 1 }} />

          <span style={{ fontWeight: "bold", color: "#555", minWidth: 55 }}>
            {formatDuration(seconds)}
          </span>

          <button
            onClick={cancelAll}
            disabled={uploading}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              cursor: "pointer",
              background: "white",
            }}
          >
            ❌
          </button>

          <button
            onClick={uploadAndSend}
            disabled={uploading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: uploading ? "gray" : "#25D366",
              color: "white",
              fontWeight: "bold",
            }}
          >
            {uploading ? "Sending..." : "✅ Send"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onMouseDown={(e) => handleHoldStart(e.clientX, e.clientY)}
            onMouseMove={(e) => isHolding && handleHoldMove(e.clientX, e.clientY)}
            onMouseUp={handleHoldEnd}
            onMouseLeave={() => isHolding && handleHoldEnd()}
            onTouchStart={(e) =>
              handleHoldStart(e.touches[0].clientX, e.touches[0].clientY)
            }
            onTouchMove={(e) =>
              handleHoldMove(e.touches[0].clientX, e.touches[0].clientY)
            }
            onTouchEnd={handleHoldEnd}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: "pointer",
              background: isRecording ? "#ff4d4d" : "white",
              fontWeight: "bold",
              transform: `translate(${dragX}px, ${dragY}px)`,
              transition: "transform 0.05s linear",
            }}
          >
            {isRecording ? "🔴 Recording..." : "🎤 Hold"}
          </button>

          {/* Recording */}
          {isRecording && !isLocked && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: "gray", fontSize: 13 }}>
                ⬅ Slide to cancel | ⬆ Slide to lock
              </span>
              <span style={{ color: "red", fontWeight: "bold" }}>
                {formatDuration(seconds)}
              </span>
            </div>
          )}

          {/* Locked */}
          {isRecording && isLocked && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: "#25D366", fontWeight: "bold" }}>🔒 Locked</span>
              <span style={{ color: "red", fontWeight: "bold" }}>
                {formatDuration(seconds)}
              </span>

              <button
                onClick={stopLockedRecording}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: "#ff4d4d",
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                Stop
              </button>

              <button
                onClick={cancelAll}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  background: "white",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {!isRecording && <span style={{ fontSize: 13, color: "#666" }}>Hold & speak</span>}
        </div>
      )}
    </div>
  );
}
