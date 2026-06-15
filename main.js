"use strict";

const SYMBOLS = {
  TSLA: { base: 389.00, vol: 4.2 },
  NVDA: { base: 127.80, vol: 2.1 },
  AMZN: { base: 224.15, vol: 1.8 },
  AAPL: { base: 196.40, vol: 1.4 },
  BTC:  { base: 67420,  vol: 800 },
  MSTR: { base: 1648,   vol: 28  },
};

const liveState = {};
Object.entries(SYMBOLS).forEach(([sym, meta]) => {
  liveState[sym] = {
    price: meta.base,
    prevClose: meta.base * (1 + (Math.random() - 0.5) * 0.02),
    changeAbs: 0,
    changePct: 0,
  };
  const s = liveState[sym];
  s.changeAbs = s.price - s.prevClose;
  s.changePct = (s.changeAbs / s.prevClose) * 100;
});

function fmtPrice(sym, price) {
  return sym === "BTC" ? price.toLocaleString("sv-SE", { maximumFractionDigits: 0 }) : price.toFixed(2);
}

function fmtPct(pct) {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function buildTickerHTML() {
  return Object.entries(SYMBOLS).map(([sym]) => {
    const s = liveState[sym];
    return `
      <div class="tick" data-ticker="${sym}">
        <span class="tick-sym">${sym}</span>
        <span class="tick-price">${fmtPrice(sym, s.price)}</span>
        <span class="tick-chg ${s.changePct >= 0 ? 'up' : 'dn'}">${fmtPct(s.changePct)}</span>
      </div>`;
  }).join("");
}

function initTickerBar() {
  const track = document.getElementById("ticker-track");
  if (!track) return;
  const html = buildTickerHTML();
  track.innerHTML = html + html;
}

function updateTickerBar() {
  document.querySelectorAll(".tick").forEach(tick => {
    const sym = tick.dataset.ticker;
    if (!sym || !liveState[sym]) return;
    const s = liveState[sym];
    tick.querySelector(".tick-price").textContent = fmtPrice(sym, s.price);
    const chgEl = tick.querySelector(".tick-chg");
    chgEl.textContent = fmtPct(s.changePct);
    chgEl.className = `tick-chg ${s.changePct >= 0 ? 'up' : 'dn'}`;
  });
}

function startGlobalPriceTick() {
  setInterval(() => {
    Object.entries(SYMBOLS).forEach(([sym, meta]) => {
      const s = liveState[sym];
      const delta = (Math.random() - 0.49) * meta.vol * 0.18;
      s.price = Math.max(s.price + delta, s.prevClose * 0.85);
      s.changeAbs = s.price - s.prevClose;
      s.changePct = (s.changeAbs / s.prevClose) * 100;
    });
    updateTickerBar();
  }, 4000);
}

function initScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

function initNavScroll() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  window.addEventListener("scroll", () => {
    nav.style.background = window.scrollY > 60 ? "rgba(7,7,13,0.97)" : "rgba(7,7,13,0.80)";
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  initTickerBar();
  startGlobalPriceTick();
  initScrollReveal();
  initNavScroll();
});