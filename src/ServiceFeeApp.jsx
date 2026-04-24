import React, { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const STRIPE_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const USER_ID = "user_cory_watson";
const stripePromise = loadStripe(STRIPE_PK);

const PLATFORMS = [
  { name: "Netflix", icon: "??", fee: 0.07 },
  { name: "Spotify", icon: "??", fee: 0.05 },
  { name: "Adobe CC", icon: "??", fee: 0.10 },
  { name: "GitHub Pro", icon: "??", fee: 0.05 },
  { name: "Notion", icon: "??", fee: 0.03 },
  { name: "Slack", icon: "??", fee: 0.04 },
  { name: "Dropbox", icon: "??", fee: 0.03 },
  { name: "Zoom", icon: "??", fee: 0.05 },
  { name: "Figma", icon: "??", fee: 0.06 },
  { name: "ChatGPT Plus", icon: "??", fee: 0.08 },
  { name: "AWS", icon: "??", fee: 0.10 },
  { name: "Custom", icon: "??", fee: 0.02 },
];

function CheckoutForm({ amount, userId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true); setError(null);
    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(submitErr.message); setPaying(false); return; }
    const { error: confirmErr } = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: "if_required" });
    if (confirmErr) { setError(confirmErr.message); setPaying(false); }
    else {
      await fetch(`${API_URL}/api/clear-balance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      onSuccess();
    }
  };
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20 }}>
      <div style={{ background:"#111",border:"1px solid #2a2a2a",borderRadius:16,padding:32,width:"100%",maxWidth:480 }}>
        <h2 style={{ color:"#f0e6c8",margin:"0 0 4px" }}>?? Collect ${amount.toFixed(2)}</h2>
        <p style={{ color:"#666",margin:"0 0 20px",fontSize:13 }}>Platform maintenance fees</p>
        <PaymentElement />
        {error && <p style={{ color:"#e74c3c",fontSize:13,marginTop:12 }}>{error}</p>}
        <div style={{ display:"flex",gap:12,marginTop:20 }}>
          <button style={{ flex:1,background:"transparent",color:"#666",border:"1px solid #333",borderRadius:8,padding:"13px 0",fontSize:14,cursor:"pointer" }} onClick={onCancel} disabled={paying}>Cancel</button>
          <button style={{ flex:1,background:"#b8a06a",color:"#0d0d0d",border:"none",borderRadius:8,padding:"13px 0",fontSize:14,fontWeight:700,cursor:"pointer" }} onClick={handlePay} disabled={paying||!stripe}>{paying?"Processing…":`Pay $${amount.toFixed(2)}`}</button>
        </div>
      </div>
    </div>
  );
}

export default function ServiceFeeApp() {
  const [balance, setBalance] = useState(0);
  const [totalCharged, setTotalCharged] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [threshold, setThreshold] = useState(0.50);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [paid, setPaid] = useState(false);
  const [activeTab, setActiveTab] = useState("platforms");

  const fetchBalance = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/balance/${USER_ID}`);
      const d = await r.json();
      setBalance(d.balance??0); setTotalCharged(d.totalCharged??0); setTransactions(d.transactions??[]); setThreshold(d.threshold??0.50);
    } catch { showToast("Could not reach server","error"); }
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const applyFee = async (platform) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/add-fee`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({userId:USER_ID,platform:platform.name,feeAmount:platform.fee}) });
      const d = await r.json();
      if (!r.ok) { showToast(d.error,"error"); return; }
      setBalance(d.balance);
      showToast(`? $${platform.fee.toFixed(2)} added for ${platform.name}`);
      if (d.readyToCharge) showToast("?? Ready to collect!","info");
      await fetchBalance();
    } catch { showToast("Server error","error"); }
    finally { setLoading(false); }
  };

  const startCheckout = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/create-payment-intent`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({userId:USER_ID}) });
      const d = await r.json();
      if (!r.ok) { showToast(d.error,"error"); return; }
      setClientSecret(d.clientSecret);
    } catch { showToast("Server error","error"); }
    finally { setLoading(false); }
  };

  const handleSuccess = () => { setClientSecret(null); setPaid(true); setBalance(0); setTransactions([]); showToast("?? Payment successful!"); setTimeout(()=>setPaid(false),4000); };
  const pct = Math.min((balance/threshold)*100,100);

  return (
    <div style={{ minHeight:"100vh",background:"#0d0d0d",color:"#f0e6c8",fontFamily:"sans-serif",paddingBottom:60 }}>
      {toast && <div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",padding:"12px 24px",borderRadius:8,color:"#fff",fontWeight:600,zIndex:9999,fontSize:14,background:toast.type==="error"?"#c0392b":toast.type==="info"?"#2980b9":"#1a7a4a" }}>{toast.msg}</div>}
      <div style={{ background:"#111",borderBottom:"1px solid #222",padding:"24px 20px 20px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",maxWidth:700,margin:"0 auto 16px" }}>
          <div><div style={{ fontSize:22,fontWeight:700,letterSpacing:1,color:"#b8a06a" }}>? ServiceFee</div><div style={{ fontSize:11,color:"#555",letterSpacing:2,textTransform:"uppercase",marginTop:2 }}>They charge you whether you watch or not. We don't.</div></div>
          <div style={{ textAlign:"right" }}><div style={{ fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase" }}>BALANCE</div><div style={{ fontSize:32,fontWeight:300,color:"#f0e6c8",fontFamily:"monospace" }}>${balance.toFixed(2)}</div></div>
        </div>
        <div style={{ maxWidth:700,margin:"0 auto" }}>
          <div style={{ background:"#1a1a1a",borderRadius:4,height:6,overflow:"hidden" }}><div style={{ height:"100%",borderRadius:4,transition:"width 0.4s ease",width:`${pct}%`,background:pct>=100?"#f1c40f":"#b8a06a" }}/></div>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#555",marginTop:6 }}><span>${balance.toFixed(2)} accumulated</span><span>Collect at ${threshold.toFixed(2)}</span></div>
        </div>
        {balance>=threshold && <button style={{ display:"block",margin:"16px auto 0",background:"#b8a06a",color:"#0d0d0d",border:"none",borderRadius:8,padding:"12px 32px",fontSize:15,fontWeight:700,cursor:"pointer" }} onClick={startCheckout} disabled={loading}>{loading?"Loading…":`?? Collect $${balance.toFixed(2)}`}</button>}
      </div>
      <div style={{ display:"flex",maxWidth:700,margin:"20px auto 0",padding:"0 20px",gap:8 }}>
        {["platforms","history"].map(t=><button key={t} style={{ background:"transparent",border:`1px solid ${activeTab===t?"#b8a06a":"#222"}`,color:activeTab===t?"#b8a06a":"#555",padding:"8px 20px",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:600 }} onClick={()=>setActiveTab(t)}>{t==="platforms"?"?? Platforms":`?? History (${transactions.length})`}</button>)}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,maxWidth:700,margin:"16px auto 0",padding:"0 20px" }}>
        {[["Total Charged",`$${totalCharged.toFixed(2)}`],["Pending Fees",transactions.length],["Until Collect",`$${Math.max(0,threshold-balance).toFixed(2)}`]].map(([label,val])=>(
          <div key={label} style={{ background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:"14px 16px",textAlign:"center" }}>
            <div style={{ fontSize:22,fontWeight:700,color:"#b8a06a",fontFamily:"monospace" }}>{val}</div>
            <div style={{ fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:1,marginTop:4 }}>{label}</div>
          </div>
        ))}
      </div>
      {activeTab==="platforms" && (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,maxWidth:700,margin:"20px auto 0",padding:"0 20px" }}>
          {PLATFORMS.map(p=><button key={p.name} style={{ background:"#111",border:"1px solid #1e1e1e",borderRadius:12,padding:"20px 12px",cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:6 }} onClick={()=>applyFee(p)} disabled={loading}><div style={{ fontSize:28 }}>{p.icon}</div><div style={{ fontSize:12,fontWeight:600,color:"#c8b880" }}>{p.name}</div><div style={{ fontSize:20,fontWeight:700,color:"#f0e6c8",fontFamily:"monospace" }}>${p.fee.toFixed(2)}</div><div style={{ fontSize:9,color:"#444",textTransform:"uppercase",letterSpacing:1 }}>fee</div></button>)}
        </div>
      )}
      {activeTab==="history" && (
        <div style={{ maxWidth:700,margin:"20px auto 0",padding:"0 20px" }}>
          {transactions.length===0?<div style={{ textAlign:"center",color:"#444",padding:"60px 20px" }}>No fees yet.</div>:transactions.map(t=>(
            <div key={t.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111",border:"1px solid #1e1e1e",borderRadius:8,padding:"14px 16px",marginBottom:8 }}>
              <div><div style={{ fontSize:14,fontWeight:600,color:"#c8b880" }}>{t.platform}</div><div style={{ fontSize:11,color:"#444",marginTop:3 }}>{new Date(t.created_at).toLocaleString()}</div></div>
              <div style={{ fontSize:16,fontWeight:700,color:"#b8a06a",fontFamily:"monospace" }}>+${parseFloat(t.amount).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
      {clientSecret && <Elements stripe={stripePromise} options={{ clientSecret,appearance:{theme:"night"} }}><CheckoutForm amount={balance} userId={USER_ID} onSuccess={handleSuccess} onCancel={()=>setClientSecret(null)}/></Elements>}
      {paid && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}><div style={{ background:"#111",border:"1px solid #2a2a2a",borderRadius:16,padding:32,textAlign:"center" }}><div style={{ fontSize:64 }}>??</div><h2 style={{ color:"#f0e6c8",marginTop:12 }}>Payment Successful!</h2><p style={{ color:"#b8a06a" }}>Balance cleared.</p></div></div>}
    </div>
  );
}
