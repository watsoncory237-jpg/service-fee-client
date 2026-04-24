/**
 * ServiceFeeApp.jsx - Fixed & Redesigned
 * Bold design, working emojis, proper API connection
 */

import React, { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const API_URL   = import.meta.env.VITE_API_URL || "http://localhost:3001";
const USER_ID   = "user_cory_watson";

const stripePromise = loadStripe(STRIPE_PK);

const PLATFORMS = [
  { name: "Netflix",      emoji: "\uD83C\uDFAC", fee: 0.07 },
  { name: "Spotify",      emoji: "\uD83C\uDFB5", fee: 0.05 },
  { name: "Adobe CC",     emoji: "\uD83C\uDFA8", fee: 0.10 },
  { name: "GitHub Pro",   emoji: "\uD83D\uDCBB", fee: 0.05 },
  { name: "Notion",       emoji: "\uD83D\uDCDD", fee: 0.03 },
  { name: "Slack",        emoji: "\uD83D\uDCAC", fee: 0.04 },
  { name: "Dropbox",      emoji: "\uD83D\uDCE6", fee: 0.03 },
  { name: "Zoom",         emoji: "\uD83D\uDCF9", fee: 0.05 },
  { name: "Figma",        emoji: "\u270F\uFE0F",  fee: 0.06 },
  { name: "ChatGPT Plus", emoji: "\uD83E\uDD16", fee: 0.08 },
  { name: "AWS",          emoji: "\u2601\uFE0F",  fee: 0.10 },
  { name: "Custom",       emoji: "\u2699\uFE0F",  fee: 0.02 },
];

function CheckoutForm({ amount, userId, onSuccess, onCancel }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error,  setError]  = useState(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(submitErr.message); setPaying(false); return; }
    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (confirmErr) {
      setError(confirmErr.message);
      setPaying(false);
    } else {
      await fetch(`${API_URL}/api/clear-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      onSuccess();
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalTitle}>Collect ${amount.toFixed(2)}</div>
        <div style={S.modalSub}>Platform maintenance fees</div>
        <PaymentElement />
        {error && <div style={S.error}>{error}</div>}
        <div style={S.modalBtns}>
          <button style={S.btnCancel} onClick={onCancel} disabled={paying}>Cancel</button>
          <button style={S.btnPay} onClick={handlePay} disabled={paying || !stripe}>
            {paying ? "Processing..." : `Pay $${amount.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ServiceFeeApp() {
  const [balance,      setBalance]      = useState(0);
  const [totalCharged, setTotalCharged] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [threshold,    setThreshold]    = useState(0.50);
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [paid,         setPaid]         = useState(false);
  const [activeTab,    setActiveTab]    = useState("platforms");

  const fetchBalance = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/balance/${USER_ID}`);
      const d = await r.json();
      setBalance(d.balance ?? 0);
      setTotalCharged(d.totalCharged ?? 0);
      setTransactions(d.transactions ?? []);
      setThreshold(d.threshold ?? 0.50);
    } catch (e) {
      showToast("Could not reach server", "error");
    }
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const applyFee = async (platform) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/add-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID, platform: platform.name, feeAmount: platform.fee }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error, "error"); return; }
      setBalance(d.balance);
      showToast(`$${platform.fee.toFixed(2)} added for ${platform.name}`);
      if (d.readyToCharge) showToast("Ready to collect!", "info");
      await fetchBalance();
    } catch { showToast("Server error", "error"); }
    finally { setLoading(false); }
  };

  const startCheckout = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/create-payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: USER_ID }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error, "error"); return; }
      setClientSecret(d.clientSecret);
    } catch { showToast("Server error", "error"); }
    finally { setLoading(false); }
  };

  const handleSuccess = () => {
    setClientSecret(null);
    setPaid(true);
    setBalance(0);
    setTransactions([]);
    showToast("Payment successful!");
    setTimeout(() => setPaid(false), 4000);
  };

  const pct = Math.min((balance / threshold) * 100, 100);

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; }
        .card-btn:hover { border-color: #c9a84c !important; transform: translateY(-2px); transition: all 0.2s; }
        .tab-btn:hover { color: #c9a84c !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          ...S.toast,
          background: toast.type === "error" ? "#8b0000" : toast.type === "info" ? "#1a4a7a" : "#0a5c2e"
        }}>
          {toast.msg}
        </div>
      )}

      {/* HERO HEADER */}
      <div style={S.hero}>
        <div style={S.heroInner}>
          <div>
            <div style={S.brandName}>SERVICEFEE</div>
            <div style={S.tagline}>
              They charge you whether you watch or not.<br />
              <span style={S.taglineAccent}>We don't.</span>
            </div>
          </div>
          <div style={S.balanceBox}>
            <div style={S.balanceLabel}>BALANCE</div>
            <div style={S.balanceNum}>${balance.toFixed(2)}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={S.progressWrap}>
          <div style={S.progressTrack}>
            <div style={{
              ...S.progressFill,
              width: `${pct}%`,
              background: pct >= 100
                ? "linear-gradient(90deg, #f1c40f, #f39c12)"
                : "linear-gradient(90deg, #c9a84c, #e8c97a)"
            }} />
          </div>
          <div style={S.progressLabels}>
            <span>${balance.toFixed(2)} accumulated</span>
            <span>Collect at ${threshold.toFixed(2)}</span>
          </div>
        </div>

        {balance >= threshold && (
          <button style={S.collectBtn} onClick={startCheckout} disabled={loading}>
            {loading ? "Loading..." : `COLLECT $${balance.toFixed(2)}`}
          </button>
        )}
      </div>

      {/* STATS */}
      <div style={S.statsRow}>
        <div style={S.statBox}>
          <div style={S.statNum}>${totalCharged.toFixed(2)}</div>
          <div style={S.statLabel}>TOTAL CHARGED</div>
        </div>
        <div style={S.statBox}>
          <div style={S.statNum}>{transactions.length}</div>
          <div style={S.statLabel}>PENDING FEES</div>
        </div>
        <div style={S.statBox}>
          <div style={S.statNum}>${Math.max(0, threshold - balance).toFixed(2)}</div>
          <div style={S.statLabel}>UNTIL COLLECT</div>
        </div>
      </div>

      {/* TABS */}
      <div style={S.tabRow}>
        {["platforms", "history"].map(t => (
          <button
            key={t}
            className="tab-btn"
            style={{
              ...S.tabBtn,
              color: activeTab === t ? "#c9a84c" : "#555",
              borderBottom: activeTab === t ? "2px solid #c9a84c" : "2px solid transparent",
            }}
            onClick={() => setActiveTab(t)}
          >
            {t === "platforms" ? "PLATFORMS" : `HISTORY (${transactions.length})`}
          </button>
        ))}
      </div>

      {/* PLATFORMS GRID */}
      {activeTab === "platforms" && (
        <div style={S.grid}>
          {PLATFORMS.map(p => (
            <button
              key={p.name}
              className="card-btn"
              style={S.card}
              onClick={() => applyFee(p)}
              disabled={loading}
            >
              <div style={S.cardEmoji}>{p.emoji}</div>
              <div style={S.cardName}>{p.name}</div>
              <div style={S.cardFee}>${p.fee.toFixed(2)}</div>
              <div style={S.cardFeeLabel}>per use</div>
            </button>
          ))}
        </div>
      )}

      {/* HISTORY */}
      {activeTab === "history" && (
        <div style={S.historyWrap}>
          {transactions.length === 0 ? (
            <div style={S.empty}>
              No fees yet. Tap a platform to get started.
            </div>
          ) : (
            transactions.map(t => (
              <div key={t.id} style={S.txRow}>
                <div>
                  <div style={S.txName}>{t.platform}</div>
                  <div style={S.txDate}>{new Date(t.created_at).toLocaleString()}</div>
                </div>
                <div style={S.txAmt}>+${parseFloat(t.amount).toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night" } }}>
          <CheckoutForm
            amount={balance}
            userId={USER_ID}
            onSuccess={handleSuccess}
            onCancel={() => setClientSecret(null)}
          />
        </Elements>
      )}

      {/* SUCCESS */}
      {paid && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, textAlign: "center" }}>
            <div style={{ fontSize: 64 }}>&#x1F389;</div>
            <div style={{ ...S.modalTitle, marginTop: 16 }}>Payment Complete!</div>
            <div style={S.modalSub}>Balance cleared. Ready for next round.</div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  app: {
    minHeight: "100vh",
    background: "#080808",
    color: "#f0e6c8",
    fontFamily: "'DM Sans', sans-serif",
    paddingBottom: 80,
  },
  hero: {
    background: "linear-gradient(180deg, #0f0f0f 0%, #080808 100%)",
    borderBottom: "1px solid #1a1a1a",
    padding: "32px 24px 24px",
  },
  heroInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    maxWidth: 720,
    margin: "0 auto 20px",
  },
  brandName: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 42,
    letterSpacing: 4,
    color: "#c9a84c",
    lineHeight: 1,
  },
  tagline: {
    fontSize: 13,
    color: "#888",
    marginTop: 8,
    lineHeight: 1.6,
    maxWidth: 280,
  },
  taglineAccent: {
    color: "#c9a84c",
    fontWeight: 700,
    fontSize: 15,
  },
  balanceBox: { textAlign: "right" },
  balanceLabel: {
    fontSize: 9,
    letterSpacing: 3,
    color: "#444",
    textTransform: "uppercase",
  },
  balanceNum: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 48,
    color: "#f0e6c8",
    lineHeight: 1,
    letterSpacing: 2,
  },
  progressWrap: { maxWidth: 720, margin: "0 auto" },
  progressTrack: {
    background: "#1a1a1a",
    borderRadius: 3,
    height: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.5s ease",
  },
  progressLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    color: "#444",
    marginTop: 6,
    letterSpacing: 1,
  },
  collectBtn: {
    display: "block",
    margin: "20px auto 0",
    background: "linear-gradient(135deg, #c9a84c, #e8c97a)",
    color: "#080808",
    border: "none",
    borderRadius: 4,
    padding: "14px 40px",
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 18,
    letterSpacing: 2,
    cursor: "pointer",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 1,
    maxWidth: 720,
    margin: "0 auto",
    background: "#111",
    borderBottom: "1px solid #1a1a1a",
  },
  statBox: {
    padding: "20px 16px",
    textAlign: "center",
    background: "#0c0c0c",
  },
  statNum: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    color: "#c9a84c",
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 9,
    color: "#444",
    letterSpacing: 2,
    marginTop: 4,
  },
  tabRow: {
    display: "flex",
    maxWidth: 720,
    margin: "0 auto",
    borderBottom: "1px solid #1a1a1a",
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    padding: "16px 24px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "color 0.2s",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 12,
    maxWidth: 720,
    margin: "20px auto",
    padding: "0 16px",
  },
  card: {
    background: "#0f0f0f",
    border: "1px solid #1e1e1e",
    borderRadius: 8,
    padding: "24px 12px",
    cursor: "pointer",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s",
  },
  cardEmoji: { fontSize: 32 },
  cardName: {
    fontSize: 11,
    fontWeight: 700,
    color: "#888",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cardFee: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    color: "#f0e6c8",
    letterSpacing: 1,
  },
  cardFeeLabel: {
    fontSize: 9,
    color: "#333",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  historyWrap: {
    maxWidth: 720,
    margin: "20px auto",
    padding: "0 16px",
  },
  txRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0f0f0f",
    border: "1px solid #1a1a1a",
    borderRadius: 6,
    padding: "16px",
    marginBottom: 8,
  },
  txName: { fontSize: 14, fontWeight: 600, color: "#c9a84c" },
  txDate: { fontSize: 11, color: "#444", marginTop: 4 },
  txAmt: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 22,
    color: "#f0e6c8",
    letterSpacing: 1,
  },
  empty: {
    textAlign: "center",
    color: "#333",
    padding: "60px 20px",
    fontSize: 14,
    letterSpacing: 1,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: "#0f0f0f",
    border: "1px solid #2a2a2a",
    borderRadius: 12,
    padding: 32,
    width: "100%",
    maxWidth: 480,
  },
  modalTitle: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 28,
    color: "#f0e6c8",
    letterSpacing: 2,
    marginBottom: 4,
  },
  modalSub: { fontSize: 13, color: "#555", marginBottom: 20 },
  modalBtns: { display: "flex", gap: 12, marginTop: 20 },
  btnCancel: {
    flex: 1,
    background: "transparent",
    color: "#555",
    border: "1px solid #222",
    borderRadius: 6,
    padding: "13px 0",
    fontSize: 13,
    cursor: "pointer",
  },
  btnPay: {
    flex: 1,
    background: "linear-gradient(135deg, #c9a84c, #e8c97a)",
    color: "#080808",
    border: "none",
    borderRadius: 6,
    padding: "13px 0",
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 16,
    letterSpacing: 1,
    cursor: "pointer",
  },
  toast: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "12px 24px",
    borderRadius: 6,
    color: "#fff",
    fontWeight: 600,
    zIndex: 9999,
    fontSize: 13,
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
  },
  error: { color: "#e74c3c", fontSize: 13, marginTop: 12 },
};
