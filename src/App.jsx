import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Thermometer, Droplets, CloudRain, Wind, Sprout, MessageSquare, Play, Pause,
  SkipForward, CheckCircle2, AlertTriangle, Fan, CloudDrizzle, Sun, Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const C = {
  bg: "#F4F5EE",
  panel: "#FFFFFF",
  panelBorder: "#E3E6D9",
  forest: "#2C5F2D",
  forestDark: "#17301A",
  moss: "#7FA65C",
  mossSoft: "#DCE7CE",
  amber: "#E8A33D",
  ink: "#1F2A1F",
  muted: "#6B7566",
  warn: "#C1666B",
  warnSoft: "#F4DEDF",
};

const FONT_HEAD = "'Fraunces', Georgia, 'Cambria', serif";
const FONT_MONO = "'Space Mono', 'JetBrains Mono', ui-monospace, monospace";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ---------------------------------------------------------------------------
// Crop profile data — growth-stage aware ideal ranges
// ---------------------------------------------------------------------------
const STAGES = ["Seedling", "Vegetative", "Flowering", "Fruiting"];

const CROPS = {
  Tomato: {
    Seedling: { temp: [20, 26], hum: [60, 80], moist: [55, 70] },
    Vegetative: { temp: [21, 27], hum: [55, 75], moist: [50, 65] },
    Flowering: { temp: [20, 25], hum: [50, 70], moist: [45, 60] },
    Fruiting: { temp: [22, 28], hum: [45, 65], moist: [50, 65] },
  },
  Spinach: {
    Seedling: { temp: [15, 20], hum: [65, 85], moist: [60, 75] },
    Vegetative: { temp: [16, 21], hum: [60, 80], moist: [55, 70] },
    Flowering: { temp: [16, 20], hum: [55, 75], moist: [50, 65] },
    Fruiting: { temp: [16, 21], hum: [55, 75], moist: [50, 65] },
  },
  Chili: {
    Seedling: { temp: [22, 28], hum: [55, 75], moist: [50, 65] },
    Vegetative: { temp: [23, 29], hum: [50, 70], moist: [45, 60] },
    Flowering: { temp: [22, 27], hum: [45, 65], moist: [40, 55] },
    Fruiting: { temp: [24, 30], hum: [40, 60], moist: [45, 60] },
  },
};

const TANK_CAPACITY = 500; // litres

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;
const fmtClock = (h) => `${String(h).padStart(2, "0")}:00`;

let logId = 1;

