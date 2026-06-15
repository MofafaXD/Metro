/* ═══════════════════════════════════════════════════════════
   Metro Finans — main.js
   Handles:
     1. Simulated live market data (ticker bar + price updates)
     2. LightweightCharts candlestick / area chart
     3. Symbol tabs + timeframe switching
     4. Scroll-reveal animations
     5. Nav background on scroll
   ═══════════════════════════════════════════════════════════ */

"use strict";

/* ─── 1. MARKET DATA ─────────────────────────────────────── */

/**
 * Base prices and metadata per symbol.
 * In a real project you'd fetch from a market API (e.g. Yahoo Finance,
 * Alpha Vantage, Polygon.io). Here we simulate realistic movement.
 */
const SYMBOLS = {
  TSLA: { name: "Tesla Inc.",        exchange: "Nasdaq", base: 389.00,  vol: 4.2,  crypto: false },
  NVDA: { name: "Nvidia Corp.",      exchange: "Nasdaq", base: 127.80,  vol: 2.1,  crypto: false },
  AMZN: { name: "Amazon.com Inc.",   exchange: "Nasdaq", base: 224.15,  vol: 1.8,  crypto: false },
  AAPL: { name: "Apple Inc.",        exchange: "Nasdaq", base: 196.40,  vol: 1.4,  crypto: false },
  BTC:  { name: "Bitcoin",           exchange: "Crypto", base: 67420,   vol: 800,  crypto: true  },
  MSTR: { name: "MicroStrategy Inc.",exchange: "Nasdaq", base: 1648,    vol: 28,   crypto: false },
};

/* Live "current" state — updated every few seconds */
const liveState = {};

Object.entries(SYMBOLS).forEach(([sym, meta]) => {
  liveState[sym] = {
    price:       meta.base,
    prevClose:   meta.base * (1 + (Math.random() - 0.5) * 0.02),
    changeAbs:   0,
    changePct:   0,
  };
  // compute initial change
  const s = liveState[sym];
  s.changeAbs = s.price - s.prevClose;
  s.changePct = (s.changeAbs / s.prevClose) * 100;
});

/**
 * Generate simulated OHLC candles going back N bars.
 * @param {string} sym   – symbol key
 * @param {number} bars  – number of candles
 * @param {number} intervalMs – milliseconds per candle (for time stamps)
 */
function generateCandles(sym, bars, intervalMs) {
  const meta = SYMBOLS[sym];
  const candles = [];
  let price = meta.base * (0.88 + Math.random() * 0.06); // start a bit below current
  const now = Math.floor(Date.now() / 1000);

  for (let i = bars; i >= 0; i--) {
    const time = now - i * Math.floor(intervalMs / 1000);
    const range = meta.vol * (0.5 + Math.random());
    const open  = price;
    const close = price + (Math.random() - 0.48) * meta.vol;
    const high  = Math.max(open, close) + Math.random() * range * 0.4;
    const low   = Math.min(open, close) - Math.random() * range * 0.4;

    candles.push({ time, open, high, low, close });
    price = close;
  }

  // Ensure last candle matches live state
  if (candles.length > 0) {
    candles[candles.length - 1].close = liveState[sym].price;
  }

  return candles;
}

/**
 * Timeframe → { bars, intervalMs, label }
 */
const TF_CONFIG = {
  "1D": { bars: 78,  intervalMs:  5 * 60 * 1000,   label: "5m"  },
  "1W": { bars: 120, intervalMs: 30 * 60 * 1000,   label: "30m" },
  "1M": { bars: 120, intervalMs:  4 * 60 * 60 * 1000, label: "4h" },
  "3M": { bars: 90,  intervalMs: 24 * 60 * 60 * 1000, label: "D"  },
};

/* ─── 2. TICKER BAR ──────────────────────────────────────── */

function fmtPrice(sym, price) {
  if (SYMBOLS[sym].crypto) {
    return price >= 10000
      ? price.toLocaleString("sv-SE", { maximumFractionDigits: 0 })
      : price.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
  }
  return price.toFixed(2);
}

function fmtPct(pct) {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function buildTickerHTML() {
  return Object.entries(SYMBOLS).map(([sym]) => {
    const s = liveState[sym];
    const cls = s.changePct >= 0 ? "up" : "dn";
    return `
      <div class="tick" data-ticker="${sym}">
        <span class="tick-sym">${sym}</span>
        <span class="tick-price">${fmtPrice(sym, s.price)}</span>
        <span class="tick-chg ${cls}">${fmtPct(s.changePct)}</span>
      </div>`;
  }).join("") ;
}

function initTickerBar() {
  const track = document.getElementById("ticker-track");
  if (!track) return;

  // Double it so the seamless loop works
  const html = buildTickerHTML();
  track.innerHTML = html + html;
}

function updateTickerBar() {
  const ticks = document.querySelectorAll(".tick");
  ticks.forEach(tick => {
    const sym = tick.dataset.ticker;
    if (!sym || !liveState[sym]) return;
    const s = liveState[sym];
    const cls = s.changePct >= 0 ? "up" : "dn";
    tick.querySelector(".tick-price").textContent = fmtPrice(sym, s.price);
    const chgEl = tick.querySelector(".tick-chg");
    chgEl.textContent = fmtPct(s.changePct);
    chgEl.className = `tick-chg ${cls}`;
  });
}

/* ─── 3. LIGHTWEIGHT CHARTS SETUP ───────────────────────── */

let lwChart       = null;
let lwSeries      = null;
let activeSym     = "TSLA";
let activeTf      = "1W";
let liveCandles   = [];
let liveInterval  = null;

function formatChartPrice(sym, price) {
  if (SYMBOLS[sym].crypto && price >= 1000) {
    return "$" + price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return "$" + price.toFixed(2);
}

function initChart() {
  const container = document.getElementById("lw-chart");
  if (!container || typeof LightweightCharts === "undefined") return;

  lwChart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: 340,
    layout: {
      background:  { type: "solid", color: "#0d0d17" },
      textColor:   "#7a7888",
      fontFamily:  "'DM Mono', monospace",
      fontSize:    11,
    },
    grid: {
      vertLines:   { color: "rgba(255,255,255,0.04)" },
      horzLines:   { color: "rgba(255,255,255,0.04)" },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: "rgba(212,175,55,0.4)", labelBackgroundColor: "#1a1a2a" },
      horzLine: { color: "rgba(212,175,55,0.4)", labelBackgroundColor: "#1a1a2a" },
    },
    rightPriceScale: {
      borderColor: "rgba(255,255,255,0.06)",
    },
    timeScale: {
      borderColor: "rgba(255,255,255,0.06)",
      timeVisible: true,
      secondsVisible: false,
    },
    handleScroll:  { mouseWheel: false },
    handleScale:   { mouseWheel: false },
  });

  // Candlestick series
  lwSeries = lwChart.addCandlestickSeries({
    upColor:          "#22c55e",
    downColor:        "#ef4444",
    borderUpColor:    "#22c55e",
    borderDownColor:  "#ef4444",
    wickUpColor:      "#22c55e",
    wickDownColor:    "#ef4444",
  });

  // Responsive resize
  const ro = new ResizeObserver(() => {
    if (lwChart) {
      lwChart.applyOptions({ width: container.clientWidth });
    }
  });
  ro.observe(container);

  loadChartData(activeSym, activeTf);
}

function loadChartData(sym, tf) {
  if (!lwChart || !lwSeries) return;

  const cfg = TF_CONFIG[tf];
  const candles = generateCandles(sym, cfg.bars, cfg.intervalMs);
  liveCandles = candles;

  lwSeries.setData(candles);
  lwChart.timeScale().fitContent();

  updateChartMeta(sym);

  // Restart live-update interval
  clearInterval(liveInterval);
  if (tf === "1D" || tf === "1W") {
    liveInterval = setInterval(() => tickLiveCandle(sym), 3000);
  }
}