// ---------------------------------------------------------------------------
// Instrument strip — horizontal gauge with an ideal band + current marker
// ---------------------------------------------------------------------------
function InstrumentStrip({ icon: Icon, label, value, unit, scaleMin, scaleMax, band, accent }) {
  const pct = clamp(((value - scaleMin) / (scaleMax - scaleMin)) * 100, 0, 100);
  const bandStartPct = clamp(((band[0] - scaleMin) / (scaleMax - scaleMin)) * 100, 0, 100);
  const bandEndPct = clamp(((band[1] - scaleMin) / (scaleMax - scaleMin)) * 100, 0, 100);
  const inRange = value >= band[0] && value <= band[1];

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={15} color={accent} strokeWidth={2.3} />
          <span style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.muted, fontWeight: 600, letterSpacing: 0.2 }}>
            {label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 700, color: inRange ? C.ink : C.warn }}>
            {round1(value)}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>{unit}</span>
          {!inRange && (
            <span
              style={{
                fontFamily: FONT_BODY, fontSize: 9.5, fontWeight: 700, color: C.warn,
                background: C.warnSoft, borderRadius: 4, padding: "1px 5px", marginLeft: 2,
              }}
            >
              OUT OF RANGE
            </span>
          )}
        </div>
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: 6, background: "#EDEFE5", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute", left: `${bandStartPct}%`, width: `${bandEndPct - bandStartPct}%`,
            top: 0, bottom: 0, background: C.mossSoft, borderRadius: 6,
          }}
        />
        <div
          style={{
            position: "absolute", left: `calc(${pct}% - 3px)`, top: -2, width: 6, height: 14,
            borderRadius: 3, background: inRange ? C.forest : C.warn,
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.5s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "#9AA491" }}>{scaleMin}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "#9AA491" }}>
          ideal {band[0]}–{band[1]}
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: "#9AA491" }}>{scaleMax}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel wrapper
// ---------------------------------------------------------------------------
function Panel({ title, icon: Icon, children, style }) {
  return (
    <div
      style={{
        background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 14,
        padding: 18, boxShadow: "0 1px 3px rgba(23,48,26,0.06)", ...style,
      }}
    >
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          {Icon && <Icon size={16} color={C.forest} strokeWidth={2.3} />}
          <h3 style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.ink, margin: 0, letterSpacing: 0.2 }}>
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SmartPolyhouse() {
  const [showInstructions, setShowInstructions] = useState(true);
  const [crop, setCrop] = useState("Tomato");
  const [stage, setStage] = useState("Vegetative");

  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(6);
  const [temp, setTemp] = useState(24);
  const [hum, setHum] = useState(65);
  const [moist, setMoist] = useState(58);

  const [isRaining, setIsRaining] = useState(false);
  const [rainTicksLeft, setRainTicksLeft] = useState(0);
  const [ventOpen, setVentOpen] = useState(false);

  const [tankLevel, setTankLevel] = useState(180);
  const [todayRainUsed, setTodayRainUsed] = useState(0);
  const [todayExtUsed, setTodayExtUsed] = useState(0);

  const [trend, setTrend] = useState([{ t: "06:00", temp: 24, hum: 65, moist: 58 }]);
  const [log, setLog] = useState([
    { id: 0, day: 1, hour: 6, type: "info", text: "System initialized. Monitoring begins." },
  ]);

  const [playing, setPlaying] = useState(false);
  const band = CROPS[crop][stage];

  const addLog = useCallback((type, text) => {
    setLog((prev) => [{ id: logId++, day, hour, type, text }, ...prev].slice(0, 40));
  }, [day, hour]);

  const tick = useCallback(() => {
    setHour((prevHour) => {
      let nextHour = prevHour + 1;
      let nextDay = day;
      if (nextHour > 23) {
        nextHour = 0;
        nextDay = day + 1;
        setDay(nextDay);
        setTodayRainUsed(0);
        setTodayExtUsed(0);
      }

      // --- environmental drift ---
      const diurnal = Math.sin(((nextHour - 6) / 24) * Math.PI * 2) * 7;
      let newTemp = 24 + diurnal + (Math.random() * 2 - 1);
      let newHum = 68 - diurnal * 1.4 + (Math.random() * 3 - 1.5);
      let newMoist = moist - (0.9 + Math.max(0, diurnal) * 0.12) + (Math.random() * 0.4 - 0.2);

      // --- rain state machine ---
      let raining = isRaining;
      let ticksLeft = rainTicksLeft;
      let currentTank = tankLevel;
      if (!raining && Math.random() < 0.07) {
        raining = true;
        ticksLeft = 2 + Math.floor(Math.random() * 3);
        addLog("rain", "Rain detected — vents closing automatically to keep moisture out.");
      }
      if (raining) {
        newHum = clamp(newHum + 10, 0, 96);
        newTemp -= 1.5;
        const harvested = 18 + Math.random() * 14;
        currentTank = clamp(currentTank + harvested, 0, TANK_CAPACITY);
        ticksLeft -= 1;
        if (ticksLeft <= 0) {
          raining = false;
          addLog("rain", `Rain stopped. ${Math.round(harvested)} L captured this hour — tank now ${Math.round(currentTank)} L.`);
        }
      }
      setIsRaining(raining);
      setRainTicksLeft(ticksLeft);
      setTankLevel(currentTank);

      // --- ventilation decision ---
      let vOpen = false;
      if (raining) {
        vOpen = false;
      } else if (newTemp > band.temp[1]) {
        vOpen = true;
        newTemp -= 1.2;
        addLog("vent", `Temp ${round1(newTemp + 1.2)}°C above ideal max (${band.temp[1]}°C) — ventilation triggered.`);
      }
      setVentOpen(vOpen);

      // --- irrigation decision ---
      let extUsedDelta = 0;
      let rainUsedDelta = 0;
      if (newMoist < band.moist[0]) {
        if (raining) {
          addLog("water", "Skipping irrigation — active rainfall is already raising moisture.");
        } else {
          const needed = clamp((band.moist[0] + 8) - newMoist, 4, 25);
          if (currentTank >= needed) {
            currentTank -= needed;
            rainUsedDelta = needed;
            newMoist += needed * 0.9;
            addLog("water", `Watered using ${Math.round(needed)} L harvested rainwater — moisture was below the ${band.moist[0]}% target for ${stage.toLowerCase()} stage.`);
          } else {
            const fromTank = currentTank;
            const fromExternal = needed - fromTank;
            currentTank = 0;
            rainUsedDelta = fromTank;
            extUsedDelta = fromExternal;
            newMoist += needed * 0.9;
            addLog("water", `Tank low — used ${Math.round(fromTank)} L rainwater + ${Math.round(fromExternal)} L external supply.`);
          }
          setTankLevel(currentTank);
        }
      }
      if (rainUsedDelta > 0) setTodayRainUsed((v) => round1(v + rainUsedDelta));
      if (extUsedDelta > 0) setTodayExtUsed((v) => round1(v + extUsedDelta));

      newTemp = clamp(newTemp, 8, 42);
      newHum = clamp(newHum, 15, 96);
      newMoist = clamp(newMoist, 10, 90);

      if (nextHour % 6 === 0 && newMoist >= band.moist[0] && newTemp <= band.temp[1]) {
        addLog("info", "Routine check — all parameters within target range.");
      }

      setTemp(newTemp);
      setHum(newHum);
      setMoist(newMoist);

      setTrend((prev) => [...prev, { t: fmtClock(nextHour), temp: round1(newTemp), hum: round1(newHum), moist: round1(newMoist) }].slice(-24));

      return nextHour;
    });
  }, [day, moist, isRaining, rainTicksLeft, tankLevel, band, stage, addLog]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(tick, 1400);
    return () => clearInterval(id);
  }, [playing, tick]);

  const triggerRain = () => {
    if (isRaining) return;
    setIsRaining(true);
    setRainTicksLeft(3);
    addLog("rain", "Rain event triggered manually — vents closing, roof catchment active.");
  };

  const tankPct = Math.round((tankLevel / TANK_CAPACITY) * 100);
  const dailyBudget = Math.round((band.moist[0] + 8) * 1.3);
  const usedToday = round1(todayRainUsed + todayExtUsed);
  const budgetPct = clamp((usedToday / dailyBudget) * 100, 0, 100);
  const rainSharePct = usedToday > 0 ? Math.round((todayRainUsed / usedToday) * 100) : 0;

  const logIcon = (type) => {
    if (type === "water") return <Droplets size={13} color={C.forest} />;
    if (type === "vent") return <Fan size={13} color={C.amber} />;
    if (type === "rain") return <CloudDrizzle size={13} color="#5B7FA6" />;
    return <CheckCircle2 size={13} color={C.muted} />;
  };

  return (
    <div style={{ background: C.bg, minHeight: "100%", padding: "24px", fontFamily: FONT_BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        select { appearance: none; -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #C9D2BC; border-radius: 3px; }
        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(91,127,166,0.45); }
          100% { box-shadow: 0 0 0 10px rgba(91,127,166,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.forest, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sprout size={18} color="#fff" />
            </div>
            <h1 style={{ fontFamily: FONT_HEAD, fontSize: 22, fontWeight: 700, color: C.forestDark, margin: 0 }}>
              Smart Polyhouse — Live Prototype
            </h1>
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.muted, margin: "4px 0 0 44px" }}>
            Predict. Optimize. Explain. — simulated environment, real decision engine.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              fontFamily: FONT_MONO, fontSize: 13, background: C.forestDark, color: "#fff",
              borderRadius: 8, padding: "8px 14px", display: "flex", gap: 10, alignItems: "center",
            }}
          >
            <span>DAY {day}</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span>{fmtClock(hour)}</span>
          </div>
          <button
            onClick={() => setPlaying((p) => !p)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: playing ? C.warn : C.forest,
              color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontFamily: FONT_BODY,
              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Auto-run"}
          </button>
          <button
            onClick={tick}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "#fff", color: C.ink,
              border: `1px solid ${C.panelBorder}`, borderRadius: 8, padding: "9px 14px",
              fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            <SkipForward size={14} />
            +1 Hour
          </button>
          <button
            onClick={triggerRain}
            disabled={isRaining}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: isRaining ? "#EDEFE5" : "#5B7FA6",
              color: isRaining ? C.muted : "#fff", border: "none", borderRadius: 8, padding: "9px 14px",
              fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, cursor: isRaining ? "default" : "pointer",
            }}
          >
            <CloudRain size={14} />
            {isRaining ? "Raining…" : "Trigger Rain"}
          </button>
        </div>
      </div>

      {/* Instruction bar — how a farmer should use this dashboard */}
      <div
        style={{
          background: C.mossSoft, border: `1px solid ${C.moss}`, borderRadius: 12,
          padding: showInstructions ? "16px 18px" : "10px 18px", marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Info size={16} color={C.forestDark} strokeWidth={2.3} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.forestDark }}>
              How to use this dashboard
            </span>
          </div>
          <button
            onClick={() => setShowInstructions((v) => !v)}
            style={{
              background: "none", border: "none", cursor: "pointer", fontFamily: FONT_BODY,
              fontSize: 11.5, fontWeight: 700, color: C.forestDark, textDecoration: "underline",
            }}
          >
            {showInstructions ? "Hide" : "Show instructions"}
          </button>
        </div>

        {showInstructions && (
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 14, marginTop: 14,
            }}
          >
            {[
              {
                step: "1",
                title: "Set your crop",
                text: "Pick your crop and its growth stage in the Crop Profile box. This tells the system what \u201chealthy\u201d looks like right now.",
              },
              {
                step: "2",
                title: "Read the three bars",
                text: "The shaded green section on each bar is the safe zone. If the marker turns red and says \u201cOUT OF RANGE\u201d, that condition needs attention.",
              },
              {
                step: "3",
                title: "Move time forward",
                text: "Press \u201c+1 Hour\u201d to step ahead, or \u201cAuto-run\u201d to let it play on its own. The system checks conditions and acts by itself \u2014 you don\u2019t need to do anything.",
              },
              {
                step: "4",
                title: "Understand the recommendation",
                text: "Every action the system takes is explained in plain language at the bottom, under \u201cDecision Log.\u201d It tells you what happened and why \u2014 no numbers to interpret yourself.",
              },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 22, height: 22, borderRadius: 11, background: C.forest, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, marginTop: 1,
                  }}
                >
                  {item.step}
                </div>
                <div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: C.ink, marginBottom: 2 }}>
                    {item.title}
                  </div>
                  <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.muted, lineHeight: 1.45 }}>
                    {item.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Crop profile */}
        <Panel title="Crop Profile" icon={Sprout}>
          <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.muted, fontWeight: 600 }}>Crop</label>
          <select
            value={crop}
            onChange={(e) => { setCrop(e.target.value); addLog("info", `Crop profile switched to ${e.target.value}.`); }}
            style={{
              width: "100%", marginTop: 4, marginBottom: 12, padding: "9px 10px", borderRadius: 8,
              border: `1px solid ${C.panelBorder}`, fontFamily: FONT_BODY, fontSize: 13, color: C.ink, background: "#FBFCF8",
            }}
          >
            {Object.keys(CROPS).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.muted, fontWeight: 600 }}>Growth Stage</label>
          <select
            value={stage}
            onChange={(e) => { setStage(e.target.value); addLog("info", `Growth stage set to ${e.target.value} — ideal ranges updated.`); }}
            style={{
              width: "100%", marginTop: 4, marginBottom: 14, padding: "9px 10px", borderRadius: 8,
              border: `1px solid ${C.panelBorder}`, fontFamily: FONT_BODY, fontSize: 13, color: C.ink, background: "#FBFCF8",
            }}
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <div style={{ background: "#FBFCF8", border: `1px solid ${C.panelBorder}`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 8, letterSpacing: 0.3 }}>
              TARGET RANGE — {stage.toUpperCase()}
            </div>
            {[["Temp", band.temp, "°C"], ["Humidity", band.hum, "%"], ["Moisture", band.moist, "%"]].map(([lbl, r, u]) => (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 12, color: C.ink, marginBottom: 4 }}>
                <span style={{ fontFamily: FONT_BODY, color: C.muted }}>{lbl}</span>
                <span>{r[0]}–{r[1]}{u}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Live gauges */}
        <Panel title="Live Environment" icon={Thermometer}>
          <InstrumentStrip icon={Thermometer} label="Temperature" value={temp} unit="°C" scaleMin={10} scaleMax={40} band={band.temp} accent={C.forest} />
          <InstrumentStrip icon={Droplets} label="Humidity" value={hum} unit="%" scaleMin={20} scaleMax={95} band={band.hum} accent={C.forest} />
          <InstrumentStrip icon={Sprout} label="Soil Moisture" value={moist} unit="%" scaleMin={15} scaleMax={85} band={band.moist} accent={C.forest} />
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Fan size={13} color={ventOpen ? C.amber : "#B7C0AC"} />
              <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: ventOpen ? C.amber : C.muted, fontWeight: 700 }}>
                Vents {ventOpen ? "OPEN" : "closed"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {isRaining ? <CloudDrizzle size={13} color="#5B7FA6" /> : <Sun size={13} color="#B7C0AC" />}
              <span style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: isRaining ? "#5B7FA6" : C.muted, fontWeight: 700 }}>
                {isRaining ? "Raining" : "Clear sky"}
              </span>
            </div>
          </div>
        </Panel>

        {/* Rain tank */}
        <Panel title="Harvested Rainwater" icon={Droplets}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                width: 54, height: 130, borderRadius: 10, border: `2px solid ${C.panelBorder}`,
                position: "relative", overflow: "hidden", background: "#FBFCF8", flexShrink: 0,
                animation: isRaining ? "pulseRing 1.4s infinite" : "none",
              }}
            >
              <div
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: `${tankPct}%`,
                  background: `linear-gradient(180deg, ${C.moss}, ${C.forest})`, transition: "height 0.6s ease",
                }}
              />
            </div>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: C.forestDark }}>{Math.round(tankLevel)} L</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.muted }}>of {TANK_CAPACITY} L capacity ({tankPct}%)</div>
            </div>
          </div>

          <div style={{ marginTop: 16, borderTop: `1px solid ${C.panelBorder}`, paddingTop: 12 }}>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 6 }}>
              TODAY'S IRRIGATION SOURCE
            </div>
            <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "#EDEFE5" }}>
              <div style={{ width: `${rainSharePct}%`, background: C.forest }} />
              <div style={{ width: `${100 - rainSharePct}%`, background: C.amber }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted }}>
              <span>Rainwater {rainSharePct}%</span>
              <span>External {100 - rainSharePct}%</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="24-Hour Trend">
          <div style={{ width: "100%", height: 190 }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEFE5" />
                <XAxis dataKey="t" tick={{ fontFamily: FONT_MONO, fontSize: 9.5, fill: C.muted }} interval={3} />
                <YAxis tick={{ fontFamily: FONT_MONO, fontSize: 9.5, fill: C.muted }} />
                <Tooltip
                  contentStyle={{ fontFamily: FONT_BODY, fontSize: 11.5, borderRadius: 8, border: `1px solid ${C.panelBorder}` }}
                />
                <Line type="monotone" dataKey="temp" stroke={C.forest} strokeWidth={2} dot={false} name="Temp °C" />
                <Line type="monotone" dataKey="hum" stroke="#5B7FA6" strokeWidth={2} dot={false} name="Humidity %" />
                <Line type="monotone" dataKey="moist" stroke={C.amber} strokeWidth={2} dot={false} name="Moisture %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 6, justifyContent: "center" }}>
            {[["Temp", C.forest], ["Humidity", "#5B7FA6"], ["Moisture", C.amber]].map(([lbl, col]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: col }} />
                <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.muted }}>{lbl}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Today's Water Budget">
          <div style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 700, color: C.forestDark }}>
            {usedToday}<span style={{ fontSize: 14, color: C.muted }}> / {dailyBudget} L</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: "#EDEFE5", marginTop: 10, overflow: "hidden" }}>
            <div style={{ width: `${budgetPct}%`, height: "100%", background: budgetPct > 95 ? C.warn : C.forest, transition: "width 0.5s ease" }} />
          </div>
          <p style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
            Budget is allocated across the full {stage.toLowerCase()}-stage window using harvested rainwater first, external supply only when the tank runs short.
          </p>
        </Panel>
      </div>

      {/* Row 3 — decision log */}
      <Panel title="Decision Log — Plain-Language Updates" icon={MessageSquare}>
        <div style={{ maxHeight: 230, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {log.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px",
                background: "#FBFCF8", borderRadius: 8, borderLeft: `3px solid ${
                  entry.type === "water" ? C.forest : entry.type === "vent" ? C.amber : entry.type === "rain" ? "#5B7FA6" : "#C9D2BC"
                }`,
              }}
            >
              <div style={{ marginTop: 2 }}>{logIcon(entry.type)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>{entry.text}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                  Day {entry.day} · {fmtClock(entry.hour)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