function tickLiveCandle(sym) {
  if (!lwSeries || !liveCandles.length) return;

  const meta  = SYMBOLS[sym];
  const last  = liveCandles[liveCandles.length - 1];
  const delta = (Math.random() - 0.49) * meta.vol * 0.25;

  const newClose = Math.max(last.close + delta, last.close * 0.98);
  const updCandle = {
    time:  last.time,
    open:  last.open,
    high:  Math.max(last.high, newClose),
    low:   Math.min(last.low,  newClose),
    close: newClose,
  };

  liveCandles[liveCandles.length - 1] = updCandle;
  lwSeries.update(updCandle);

  // Update global live state
  liveState[sym].price     = newClose;
  liveState[sym].changeAbs = newClose - liveState[sym].prevClose;
  liveState[sym].changePct = (liveState[sym].changeAbs / liveState[sym].prevClose) * 100;

  updateChartMeta(sym);
  updateTickerBar();
}

function updateChartMeta(sym) {
  const s = liveState[sym];
  const meta = SYMBOLS[sym];

  const priceEl = document.getElementById("chart-price");
  const badgeEl = document.getElementById("chart-badge");
  const symEl   = document.getElementById("chart-sym-label");

  if (priceEl) priceEl.textContent = formatChartPrice(sym, s.price);

  if (badgeEl) {
    const up  = s.changePct >= 0;
    const txt = `${up ? "▲" : "▼"} ${fmtPct(s.changePct)}  (${up ? "+" : ""}${s.changeAbs.toFixed(meta.crypto && s.price > 1000 ? 0 : 2)})`;
    badgeEl.textContent = txt;
    badgeEl.className   = `chart-change-badge ${up ? "up" : "dn"}`;
  }

  if (symEl) symEl.textContent = `${sym} · ${meta.exchange}`;
}

/* ─── 4. SYMBOL TABS ─────────────────────────────────────── */

function initTabs() {
  const tabsEl = document.getElementById("chart-tabs");
  if (!tabsEl) return;

  tabsEl.addEventListener("click", e => {
    const btn = e.target.closest(".chart-tab");
    if (!btn) return;

    tabsEl.querySelectorAll(".chart-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    activeSym = btn.dataset.sym;
    clearInterval(liveInterval);
    loadChartData(activeSym, activeTf);
  });
}

/* ─── 5. TIMEFRAME BUTTONS ───────────────────────────────── */

function initTfButtons() {
  const tfGroup = document.getElementById("chart-tf");
  if (!tfGroup) return;

  tfGroup.addEventListener("click", e => {
    const btn = e.target.closest(".tf-btn");
    if (!btn) return;

    tfGroup.querySelectorAll(".tf-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    activeTf = btn.dataset.tf;
    clearInterval(liveInterval);
    loadChartData(activeSym, activeTf);
  });
}

/* ─── 6. GLOBAL PRICE TICK (ticker + live chart) ─────────── */

/**
 * Every 4s nudge all prices slightly so the ticker bar always feels live,
 * even for symbols not currently charted.
 */
function startGlobalPriceTick() {
  setInterval(() => {
    Object.entries(SYMBOLS).forEach(([sym, meta]) => {
      if (sym === activeSym) return; // handled by liveInterval
      const s = liveState[sym];
      const delta = (Math.random() - 0.49) * meta.vol * 0.18;
      s.price     = Math.max(s.price + delta, s.prevClose * 0.85);
      s.changeAbs = s.price - s.prevClose;
      s.changePct = (s.changeAbs / s.prevClose) * 100;
    });
    updateTickerBar();
  }, 4000);
}

/* ─── 7. SCROLL REVEAL ───────────────────────────────────── */

function initScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  const io = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  els.forEach(el => io.observe(el));
}

/* ─── 8. NAV SHADOW ON SCROLL ────────────────────────────── */

function initNavScroll() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 60) {
      nav.style.background = "rgba(7,7,13,0.97)";
    } else {
      nav.style.background = "rgba(7,7,13,0.80)";
    }
  }, { passive: true });
}

/* ─── 9. BOOTSTRAP ───────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  initTickerBar();
  initChart();
  initTabs();
  initTfButtons();
  startGlobalPriceTick();
  initScrollReveal();
  initNavScroll();
});
