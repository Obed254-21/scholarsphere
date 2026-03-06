import { useState, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const C = {
  bg:"#07090f", surf:"#0d1117", surf2:"#111827", card:"#0d1421",
  border:"#1a2744", border2:"#243356",
  blue:"#3b82f6", cyan:"#06b6d4", purple:"#8b5cf6",
  gold:"#f59e0b", green:"#10b981", red:"#ef4444",
  text:"#e2e8f0", muted:"#4b5563", muted2:"#8892a4",
};

const ADMIN_EMAIL = "obeddy@gmail.com";
const ADMIN_PASS  = "Puppy254@";
const K_USERS     = "ss:v2:users";
const K_SESSION   = "ss:v2:session";
const K_DATA      = (e) => `ss:v2:data:${e.replace(/[^a-z0-9]/gi,"_")}`;

/* ═══════════════════════════════════════════════════════════
   STORAGE  (window.storage — server-side persistent cloud)
═══════════════════════════════════════════════════════════ */
async function sGet(key, fallback = null) {
  try {
    const r = await window.storage.get(key);
    return r ? JSON.parse(r.value) : fallback;
  } catch { return fallback; }
}
async function sSet(key, value) {
  try { await window.storage.set(key, JSON.stringify(value)); } catch (e) { console.error("sSet:", e); }
}

/* ═══════════════════════════════════════════════════════════
   PURE HELPERS
═══════════════════════════════════════════════════════════ */
function gradeColor(p) { if (p===null) return C.muted; if (p>=70) return C.green; if (p>=60) return C.cyan; if (p>=50) return C.gold; return C.red; }
function gradeLabel(p) { if (p===null) return "–"; if (p>=70) return "A"; if (p>=60) return "B"; if (p>=50) return "C"; if (p>=40) return "D"; return "F"; }
function unitAvg(u) { if (!u.scores.length) return null; return u.scores.reduce((s,sc) => s+(sc.value/sc.outOf)*100, 0) / u.scores.length; }
function fileIcon(name="") {
  const ext = (name.split(".").pop()||"").toLowerCase();
  if (ext==="pdf") return "📄";
  if (["doc","docx"].includes(ext)) return "📝";
  if (["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return "🖼️";
  if (["ppt","pptx"].includes(ext)) return "📊";
  if (["xls","xlsx","csv"].includes(ext)) return "📈";
  if (["mp4","mov","avi","mkv"].includes(ext)) return "🎬";
  if (["txt","md","rtf"].includes(ext)) return "📃";
  return "📁";
}
function fmtBytes(b) { if (b<1024) return b+"B"; if (b<1048576) return (b/1024).toFixed(1)+"KB"; return (b/1048576).toFixed(1)+"MB"; }
function readAsB64(file) { return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
function readAsText(file) { return new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(file); }); }

function ytSuggestionsFromUnit(unit) {
  const base = unit.title;
  const tags = unit.tags || [];
  const noteWords = (unit.unitFiles||[]).filter(f=>f.textContent).flatMap(f => f.textContent.split(/\s+/).filter(w=>w.length>5)).slice(0,6);
  const kwPool = [...tags, ...noteWords.slice(0,3)];
  const suggestions = [
    { title: `${base} – Full Tutorial`,    query: `${base} full tutorial` },
    { title: `${base} Crash Course`,       query: `${base} crash course` },
    { title: `${base} for Beginners`,      query: `${base} beginner guide` },
    { title: `${base} Explained Simply`,   query: `${base} explained` },
  ];
  kwPool.slice(0,3).forEach(kw => {
    suggestions.push({ title: `${kw} – ${base}`, query: `${kw} ${base}` });
  });
  return suggestions.slice(0,6).map((s,i) => ({
    ...s, id: i+1, url: `https://www.youtube.com/results?search_query=${encodeURIComponent(s.query)}`
  }));
}

/* ═══════════════════════════════════════════════════════════
   GLOBAL STYLES (injected once)
═══════════════════════════════════════════════════════════ */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Outfit', sans-serif; background: #07090f; color: #e2e8f0; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #07090f; }
  ::-webkit-scrollbar-thumb { background: #1a2744; border-radius: 4px; }
  ::placeholder { color: #4b5563 !important; opacity: 1; }
  select option { background: #0d1117; color: #e2e8f0; }
  a { text-decoration: none; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:.4; } }
  @keyframes float    { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-20px); } }
  @keyframes shimmer  { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
  .fade-up  { animation: fadeUp  0.35s ease both; }
  .fade-in  { animation: fadeIn  0.25s ease both; }
`;

/* ═══════════════════════════════════════════════════════════
   ATOM COMPONENTS
═══════════════════════════════════════════════════════════ */

function Spinner({ size=18, color=C.blue }) {
  return <div style={{ width:size, height:size, border:`2px solid ${color}30`, borderTopColor:color, borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }}/>;
}

function Pill({ children, color="blue" }) {
  const map = {
    blue:   { bg:"rgba(59,130,246,0.12)",   text:"#93c5fd", bd:"rgba(59,130,246,0.25)"   },
    cyan:   { bg:"rgba(6,182,212,0.12)",    text:"#67e8f9", bd:"rgba(6,182,212,0.25)"    },
    green:  { bg:"rgba(16,185,129,0.12)",   text:"#6ee7b7", bd:"rgba(16,185,129,0.25)"   },
    gold:   { bg:"rgba(245,158,11,0.12)",   text:"#fcd34d", bd:"rgba(245,158,11,0.25)"   },
    red:    { bg:"rgba(239,68,68,0.12)",    text:"#fca5a5", bd:"rgba(239,68,68,0.25)"    },
    purple: { bg:"rgba(139,92,246,0.12)",   text:"#c4b5fd", bd:"rgba(139,92,246,0.25)"   },
  };
  const s = map[color]||map.blue;
  return <span style={{ fontSize:"0.7rem", padding:"3px 8px", borderRadius:5, fontWeight:600, fontFamily:"'Outfit',sans-serif", background:s.bg, color:s.text, border:`1px solid ${s.bd}`, whiteSpace:"nowrap" }}>{children}</span>;
}

function ProgressBar({ pct }) {
  const bg = pct>=70 ? `linear-gradient(90deg,${C.green},${C.cyan})` : pct>=50 ? `linear-gradient(90deg,${C.gold},#f97316)` : `linear-gradient(90deg,${C.red},#f97316)`;
  return (
    <div style={{ background:C.border, borderRadius:3, height:5, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:bg, borderRadius:3, transition:"width 0.9s ease" }}/>
    </div>
  );
}

function PrimaryButton({ children, onClick, small, danger, disabled, fullWidth, style={} }) {
  const [hov, setH] = useState(false);
  const bg = disabled ? "#1a2744" : danger ? `linear-gradient(135deg,${C.red},#dc2626)` : `linear-gradient(135deg,${C.blue},${C.purple})`;
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ background:bg, border:"none", borderRadius:9, color: disabled ? C.muted : "#fff",
        padding: small ? "7px 16px" : "11px 22px",
        fontSize: small ? "0.8rem" : "0.9rem", fontWeight:600, fontFamily:"'Outfit',sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        display:"inline-flex", alignItems:"center", gap:7, whiteSpace:"nowrap",
        width: fullWidth ? "100%" : "auto", justifyContent: fullWidth ? "center" : "flex-start",
        transform: hov&&!disabled ? "translateY(-1px)" : "none",
        boxShadow: hov&&!disabled&&!danger ? "0 4px 20px rgba(59,130,246,0.35)" : "none",
        transition:"all 0.2s", ...style }}>
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, small, style={} }) {
  const [hov, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ background: hov?"rgba(255,255,255,0.05)":"transparent", border:`1px solid ${hov?C.border2:C.border}`,
        borderRadius:9, color: hov?C.text:C.muted2, padding: small?"7px 14px":"11px 22px",
        fontSize: small?"0.8rem":"0.9rem", fontWeight:500, fontFamily:"'Outfit',sans-serif",
        cursor:"pointer", display:"inline-flex", alignItems:"center", gap:7, whiteSpace:"nowrap",
        transition:"all 0.2s", ...style }}>
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type="text", onKeyDown, style={} }) {
  const [foc, setF] = useState(false);
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} type={type} onKeyDown={onKeyDown}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}
      style={{ width:"100%", background:C.bg, border:`1px solid ${foc?C.blue:C.border}`,
        borderRadius:9, padding:"11px 14px", color:C.text, fontFamily:"'Outfit',sans-serif",
        fontSize:"0.92rem", outline:"none", transition:"border-color 0.2s", boxSizing:"border-box", ...style }}/>
  );
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange}
      style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:9,
        padding:"11px 14px", color:C.text, fontFamily:"'Outfit',sans-serif",
        fontSize:"0.92rem", outline:"none", boxSizing:"border-box", cursor:"pointer" }}>
      {children}
    </select>
  );
}

function FormGroup({ label, children, hint }) {
  return (
    <div style={{ marginBottom:18 }}>
      <label style={{ display:"block", fontSize:"0.72rem", color:C.muted2, marginBottom:7,
        fontWeight:600, letterSpacing:"0.8px", textTransform:"uppercase", fontFamily:"'Outfit',sans-serif" }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize:"0.73rem", color:C.muted, marginTop:5 }}>{hint}</div>}
    </div>
  );
}

function Card({ children, style={}, onClick, hoverable }) {
  const [hov, setH] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={()=>hoverable&&setH(true)} onMouseLeave={()=>hoverable&&setH(false)}
      style={{ background:C.card, border:`1px solid ${hoverable&&hov?C.blue:C.border}`,
        borderRadius:13, padding:20, transition:"border-color 0.2s",
        cursor: onClick?"pointer":"default", ...style }}>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9000,
        display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)" }}>
      <div className="fade-up"
        style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:16,
          padding:"28px 30px", width: wide ? 780 : 500, maxWidth:"95vw",
          maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.15rem", fontWeight:700 }}>{title}</h3>
          <button onClick={onClose}
            style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:"1.1rem", lineHeight:1, padding:4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Alert({ children, type="error" }) {
  const colors = { error:{ bg:"rgba(239,68,68,0.1)", bd:"rgba(239,68,68,0.3)", c:"#fca5a5" }, success:{ bg:"rgba(16,185,129,0.1)", bd:"rgba(16,185,129,0.3)", c:"#6ee7b7" } };
  const s = colors[type]||colors.error;
  return (
    <div style={{ background:s.bg, border:`1px solid ${s.bd}`, borderRadius:9,
      padding:"10px 14px", color:s.c, fontSize:"0.85rem", marginBottom:16 }}>
      {children}
    </div>
  );
}

function SideNavItem({ icon, label, active, badge, onClick }) {
  const [hov, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ display:"flex", alignItems:"center", gap:11, padding:"10px 18px",
        cursor:"pointer", transition:"all 0.2s",
        background: active ? "rgba(59,130,246,0.12)" : hov ? "rgba(255,255,255,0.03)" : "transparent",
        color: active ? C.blue : hov ? C.text : C.muted2,
        borderLeft: `3px solid ${active?C.blue:"transparent"}`,
        fontSize:"0.88rem", fontWeight: active?600:400 }}>
      <span style={{ fontSize:17, width:22, textAlign:"center" }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {badge!==undefined && badge!==null && (
        <span style={{ background:C.blue, color:"#fff", fontSize:"0.68rem", padding:"2px 6px", borderRadius:8, fontWeight:700 }}>{badge}</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   NOTE VIEWER MODAL
═══════════════════════════════════════════════════════════ */
function NoteViewerModal({ note, onClose }) {
  if (!note) return null;
  const isImage = note.type && note.type.startsWith("image/");
  const isPDF   = note.name.toLowerCase().endsWith(".pdf") || note.type === "application/pdf";
  const hasText = note.textContent != null;

  return (
    <Modal open onClose={onClose} title={`${fileIcon(note.name)} ${note.name}`} wide>
      <div style={{ minHeight:420, display:"flex", flexDirection:"column" }}>
        {isImage && note.dataUrl && (
          <img src={note.dataUrl} alt={note.name}
            style={{ maxWidth:"100%", maxHeight:520, borderRadius:10, objectFit:"contain", alignSelf:"center" }}/>
        )}
        {isPDF && note.dataUrl && (
          <iframe src={note.dataUrl} title={note.name}
            style={{ width:"100%", height:520, border:"none", borderRadius:10 }}/>
        )}
        {!isImage && !isPDF && hasText && (
          <pre style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:18,
            fontSize:"0.83rem", color:C.muted2, whiteSpace:"pre-wrap", lineHeight:1.75,
            maxHeight:520, overflowY:"auto", fontFamily:"'Outfit',monospace" }}>
            {note.textContent}
          </pre>
        )}
        {!isImage && !isPDF && !hasText && (
          <div style={{ textAlign:"center", padding:"60px 24px", color:C.muted }}>
            <div style={{ fontSize:52, marginBottom:12 }}>{fileIcon(note.name)}</div>
            <p style={{ marginBottom:6, fontWeight:500 }}>Preview not available</p>
            <p style={{ fontSize:"0.82rem" }}>This file type cannot be previewed in browser.</p>
          </div>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:18 }}>
          {note.dataUrl && (
            <a href={note.dataUrl} download={note.name}>
              <PrimaryButton small>📥 Download {note.name}</PrimaryButton>
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   AUTH SCREEN  (Register + Login)
═══════════════════════════════════════════════════════════ */
function AuthScreen({ onLogin }) {
  const [tab, setTab]       = useState("login");
  const [loading, setLoad]  = useState(false);
  const [err, setErr]       = useState("");
  const [ok, setOk]         = useState("");

  // login form
  const [lEmail, setLEmail] = useState("");
  const [lPass,  setLPass]  = useState("");

  // register form
  const [rName,   setRName]   = useState("");
  const [rEmail,  setREmail]  = useState("");
  const [rSchool, setRSchool] = useState("");
  const [rCourse, setRCourse] = useState("");
  const [rYear,   setRYear]   = useState("");
  const [rPass,   setRPass]   = useState("");

  async function doLogin() {
    setErr(""); if (!lEmail||!lPass) { setErr("Fill all fields."); return; }
    setLoad(true);
    const users = await sGet(K_USERS, []);
    const u = users.find(x => x.email.toLowerCase()===lEmail.toLowerCase() && x.pass===lPass);
    if (!u) { setErr("Invalid email or password."); setLoad(false); return; }
    await sSet(K_SESSION, { email:u.email, pass:u.pass });
    setLoad(false); onLogin(u);
  }

  async function doRegister() {
    setErr("");
    if (!rName||!rEmail||!rSchool||!rCourse||!rYear||!rPass) { setErr("Please fill all fields."); return; }
    if (rPass.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rEmail)) { setErr("Enter a valid email address."); return; }
    setLoad(true);
    const users = await sGet(K_USERS, []);
    if (users.find(x => x.email.toLowerCase()===rEmail.toLowerCase())) {
      setErr("Email already registered."); setLoad(false); return;
    }
    const u = { name:rName.trim(), email:rEmail.toLowerCase(), school:rSchool.trim(), course:rCourse.trim(), year:rYear, pass:rPass, createdAt:Date.now() };
    await sSet(K_USERS, [...users, u]);
    await sSet(K_DATA(u.email), { units:[], files:[] });
    setOk("✅ Account created! You can now sign in."); setLoad(false);
    setTimeout(() => { setTab("login"); setOk(""); }, 1800);
  }

  const features = ["☁️ Cloud Sync","📱 Multi-Device Access","🤖 AI Tutor","📄 Notes Viewer + Download","▶️ Smart YouTube Suggestions","📊 Score Tracking","🔐 Secure Accounts"];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", fontFamily:"'Outfit',sans-serif" }}>
      {/* left decorative panel */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        padding:60, position:"relative", overflow:"hidden" }}>
        {/* ambient orbs */}
        <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse at 25% 40%, rgba(59,130,246,0.18) 0%, transparent 65%), radial-gradient(ellipse at 75% 70%, rgba(139,92,246,0.12) 0%, transparent 60%)` }}/>
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"rgba(59,130,246,0.06)", filter:"blur(100px)", top:-150, left:-150, animation:"float 9s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", width:350, height:350, borderRadius:"50%", background:"rgba(139,92,246,0.06)", filter:"blur(80px)", bottom:-100, right:50, animation:"float 11s -4s ease-in-out infinite" }}/>

        <div style={{ position:"relative", zIndex:1, textAlign:"center", maxWidth:460 }}>
          {/* logo */}
          <div style={{ width:76, height:76, background:`linear-gradient(135deg,${C.blue},${C.purple})`, borderRadius:22,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:36,
            margin:"0 auto 24px", boxShadow:`0 0 60px rgba(59,130,246,0.4)` }}>🎓</div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"3rem", fontWeight:800, letterSpacing:"-1.5px",
            background:`linear-gradient(135deg, #fff 20%, ${C.cyan} 80%)`,
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8 }}>
            ScholarSphere
          </h1>
          <p style={{ color:C.muted2, fontSize:"0.95rem", letterSpacing:"2.5px", textTransform:"uppercase",
            fontWeight:300, marginBottom:40 }}>Academic Intelligence Platform</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
            {features.map(f => (
              <div key={f} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${C.border}`,
                padding:"6px 13px", borderRadius:20, fontSize:"0.76rem", color:C.muted2 }}>{f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* right form panel */}
      <div style={{ width:460, background:C.surf, borderLeft:`1px solid ${C.border}`,
        display:"flex", flexDirection:"column", justifyContent:"center", padding:"56px 44px", overflowY:"auto" }}>
        {/* tab switcher */}
        <div style={{ display:"flex", gap:3, background:C.bg, borderRadius:11, padding:4, marginBottom:26 }}>
          {["login","register"].map(t => (
            <button key={t} onClick={()=>{ setTab(t); setErr(""); setOk(""); }}
              style={{ flex:1, padding:"10px", border:"none", fontFamily:"'Outfit',sans-serif",
                fontWeight:600, fontSize:"0.88rem", borderRadius:8, cursor:"pointer", transition:"all 0.2s",
                background: tab===t ? `linear-gradient(135deg,${C.blue},${C.purple})` : "transparent",
                color: tab===t ? "#fff" : C.muted2 }}>
              {t==="login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {err && <Alert type="error">{err}</Alert>}
        {ok  && <Alert type="success">{ok}</Alert>}

        {tab==="login" && (
          <div className="fade-in">
            <FormGroup label="Email Address">
              <Input value={lEmail} onChange={e=>setLEmail(e.target.value)} placeholder="you@email.com" type="email"/>
            </FormGroup>
            <FormGroup label="Password">
              <Input value={lPass} onChange={e=>setLPass(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            </FormGroup>
            <PrimaryButton onClick={doLogin} disabled={loading} fullWidth style={{ marginTop:6, padding:14, fontSize:"1rem" }}>
              {loading ? <Spinner size={17} color="#fff"/> : "🚀"} Sign In to Dashboard
            </PrimaryButton>
            <div style={{ textAlign:"center", color:C.muted, fontSize:"0.82rem", marginTop:16 }}>
              No account? <span onClick={()=>setTab("register")} style={{ color:C.blue, cursor:"pointer", fontWeight:500 }}>Register here</span>
            </div>
          </div>
        )}

        {tab==="register" && (
          <div className="fade-in">
            <FormGroup label="Full Name">
              <Input value={rName} onChange={e=>setRName(e.target.value)} placeholder="e.g. Amina Wanjiru"/>
            </FormGroup>
            <FormGroup label="Email Address">
              <Input value={rEmail} onChange={e=>setREmail(e.target.value)} placeholder="you@email.com" type="email"/>
            </FormGroup>
            <FormGroup label="University / Institution">
              <Input value={rSchool} onChange={e=>setRSchool(e.target.value)} placeholder="e.g. University of Nairobi"/>
            </FormGroup>
            <FormGroup label="Course / Programme">
              <Input value={rCourse} onChange={e=>setRCourse(e.target.value)} placeholder="e.g. BSc Computer Science"/>
            </FormGroup>
            <FormGroup label="Year of Study">
              <Select value={rYear} onChange={e=>setRYear(e.target.value)}>
                <option value="">Select year</option>
                {["Year 1","Year 2","Year 3","Year 4","Year 5","Postgraduate"].map(y=>(
                  <option key={y}>{y}</option>
                ))}
              </Select>
            </FormGroup>
            <FormGroup label="Password" hint="Minimum 6 characters">
              <Input value={rPass} onChange={e=>setRPass(e.target.value)} placeholder="Create a strong password" type="password"/>
            </FormGroup>
            <PrimaryButton onClick={doRegister} disabled={loading} fullWidth style={{ marginTop:6, padding:14, fontSize:"1rem" }}>
              {loading ? <Spinner size={17} color="#fff"/> : "✨"} Create My Account
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════════ */
function AdminPanel({ onExit }) {
  const [users,    setUsers]   = useState([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState("");

  useEffect(() => {
    (async () => {
      const u = await sGet(K_USERS, []); setUsers(u); setLoading(false);
    })();
  }, []);

  async function deleteUser(email) {
    if (!window.confirm(`Permanently delete account: ${email}?`)) return;
    const updated = users.filter(u => u.email !== email);
    await sSet(K_USERS, updated);
    await sSet(K_DATA(email), null);
    setUsers(updated);
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.school||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Outfit',sans-serif", color:C.text }}>
      <style>{STYLES}</style>
      {/* header */}
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"16px 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, background:`linear-gradient(135deg,${C.red},#f97316)`,
            borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🔐</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"1.05rem" }}>Admin Dashboard</div>
            <div style={{ fontSize:"0.72rem", color:C.muted }}>{ADMIN_EMAIL} · ScholarSphere</div>
          </div>
        </div>
        <GhostButton small onClick={onExit}>← Exit Admin</GhostButton>
      </div>

      <div style={{ padding:"28px 32px" }}>
        {/* stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
          {[
            { icon:"👥", val:users.length, label:"Registered Users", color:C.blue },
            { icon:"🎓", val:[...new Set(users.map(u=>u.school))].length, label:"Institutions", color:C.cyan },
            { icon:"☁️", val:"Live", label:"Cloud Storage", color:C.green },
          ].map(s => (
            <Card key={s.label} style={{ position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-20, right:-20, width:90, height:90, borderRadius:"50%", background:s.color, opacity:0.07 }}/>
              <div style={{ fontSize:26, marginBottom:10 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"2rem", fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:"0.78rem", color:C.muted2, marginTop:5 }}>{s.label}</div>
            </Card>
          ))}
        </div>

        <Card>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700 }}>👥 All Users ({users.length})</div>
            <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users…" style={{ width:220 }}/>
          </div>
          {loading ? (
            <div style={{ display:"flex", justifyContent:"center", padding:40 }}><Spinner size={32}/></div>
          ) : filtered.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px", color:C.muted }}>
              {users.length===0 ? "No users registered yet." : "No users match your search."}
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    {["Name","Email","Institution","Course","Year","Registered","Actions"].map(h => (
                      <th key={h} style={{ textAlign:"left", padding:"9px 12px", fontSize:"0.7rem", color:C.muted2,
                        textTransform:"uppercase", letterSpacing:"0.8px", borderBottom:`1px solid ${C.border}`, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.email} style={{ borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:"11px 12px", fontWeight:500 }}>{u.name}</td>
                      <td style={{ padding:"11px 12px", color:C.blue, fontSize:"0.85rem" }}>{u.email}</td>
                      <td style={{ padding:"11px 12px", color:C.muted2, fontSize:"0.85rem" }}>{u.school||"—"}</td>
                      <td style={{ padding:"11px 12px", color:C.muted2, fontSize:"0.85rem" }}>{u.course||"—"}</td>
                      <td style={{ padding:"11px 12px" }}><Pill color="blue">{u.year||"—"}</Pill></td>
                      <td style={{ padding:"11px 12px", color:C.muted, fontSize:"0.78rem" }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                      <td style={{ padding:"11px 12px" }}>
                        <button onClick={()=>deleteUser(u.email)}
                          style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#fca5a5",
                            borderRadius:7, padding:"5px 12px", fontSize:"0.75rem", cursor:"pointer", fontFamily:"'Outfit',sans-serif" }}>
                          🗑 Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP  (post-login)
═══════════════════════════════════════════════════════════ */
function MainApp({ user, onLogout }) {
  /* ── routing ── */
  const [page,    setPage]    = useState("units");   // units | detail | notes | ai | tutorials
  const [selId,   setSelId]   = useState(null);
  const [detTab,  setDetTab]  = useState("content"); // content | notes | scores | videos

  /* ── data ── */
  const [units,   setUnits]   = useState([]);
  const [files,   setFiles]   = useState([]);
  const [loading, setLoad]    = useState(true);
  const [saveStatus, setSave] = useState("idle");    // idle | saving | saved | error
  const [toast,   setToast]   = useState("");

  /* ── modals ── */
  const [showAddUnit,  setShowAddUnit]  = useState(false);
  const [showAddScore, setShowAddScore] = useState(false);
  const [scoreTarget,  setScoreTarget] = useState(null);
  const [viewNote,     setViewNote]    = useState(null);

  /* ── add-unit form ── */
  const [uCode, setUCode] = useState(""); const [uTitle,setUTitle]=useState(""); const [uDesc,setUDesc]=useState(""); const [uTags,setUTags]=useState(""); const [uErr,setUErr]=useState("");

  /* ── add-score form ── */
  const [sType,setSType]=useState("CAT 1"); const [sVal,setSVal]=useState(""); const [sOf,setSOf]=useState("100");

  /* ── content input ── */
  const [contentInput, setContentInput] = useState("");

  /* ── AI chat ── */
  const [messages,    setMessages]   = useState([{ role:"ai", text:"Hello! I'm your **ScholarSphere AI Tutor**. I can search the web for current information and read your uploaded notes to give you personalised answers. Ask me anything about your studies!" }]);
  const [chatInput,   setChatInput]  = useState("");
  const [chatLoading, setChatLoad]   = useState(false);
  const [aiContext,   setAiContext]  = useState(""); // unit id or "" for all
  const chatRef = useRef(null);

  /* ── load ── */
  useEffect(() => {
    (async () => {
      const d = await sGet(K_DATA(user.email), { units:[], files:[] });
      setUnits(d.units||[]); setFiles(d.files||[]); setLoad(false);
    })();
  }, [user.email]);

  /* ── auto-save ── */
  useEffect(() => {
    if (loading) return;
    setSave("saving");
    const t = setTimeout(async () => {
      try {
        await sSet(K_DATA(user.email), { units, files });
        setSave("saved"); setTimeout(()=>setSave("idle"), 2200);
      } catch { setSave("error"); setTimeout(()=>setSave("idle"), 3500); }
    }, 700);
    return () => clearTimeout(t);
  }, [units, files, loading, user.email]);

  /* ── scroll chat ── */
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  function showToast(m) { setToast(m); setTimeout(()=>setToast(""), 2800); }

  /* ── derived ── */
  const cu = units.find(u => u.id===selId) || null;
  const allAvgs = units.map(unitAvg).filter(Boolean);
  const overallAvg = allAvgs.length ? allAvgs.reduce((a,b)=>a+b,0)/allAvgs.length : null;

  /* ── UNIT OPERATIONS ── */
  function addUnit() {
    if (!uTitle.trim()) { setUErr("Unit title is required."); return; }
    const tags = uTags.split(",").map(t=>t.trim()).filter(Boolean);
    const u = { id:Date.now(), code:uCode.trim().toUpperCase()||"UNIT", title:uTitle.trim(), description:uDesc.trim(), tags, scores:[], content:[], unitFiles:[], savedVideos:[] };
    setUnits(p=>[...p,u]); setUCode(""); setUTitle(""); setUDesc(""); setUTags(""); setUErr(""); setShowAddUnit(false);
    showToast("Unit registered: "+u.title);
  }
  function deleteUnit(id) {
    if (!window.confirm("Delete this unit and all its data?")) return;
    setUnits(p=>p.filter(u=>u.id!==id));
    if (selId===id) { setSelId(null); setPage("units"); }
    showToast("Unit deleted");
  }
  function openUnit(u) { setSelId(u.id); setDetTab("content"); setPage("detail"); }

  /* ── CONTENT ── */
  function addContent() {
    if (!contentInput.trim()) return;
    const item = { id:Date.now(), text:contentInput.trim(), done:false };
    setUnits(p=>p.map(u=>u.id===selId?{...u,content:[...u.content,item]}:u));
    setContentInput("");
  }
  function toggleContent(cid) { setUnits(p=>p.map(u=>u.id===selId?{...u,content:u.content.map(c=>c.id===cid?{...c,done:!c.done}:c)}:u)); }
  function removeContent(cid) { setUnits(p=>p.map(u=>u.id===selId?{...u,content:u.content.filter(c=>c.id!==cid)}:u)); }

  /* ── SCORES ── */
  function openScoreModal(unit) { setScoreTarget(unit); setSType("CAT 1"); setSVal(""); setSOf("100"); setShowAddScore(true); }
  function saveScore() {
    const v=parseFloat(sVal), o=parseFloat(sOf);
    if (isNaN(v)||v<0||v>o) { showToast("❌ Invalid score values"); return; }
    setUnits(p=>p.map(u=>u.id===scoreTarget.id?{...u,scores:[...u.scores,{id:Date.now(),type:sType,value:v,outOf:o}]}:u));
    setShowAddScore(false); showToast("Score saved!");
  }

  /* ── FILE UPLOAD ── */
  async function handleUpload(e, unitId=null) {
    const list = Array.from(e.target.files);
    for (const f of list) {
      const isImg = f.type.startsWith("image/");
      const isPDF = f.name.toLowerCase().endsWith(".pdf") || f.type==="application/pdf";
      const isTxt = f.type.startsWith("text/") || ["txt","md","rtf","csv"].some(x=>f.name.toLowerCase().endsWith(x));
      let dataUrl=null, textContent=null;
      try {
        if (isImg||isPDF) dataUrl = await readAsB64(f);
        if (isTxt)        textContent = await readAsText(f);
      } catch(e) { console.error(e); }
      const note = { id:Date.now()+Math.random(), name:f.name, size:f.size, type:f.type, dataUrl, textContent, uploadedAt:Date.now() };
      if (unitId) setUnits(p=>p.map(u=>u.id===unitId?{...u,unitFiles:[...(u.unitFiles||[]),note]}:u));
      else        setFiles(p=>[...p, note]);
    }
    showToast(`✅ ${list.length} file(s) uploaded & saved to cloud`);
    e.target.value="";
  }

  function deleteFile(id, unitId=null) {
    if (unitId) setUnits(p=>p.map(u=>u.id===unitId?{...u,unitFiles:(u.unitFiles||[]).filter(f=>f.id!==id)}:u));
    else        setFiles(p=>p.filter(f=>f.id!==id));
  }

  /* ── VIDEO BOOKMARKS ── */
  function saveVideo(video) {
    if (cu?.savedVideos.find(v=>v.id===video.id)) return;
    setUnits(p=>p.map(u=>u.id===selId?{...u,savedVideos:[...u.savedVideos,video]}:u));
    showToast("🔖 Video bookmarked");
  }
  function removeVideo(vid) { setUnits(p=>p.map(u=>u.id===selId?{...u,savedVideos:u.savedVideos.filter(v=>v.id!==vid)}:u)); }

  /* ── AI CHAT ── */
  async function sendMessage() {
    const msg = chatInput.trim();
    if (!msg||chatLoading) return;
    setChatInput(""); setChatLoad(true);
    setMessages(p=>[...p,{role:"user",text:msg}]);

    // Build notes context
    const ctxUnit = units.find(u=>u.id==aiContext);
    const noteFiles = ctxUnit ? (ctxUnit.unitFiles||[]) : files;
    const notesText = noteFiles.filter(f=>f.textContent).map(f=>`[FILE: ${f.name}]\n${f.textContent}`).join("\n\n").slice(0,4000);
    const unitInfo  = ctxUnit ? `Unit: ${ctxUnit.code} - ${ctxUnit.title}. Topics: ${ctxUnit.tags.join(", ")}. Content: ${ctxUnit.content.map(c=>c.text).join("; ")}.` : "General academic session.";

    const systemPrompt = [
      `You are ScholarSphere AI, a world-class academic tutor with web search capability.`,
      `Student: ${user.name} | Course: ${user.course} | Institution: ${user.school} | ${user.year}.`,
      unitInfo,
      notesText ? `\n=== STUDENT'S UPLOADED NOTES ===\n${notesText}\n=================================` : "",
      `Instructions: First search the web for current, accurate information. Then combine with the student's uploaded notes above to give a comprehensive, personalised answer. Use markdown formatting (bold, lists, steps). Be encouraging and thorough. If the notes contain relevant info, reference it explicitly.`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          tools: [{ type:"web_search_20250305", name:"web_search" }],
          messages: [{ role:"user", content:msg }]
        })
      });
      const data = await res.json();
      const reply = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n") || "Sorry, I couldn't generate a response. Please try again.";
      setMessages(p=>[...p,{role:"ai",text:reply}]);
    } catch {
      setMessages(p=>[...p,{role:"ai",text:"⚠️ Connection error. Please check your internet and try again."}]);
    }
    setChatLoad(false);
  }

  /* ── SAVE STATUS BADGE ── */
  const saveBadge = { saving:{c:C.gold,i:"⏳",l:"Saving…"}, saved:{c:C.green,i:"✓",l:"Saved to cloud"}, error:{c:C.red,i:"✕",l:"Save failed"}, idle:{c:C.muted,i:"☁️",l:"Cloud sync on"} };
  const sb = saveBadge[saveStatus]||saveBadge.idle;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:20, fontFamily:"'Outfit',sans-serif", color:C.text }}>
      <style>{STYLES}</style>
      <div style={{ width:56,height:56,background:`linear-gradient(135deg,${C.blue},${C.purple})`,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30 }}>🎓</div>
      <Spinner size={32} color={C.blue}/>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1rem", color:C.muted2 }}>Loading your data from cloud…</div>
    </div>
  );

  /* ────────────────────── RENDER ────────────────────── */
  return (
    <>
      <style>{STYLES}</style>
      <div style={{ display:"flex", minHeight:"100vh", background:C.bg, fontFamily:"'Outfit',sans-serif", color:C.text }}>

        {/* ═══ SIDEBAR ═══ */}
        <nav style={{ width:256, background:C.surf, borderRight:`1px solid ${C.border}`, display:"flex",
          flexDirection:"column", position:"fixed", top:0, left:0, height:"100vh", zIndex:200 }}>

          {/* brand */}
          <div style={{ padding:"18px 18px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:11 }}>
            <div style={{ width:38,height:38,borderRadius:10,flexShrink:0,background:`linear-gradient(135deg,${C.blue},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19 }}>🎓</div>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"0.98rem", fontWeight:700 }}>ScholarSphere</div>
              <div style={{ fontSize:"0.67rem", color:C.muted, letterSpacing:"1px", textTransform:"uppercase" }}>Study Platform</div>
            </div>
          </div>

          {/* user card */}
          <div style={{ padding:"12px 18px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${C.cyan},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"0.85rem",flexShrink:0,color:"#fff" }}>
              {user.name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div style={{ overflow:"hidden" }}>
              <div style={{ fontSize:"0.85rem",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{user.name}</div>
              <div style={{ fontSize:"0.7rem",color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{user.course}</div>
            </div>
          </div>

          {/* nav links */}
          <div style={{ flex:1, overflowY:"auto", paddingTop:10 }}>
            <div style={{ padding:"6px 18px 4px", fontSize:"0.66rem", color:C.muted, letterSpacing:"2px", textTransform:"uppercase", fontWeight:600 }}>Navigation</div>
            <SideNavItem icon="📚" label="My Units"   badge={units.length||null} active={page==="units"||page==="detail"} onClick={()=>{setPage("units");setSelId(null);}}/>
            <SideNavItem icon="📂" label="My Notes"   badge={files.length||null} active={page==="notes"}     onClick={()=>setPage("notes")}/>
            <SideNavItem icon="🤖" label="AI Tutor"                              active={page==="ai"}         onClick={()=>setPage("ai")}/>
            <SideNavItem icon="▶️" label="Tutorials"                             active={page==="tutorials"}  onClick={()=>setPage("tutorials")}/>
          </div>

          {/* footer */}
          <div style={{ padding:"12px 18px", borderTop:`1px solid ${C.border}` }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,fontSize:"0.72rem",color:sb.c,marginBottom:5 }}>
              <span>{sb.i}</span><span>{sb.l}</span>
            </div>
            <div style={{ fontSize:"0.7rem", color:C.muted2, marginBottom:4 }}>{user.school} · {user.year}</div>
            {overallAvg!==null && (
              <div style={{ fontSize:"0.7rem", color:C.muted, marginBottom:8 }}>
                Overall avg: <span style={{ color:gradeColor(overallAvg), fontWeight:600 }}>{overallAvg.toFixed(1)}%</span>
              </div>
            )}
            <button onClick={onLogout}
              style={{ display:"flex",alignItems:"center",gap:7,color:C.muted,fontSize:"0.82rem",cursor:"pointer",background:"none",border:"none",padding:"4px 0",fontFamily:"'Outfit',sans-serif",transition:"color 0.15s",width:"100%" }}
              onMouseEnter={e=>e.currentTarget.style.color=C.red}
              onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
              🚪 Sign Out
            </button>
          </div>
        </nav>

        {/* ═══ CONTENT AREA ═══ */}
        <div style={{ marginLeft:256, flex:1, minHeight:"100vh", display:"flex", flexDirection:"column" }}>

          {/* top bar */}
          <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"13px 28px",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            position:"sticky", top:0, zIndex:100 }}>
            <div>
              {page==="detail"&&cu ? (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <button onClick={()=>{setPage("units");setSelId(null);}}
                    style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.83rem",fontFamily:"'Outfit',sans-serif",padding:0 }}>
                    ← My Units
                  </button>
                  <span style={{ color:C.border2 }}>›</span>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"1.1rem" }}>{cu.title}</div>
                </div>
              ) : (
                <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:"1.2rem" }}>
                  {page==="units"?"My Units":page==="notes"?"My Notes":page==="ai"?"AI Tutor":page==="tutorials"?"Video Tutorials":"ScholarSphere"}
                </h2>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:"0.72rem",color:sb.c }}><span>{sb.i}</span><span style={{ display:"none" }}>{sb.l}</span></div>
              {page==="units"  && <PrimaryButton small onClick={()=>setShowAddUnit(true)}>➕ Add Unit</PrimaryButton>}
              {page==="detail"&&cu && <PrimaryButton small onClick={()=>openScoreModal(cu)}>+ Score</PrimaryButton>}
            </div>
          </div>

          {/* ════════════ UNITS PAGE ════════════ */}
          {page==="units" && (
            <div className="fade-up" style={{ padding:"24px 28px" }}>
              {/* stat cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
                {[
                  { icon:"📚", val:units.length,                                           label:"Units Registered",  color:C.blue   },
                  { icon:"📝", val:units.reduce((s,u)=>s+u.scores.length,0),               label:"Scores Recorded",   color:C.cyan   },
                  { icon:"⭐", val:overallAvg!==null?overallAvg.toFixed(0)+"%":"–",        label:"Overall Average",   color:C.purple },
                ].map(s => (
                  <Card key={s.label} style={{ position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute",top:-20,right:-20,width:90,height:90,borderRadius:"50%",background:s.color,opacity:0.08 }}/>
                    <div style={{ fontSize:24, marginBottom:10 }}>{s.icon}</div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.9rem", fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
                    <div style={{ fontSize:"0.78rem", color:C.muted2, marginTop:5 }}>{s.label}</div>
                  </Card>
                ))}
              </div>

              {units.length===0 ? (
                <div style={{ textAlign:"center", padding:"64px 24px" }}>
                  <div style={{ fontSize:52, marginBottom:16, opacity:0.3 }}>📚</div>
                  <h3 style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.25rem", color:C.muted2, marginBottom:8 }}>No Units Registered Yet</h3>
                  <p style={{ color:C.muted, fontSize:"0.88rem", maxWidth:360, margin:"0 auto 24px" }}>
                    Register your semester units to organise notes, track scores, and get AI-powered YouTube tutorials.
                  </p>
                  <PrimaryButton onClick={()=>setShowAddUnit(true)}>➕ Register Your First Unit</PrimaryButton>
                </div>
              ) : (
                <div style={{ display:"grid", gap:12 }}>
                  {units.map(unit => {
                    const avg = unitAvg(unit); const gc = gradeColor(avg);
                    return (
                      <div key={unit.id} hoverable onClick={()=>openUnit(unit)}
                        style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:13, padding:"16px 18px",
                          cursor:"pointer", transition:"border-color 0.2s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                              <div style={{ background:`linear-gradient(135deg,${C.blue},${C.purple})`, color:"#fff", fontSize:"0.7rem", fontWeight:700, padding:"3px 9px", borderRadius:5, fontFamily:"'Syne',sans-serif" }}>{unit.code}</div>
                              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:"0.95rem", fontWeight:700 }}>{unit.title}</span>
                            </div>
                            {unit.description && <p style={{ color:C.muted2,fontSize:"0.83rem",lineHeight:1.6,marginBottom:8 }}>{unit.description.slice(0,110)}{unit.description.length>110?"…":""}</p>}
                            <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:avg!==null?10:0 }}>
                              {unit.tags.map(t=><Pill key={t} color="blue">#{t}</Pill>)}
                            </div>
                            {avg!==null && (
                              <div>
                                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:"0.73rem",color:C.muted }}>
                                  <span>Average</span>
                                  <span style={{ color:gc, fontWeight:600 }}>{avg.toFixed(1)}%</span>
                                </div>
                                <ProgressBar pct={avg}/>
                              </div>
                            )}
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7, flexShrink:0 }}>
                            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.9rem", fontWeight:800, color:gc, lineHeight:1 }}>{avg!==null?gradeLabel(avg):"–"}</div>
                            <div style={{ display:"flex",gap:6,fontSize:"0.7rem",color:C.muted }}>
                              <span>📝{unit.content.length}</span>
                              <span>📄{(unit.unitFiles||[]).length}</span>
                              <span>🎥{unit.savedVideos.length}</span>
                            </div>
                            <PrimaryButton small onClick={e=>{e.stopPropagation();openScoreModal(unit);}}>+ Score</PrimaryButton>
                            <button onClick={e=>{e.stopPropagation();deleteUnit(unit.id);}}
                              style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.9rem",padding:2 }}
                              onMouseEnter={e=>e.currentTarget.style.color=C.red}
                              onMouseLeave={e=>e.currentTarget.style.color=C.muted}>🗑️</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════ UNIT DETAIL PAGE ════════════ */}
          {page==="detail" && cu && (() => {
            const avg = unitAvg(cu); const gc = gradeColor(avg);
            const yt  = ytSuggestionsFromUnit(cu);
            const uFiles = cu.unitFiles||[];

            return (
              <div className="fade-up" style={{ padding:"24px 28px" }}>
                {/* unit header */}
                <div style={{ background:`linear-gradient(135deg,${C.surf},${C.surf2})`, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 24px", marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                        <div style={{ background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",fontSize:"0.7rem",fontWeight:700,padding:"4px 10px",borderRadius:6,fontFamily:"'Syne',sans-serif" }}>{cu.code}</div>
                        <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:"1.4rem", fontWeight:800 }}>{cu.title}</h2>
                      </div>
                      {cu.description && <p style={{ color:C.muted2,fontSize:"0.88rem",lineHeight:1.75,marginBottom:12 }}>{cu.description}</p>}
                      <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                        {cu.tags.map(t=><span key={t} style={{ background:"rgba(6,182,212,0.1)",color:C.cyan,border:"1px solid rgba(6,182,212,0.2)",borderRadius:18,padding:"3px 11px",fontSize:"0.74rem",fontWeight:500 }}>#{t}</span>)}
                      </div>
                    </div>
                    {avg!==null && (
                      <div style={{ textAlign:"center", flexShrink:0 }}>
                        <div style={{ fontFamily:"'Syne',sans-serif",fontSize:"3rem",fontWeight:800,color:gc,lineHeight:1 }}>{gradeLabel(avg)}</div>
                        <div style={{ fontSize:"0.78rem",color:C.muted,marginTop:3 }}>{avg.toFixed(1)}%</div>
                        <div style={{ marginTop:8,width:90 }}><ProgressBar pct={avg}/></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* tab bar */}
                <div style={{ display:"flex",gap:5,marginBottom:18,flexWrap:"wrap" }}>
                  {[
                    {k:"content",l:"📝 Content",   n:cu.content.length},
                    {k:"notes",  l:"📄 Notes",     n:uFiles.length},
                    {k:"scores", l:"📊 Scores",    n:cu.scores.length},
                    {k:"videos", l:"▶️ Tutorials", n:cu.savedVideos.length},
                  ].map(tab => {
                    const a = detTab===tab.k;
                    return (
                      <button key={tab.k} onClick={()=>setDetTab(tab.k)}
                        style={{ background:a?`linear-gradient(135deg,${C.blue},${C.purple})`:C.surf2,
                          border:`1px solid ${a?"transparent":C.border}`, borderRadius:8, padding:"7px 16px",
                          cursor:"pointer", color:a?"#fff":C.muted2, fontFamily:"'Outfit',sans-serif",
                          fontWeight:600, fontSize:"0.84rem", display:"flex", alignItems:"center", gap:5, transition:"all 0.15s" }}>
                        {tab.l}
                        {tab.n>0 && <span style={{ background:a?"rgba(255,255,255,0.25)":C.border,color:a?"#fff":C.muted2,borderRadius:99,fontSize:"0.68rem",fontWeight:700,padding:"1px 6px" }}>{tab.n}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* ── CONTENT TAB ── */}
                {detTab==="content" && (
                  <div className="fade-in">
                    <Card style={{ marginBottom:12 }}>
                      <div style={{ fontSize:"0.82rem",color:C.muted2,marginBottom:10 }}>Add topics, tasks or study notes</div>
                      <div style={{ display:"flex",gap:10 }}>
                        <Input value={contentInput} onChange={e=>setContentInput(e.target.value)}
                          placeholder="Add a topic, task or note — press Enter"
                          onKeyDown={e=>e.key==="Enter"&&addContent()} style={{ flex:1 }}/>
                        <PrimaryButton onClick={addContent}>Add</PrimaryButton>
                      </div>
                    </Card>
                    {cu.content.length===0 ? (
                      <div style={{ textAlign:"center",padding:"36px",color:C.muted }}>
                        <div style={{ fontSize:38,marginBottom:10,opacity:0.3 }}>📋</div>
                        <p>No content yet. Add topics or tasks above.</p>
                      </div>
                    ) : (
                      <div style={{ display:"grid",gap:7 }}>
                        {cu.content.map(item => (
                          <div key={item.id} style={{ background:item.done?"rgba(16,185,129,0.05)":C.card, border:`1px solid ${item.done?"rgba(16,185,129,0.2)":C.border}`, borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:11,transition:"all 0.15s" }}>
                            <div onClick={()=>toggleContent(item.id)} style={{ width:20,height:20,borderRadius:"50%",border:`2px solid ${item.done?C.green:C.border}`,background:item.done?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s" }}>
                              {item.done && <span style={{ color:"#fff",fontSize:"0.6rem",fontWeight:700 }}>✓</span>}
                            </div>
                            <span style={{ flex:1,color:item.done?C.muted:C.text,textDecoration:item.done?"line-through":"none",fontSize:"0.9rem" }}>{item.text}</span>
                            <button onClick={()=>removeContent(item.id)} style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.9rem" }} onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── NOTES TAB ── */}
                {detTab==="notes" && (
                  <div className="fade-in">
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                      <div>
                        <div style={{ fontSize:"0.85rem",color:C.muted2 }}>{uFiles.length} file{uFiles.length!==1?"s":""} in this unit</div>
                        <div style={{ fontSize:"0.75rem",color:C.muted,marginTop:2 }}>Text files are read by AI for personalised help</div>
                      </div>
                      <label style={{ background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",borderRadius:9,padding:"8px 16px",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:"0.82rem",fontWeight:600,display:"inline-flex",alignItems:"center",gap:7 }}>
                        📤 Upload Notes
                        <input type="file" multiple style={{ display:"none" }} onChange={e=>handleUpload(e,cu.id)}/>
                      </label>
                    </div>
                    {uFiles.length===0 ? (
                      <div style={{ textAlign:"center",padding:"44px 24px",color:C.muted }}>
                        <div style={{ fontSize:44,marginBottom:12,opacity:0.3 }}>📄</div>
                        <p style={{ fontWeight:500,marginBottom:6 }}>No notes uploaded for this unit yet</p>
                        <p style={{ fontSize:"0.82rem" }}>Upload PDFs, images, text files. The AI tutor will read them to give you personalised answers.</p>
                      </div>
                    ) : (
                      <div style={{ display:"grid",gap:9 }}>
                        {uFiles.map(f => (
                          <div key={f.id} style={{ background:C.surf2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 15px",display:"flex",alignItems:"center",gap:12 }}>
                            <div style={{ fontSize:28,flexShrink:0 }}>{fileIcon(f.name)}</div>
                            <div style={{ flex:1,overflow:"hidden" }}>
                              <div style={{ fontSize:"0.87rem",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{f.name}</div>
                              <div style={{ fontSize:"0.72rem",color:C.muted,marginTop:2 }}>
                                {fmtBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()}
                                {f.textContent && <span style={{ color:C.cyan }}> · 🤖 AI readable</span>}
                              </div>
                            </div>
                            <div style={{ display:"flex",gap:6,flexShrink:0 }}>
                              <PrimaryButton small onClick={()=>setViewNote(f)}>👁 View</PrimaryButton>
                              {f.dataUrl && (
                                <a href={f.dataUrl} download={f.name}>
                                  <GhostButton small>📥</GhostButton>
                                </a>
                              )}
                              <button onClick={()=>deleteFile(f.id,cu.id)} style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"1rem",padding:"0 2px" }} onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SCORES TAB ── */}
                {detTab==="scores" && (
                  <div className="fade-in">
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                      <div style={{ fontSize:"0.85rem",color:C.muted2 }}>{cu.scores.length} assessments recorded</div>
                      <PrimaryButton small onClick={()=>openScoreModal(cu)}>+ Add Score</PrimaryButton>
                    </div>
                    {cu.scores.length===0 ? (
                      <div style={{ textAlign:"center",padding:"40px",color:C.muted }}>
                        <div style={{ fontSize:38,marginBottom:10,opacity:0.3 }}>📊</div>
                        <p>No scores yet. Add your first assessment above.</p>
                      </div>
                    ) : (
                      <div style={{ display:"grid",gap:10 }}>
                        {cu.scores.map(sc => {
                          const p=(sc.value/sc.outOf)*100;
                          return (
                            <div key={sc.id} style={{ background:C.surf2,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:14 }}>
                              <Pill color={p>=70?"green":p>=50?"gold":"red"}>{sc.type}</Pill>
                              <div style={{ flex:1 }}><ProgressBar pct={p}/></div>
                              <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:"1.05rem",color:gradeColor(p) }}>
                                {sc.value}<span style={{ fontSize:"0.7rem",color:C.muted,fontWeight:400 }}>/{sc.outOf}</span>
                              </div>
                              <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,color:gradeColor(p),minWidth:24,textAlign:"center" }}>{gradeLabel(p)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── VIDEOS TAB ── */}
                {detTab==="videos" && (
                  <div className="fade-in">
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:14 }}>
                      <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:"0.9rem" }}>Suggested based on your notes & unit tags</div>
                      <Pill color="cyan">Smart match</Pill>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24 }}>
                      {yt.map(video => {
                        const saved = cu.savedVideos.find(v=>v.id===video.id);
                        return (
                          <div key={video.id} style={{ background:C.surf2,border:`1px solid ${saved?C.gold:C.border}`,borderRadius:11,overflow:"hidden",transition:"all 0.2s" }}>
                            <div style={{ background:`linear-gradient(135deg,${C.surf},${C.border})`,height:80,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",fontSize:26 }}>
                              📺
                              <div style={{ position:"absolute",width:32,height:32,background:"rgba(255,0,0,0.9)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff" }}>▶</div>
                            </div>
                            <div style={{ padding:"9px 11px" }}>
                              <div style={{ fontSize:"0.78rem",fontWeight:500,lineHeight:1.4,marginBottom:5,color:C.text }}>{video.title}</div>
                              <div style={{ fontSize:"0.69rem",color:C.muted,marginBottom:8 }}>"{video.query}"</div>
                              <div style={{ display:"flex",gap:5 }}>
                                <a href={video.url} target="_blank" rel="noopener noreferrer"
                                  style={{ background:"#ff0000",color:"#fff",padding:"4px 9px",borderRadius:6,fontSize:"0.7rem",fontWeight:600,flex:1,textAlign:"center",textDecoration:"none" }}>
                                  Search ↗
                                </a>
                                <button onClick={()=>saved?removeVideo(video.id):saveVideo(video)}
                                  style={{ background:saved?"rgba(245,158,11,0.2)":C.surf,border:`1px solid ${saved?C.gold:C.border}`,color:saved?C.gold:C.muted2,padding:"4px 9px",borderRadius:6,fontSize:"0.7rem",fontWeight:600,cursor:"pointer" }}>
                                  {saved?"✓":"🔖"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {cu.savedVideos.length>0 && (
                      <div>
                        <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:"0.88rem",marginBottom:10 }}>🔖 Bookmarked ({cu.savedVideos.length})</div>
                        {cu.savedVideos.map(v => (
                          <div key={v.id} style={{ background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"9px 13px",display:"flex",alignItems:"center",gap:11,marginBottom:7 }}>
                            <div style={{ width:30,height:30,background:"#ff0000",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12,flexShrink:0 }}>▶</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:"0.84rem",fontWeight:500 }}>{v.title}</div>
                              <div style={{ fontSize:"0.7rem",color:C.muted }}>"{v.query}"</div>
                            </div>
                            <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ color:C.blue,fontSize:"0.78rem",fontWeight:600,marginRight:6,textDecoration:"none" }}>Open ↗</a>
                            <button onClick={()=>removeVideo(v.id)} style={{ background:"none",border:"none",color:C.muted,cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ════════════ NOTES PAGE ════════════ */}
          {page==="notes" && (
            <div className="fade-up" style={{ padding:"24px 28px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
                <div>
                  <p style={{ color:C.muted2,fontSize:"0.87rem",lineHeight:1.6 }}>
                    Your global study materials — saved to the cloud. Text files are read by the AI tutor.
                  </p>
                </div>
                <label style={{ background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",borderRadius:9,padding:"10px 20px",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontSize:"0.88rem",fontWeight:600,display:"inline-flex",alignItems:"center",gap:8,flexShrink:0 }}>
                  📤 Upload Files
                  <input type="file" multiple style={{ display:"none" }} onChange={e=>handleUpload(e,null)}/>
                </label>
              </div>
              {files.length===0 ? (
                <div style={{ textAlign:"center",padding:"64px 24px" }}>
                  <div style={{ fontSize:52,marginBottom:14,opacity:0.3 }}>📂</div>
                  <h3 style={{ fontFamily:"'Syne',sans-serif",fontSize:"1.2rem",color:C.muted2,marginBottom:8 }}>No Notes Uploaded Yet</h3>
                  <p style={{ color:C.muted,fontSize:"0.88rem",maxWidth:380,margin:"0 auto" }}>
                    Upload PDFs, images, Word docs, text files and more. They're saved to the cloud and accessible from any device. The AI tutor reads your text files to give personalised help.
                  </p>
                </div>
              ) : (
                <div style={{ display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10 }}>
                  {files.map(f => (
                    <div key={f.id} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"13px 15px",display:"flex",alignItems:"center",gap:12,transition:"border-color 0.2s" }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=C.blue}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                      <div style={{ fontSize:30,flexShrink:0 }}>{fileIcon(f.name)}</div>
                      <div style={{ flex:1,overflow:"hidden" }}>
                        <div style={{ fontSize:"0.88rem",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{f.name}</div>
                        <div style={{ fontSize:"0.72rem",color:C.muted,marginTop:2 }}>
                          {fmtBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()}
                          {f.textContent && <span style={{ color:C.cyan }}> · 🤖 AI readable</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex",gap:6,flexShrink:0,alignItems:"center" }}>
                        <PrimaryButton small onClick={()=>setViewNote(f)}>👁 View</PrimaryButton>
                        {f.dataUrl && (
                          <a href={f.dataUrl} download={f.name}>
                            <GhostButton small>📥 Download</GhostButton>
                          </a>
                        )}
                        <button onClick={()=>deleteFile(f.id)} style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"1rem",padding:"0 2px" }} onMouseEnter={e=>e.currentTarget.style.color=C.red} onMouseLeave={e=>e.currentTarget.style.color=C.muted}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════ AI TUTOR PAGE ════════════ */}
          {page==="ai" && (
            <div className="fade-up" style={{ padding:"24px 28px", height:"calc(100vh - 62px)", display:"flex", flexDirection:"column" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 268px", gap:18, flex:1, minHeight:0 }}>

                {/* chat panel */}
                <Card style={{ padding:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                  {/* chat header */}
                  <div style={{ padding:"13px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10 }}>
                    <div style={{ width:32,height:32,background:`linear-gradient(135deg,${C.blue},${C.purple})`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🤖</div>
                    <div>
                      <div style={{ fontSize:"0.87rem",fontWeight:600 }}>ScholarSphere AI Tutor</div>
                      <div style={{ fontSize:"0.68rem",color:C.green }}>● Live · Web search + Notes context active</div>
                    </div>
                  </div>
                  {/* quick prompts */}
                  <div style={{ padding:"8px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",flexWrap:"wrap",gap:5 }}>
                    {["Explain this unit","Give practice questions","Summarize my notes","Key exam topics","Solve step-by-step","Compare concepts"].map(p=>(
                      <button key={p} onClick={()=>setChatInput(p)}
                        style={{ background:C.surf2,border:`1px solid ${C.border}`,padding:"4px 10px",borderRadius:18,fontSize:"0.72rem",color:C.muted2,cursor:"pointer",transition:"all 0.15s" }}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.color=C.blue;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted2;}}>
                        {p}
                      </button>
                    ))}
                  </div>
                  {/* messages */}
                  <div ref={chatRef} style={{ flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12 }}>
                    {messages.map((m,i) => (
                      <div key={i} style={{ maxWidth:"82%", alignSelf:m.role==="user"?"flex-end":"flex-start" }}>
                        {m.role==="ai" && <div style={{ fontSize:"0.67rem",color:C.cyan,fontWeight:600,marginBottom:4 }}>🤖 ScholarSphere AI</div>}
                        <div style={{ padding:"11px 15px", borderRadius:m.role==="user"?"13px 13px 3px 13px":"3px 13px 13px 13px",
                          background:m.role==="user"?`linear-gradient(135deg,${C.blue},${C.purple})`:C.surf2,
                          border:m.role==="ai"?`1px solid ${C.border}`:"none",
                          fontSize:"0.87rem", lineHeight:1.68, color:C.text }}
                          dangerouslySetInnerHTML={{__html:m.text
                            .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
                            .replace(/\*(.+?)\*/g,"<em>$1</em>")
                            .replace(/`(.+?)`/g,`<code style="background:rgba(255,255,255,0.08);padding:2px 5px;border-radius:4px;font-size:0.82em">$1</code>`)
                            .replace(/\n/g,"<br/>")}}/>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ alignSelf:"flex-start",background:C.surf2,border:`1px solid ${C.border}`,padding:"12px 16px",borderRadius:"3px 13px 13px 13px" }}>
                        <div style={{ fontSize:"0.67rem",color:C.cyan,fontWeight:600,marginBottom:6 }}>🤖 Searching web + reading notes…</div>
                        <div style={{ display:"flex",gap:5,alignItems:"center" }}>
                          {[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:C.blue,animation:`pulse 1.4s ${i*0.2}s infinite` }}/>)}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* input */}
                  <div style={{ padding:"12px",borderTop:`1px solid ${C.border}`,display:"flex",gap:9 }}>
                    <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
                      placeholder="Ask about your notes, any topic, or get practice questions…"
                      style={{ flex:1,background:C.surf2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontFamily:"'Outfit',sans-serif",fontSize:"0.88rem",outline:"none" }}/>
                    <button onClick={sendMessage} disabled={chatLoading||!chatInput.trim()}
                      style={{ background:chatLoading||!chatInput.trim()?C.border:`linear-gradient(135deg,${C.blue},${C.purple})`,border:"none",borderRadius:10,padding:"10px 16px",color:"#fff",cursor:chatLoading||!chatInput.trim()?"not-allowed":"pointer",fontSize:"1rem",transition:"all 0.2s" }}>
                      ➤
                    </button>
                  </div>
                </Card>

                {/* right sidebar */}
                <div style={{ display:"flex",flexDirection:"column",gap:13,overflowY:"auto" }}>
                  <Card>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:"0.88rem",marginBottom:12 }}>📌 Context</div>
                    <div style={{ fontSize:"0.78rem",color:C.muted2,marginBottom:8 }}>Focus AI on a specific unit:</div>
                    <Select value={aiContext} onChange={e=>setAiContext(e.target.value)}>
                      <option value="">All subjects + global notes</option>
                      {units.map(u=><option key={u.id} value={u.id}>{u.code} – {u.title}</option>)}
                    </Select>
                    {aiContext && (()=>{
                      const u=units.find(x=>x.id==aiContext);
                      const n=(u?.unitFiles||[]).filter(f=>f.textContent).length;
                      return u && (
                        <div style={{ marginTop:9,padding:10,background:C.surf2,borderRadius:8,fontSize:"0.76rem",color:C.muted2 }}>
                          <div style={{ color:C.cyan,fontWeight:600,marginBottom:3 }}>{u.code} – {u.title}</div>
                          <div>{n} readable note{n!==1?"s":""} available to AI</div>
                        </div>
                      );
                    })()}
                  </Card>

                  <Card>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:"0.88rem",marginBottom:10 }}>💡 AI Can Do</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:7,fontSize:"0.78rem",color:C.muted2 }}>
                      {["🔍 Live web search","📄 Read your uploaded notes","📝 Generate practice questions","🧮 Step-by-step solving","🎯 Predict exam topics","📋 Summarise content","💬 Explain difficult concepts","🌍 Research any topic"].map(x=><div key={x}>{x}</div>)}
                    </div>
                  </Card>

                  <Card>
                    <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:"0.88rem",marginBottom:10 }}>📄 Notes Loaded</div>
                    <div style={{ fontSize:"0.76rem",color:C.muted2,display:"flex",flexDirection:"column",gap:5 }}>
                      <div>Global: <span style={{ color:C.text }}>{files.filter(f=>f.textContent).length}</span> readable file{files.filter(f=>f.textContent).length!==1?"s":""}</div>
                      {aiContext && <div>Unit: <span style={{ color:C.text }}>{(units.find(u=>u.id==aiContext)?.unitFiles||[]).filter(f=>f.textContent).length}</span> readable files</div>}
                    </div>
                    <div style={{ marginTop:10,fontSize:"0.73rem",color:C.muted }}>
                      Upload .txt or .md files to make them readable by AI
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ════════════ TUTORIALS PAGE ════════════ */}
          {page==="tutorials" && (
            <div className="fade-up" style={{ padding:"24px 28px" }}>
              {units.length===0 ? (
                <div style={{ textAlign:"center",padding:"64px 24px" }}>
                  <div style={{ fontSize:52,marginBottom:14,opacity:0.3 }}>▶️</div>
                  <h3 style={{ fontFamily:"'Syne',sans-serif",color:C.muted2,marginBottom:8 }}>No Units Yet</h3>
                  <p style={{ color:C.muted,fontSize:"0.88rem",marginBottom:24 }}>Add units first to get YouTube tutorial suggestions based on your notes and tags.</p>
                  <PrimaryButton onClick={()=>{setPage("units");setShowAddUnit(true);}}>➕ Add Unit</PrimaryButton>
                </div>
              ) : (
                units.map(unit => (
                  <div key={unit.id} style={{ marginBottom:30 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14 }}>
                      <div style={{ background:`linear-gradient(135deg,${C.blue},${C.purple})`,color:"#fff",fontSize:"0.7rem",fontWeight:700,padding:"3px 9px",borderRadius:5,fontFamily:"'Syne',sans-serif" }}>{unit.code}</div>
                      <h4 style={{ fontFamily:"'Syne',sans-serif",fontSize:"0.98rem",fontWeight:700 }}>{unit.title}</h4>
                      {(unit.unitFiles||[]).length>0 && <Pill color="cyan">📄 {unit.unitFiles.length} notes</Pill>}
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:11 }}>
                      {ytSuggestionsFromUnit(unit).slice(0,3).map(video => (
                        <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer">
                          <div style={{ background:C.surf2,border:`1px solid ${C.border}`,borderRadius:11,overflow:"hidden",cursor:"pointer",transition:"all 0.2s" }}
                            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.transform="translateY(-2px)";}}
                            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
                            <div style={{ background:`linear-gradient(135deg,${C.surf},${C.border})`,height:90,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",fontSize:32 }}>
                              📺
                              <div style={{ position:"absolute",width:38,height:38,background:"rgba(255,0,0,0.9)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff" }}>▶</div>
                            </div>
                            <div style={{ padding:"9px 12px" }}>
                              <div style={{ fontSize:"0.8rem",fontWeight:500,lineHeight:1.4,color:C.text,marginBottom:3 }}>{video.title}</div>
                              <div style={{ fontSize:"0.7rem",color:C.muted }}>Search on YouTube</div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>{/* end content area */}

        {/* ═══ ADD UNIT MODAL ═══ */}
        <Modal open={showAddUnit} onClose={()=>setShowAddUnit(false)} title="➕ Register a New Unit">
          <FormGroup label="Unit Code">
            <Input value={uCode} onChange={e=>setUCode(e.target.value)} placeholder="e.g. CS301, MAT201, BIO102"/>
          </FormGroup>
          <FormGroup label="Unit Title *">
            <Input value={uTitle} onChange={e=>setUTitle(e.target.value)} placeholder="e.g. Data Structures & Algorithms"/>
          </FormGroup>
          <FormGroup label="Description">
            <textarea value={uDesc} onChange={e=>setUDesc(e.target.value)} placeholder="Brief description of what this unit covers…" rows={3}
              style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px 14px",color:C.text,fontFamily:"'Outfit',sans-serif",fontSize:"0.92rem",outline:"none",resize:"vertical",lineHeight:1.65,boxSizing:"border-box" }}/>
          </FormGroup>
          <FormGroup label="Topics / Tags" hint="Separate with commas — used to suggest YouTube tutorials">
            <Input value={uTags} onChange={e=>setUTags(e.target.value)} placeholder="e.g. algorithms, sorting, trees, graphs"/>
          </FormGroup>
          {uTags && (
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:14 }}>
              {uTags.split(",").map(t=>t.trim()).filter(Boolean).map(t=><Pill key={t} color="blue">#{t}</Pill>)}
            </div>
          )}
          {uErr && <Alert type="error">{uErr}</Alert>}
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end",marginTop:4 }}>
            <GhostButton onClick={()=>setShowAddUnit(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={addUnit}>✅ Register Unit</PrimaryButton>
          </div>
        </Modal>

        {/* ═══ ADD SCORE MODAL ═══ */}
        <Modal open={showAddScore} onClose={()=>setShowAddScore(false)} title={`📊 Add Score — ${scoreTarget?.title||""}`}>
          <FormGroup label="Assessment Type">
            <Select value={sType} onChange={e=>setSType(e.target.value)}>
              {["CAT 1","CAT 2","Assignment 1","Assignment 2","Mid-Semester Exam","Final Exam","Quiz","Project","Lab Report","Presentation"].map(t=><option key={t}>{t}</option>)}
            </Select>
          </FormGroup>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <FormGroup label="Score Obtained">
              <Input value={sVal} onChange={e=>setSVal(e.target.value)} placeholder="e.g. 72" style={{ textAlign:"center" }}/>
            </FormGroup>
            <FormGroup label="Out Of (Total)">
              <Input value={sOf} onChange={e=>setSOf(e.target.value)} placeholder="100" style={{ textAlign:"center" }}/>
            </FormGroup>
          </div>
          {sVal && sOf && !isNaN(parseFloat(sVal)) && !isNaN(parseFloat(sOf)) && (
            <div style={{ background:`rgba(${parseFloat(sVal)/parseFloat(sOf)>=0.7?"16,185,129":"245,158,11"},0.1)`,border:`1px solid rgba(${parseFloat(sVal)/parseFloat(sOf)>=0.7?"16,185,129":"245,158,11"},0.3)`,borderRadius:9,padding:"10px 14px",marginBottom:14,textAlign:"center" }}>
              <span style={{ fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:"1.4rem",color:gradeColor((parseFloat(sVal)/parseFloat(sOf))*100) }}>
                {gradeLabel((parseFloat(sVal)/parseFloat(sOf))*100)}
              </span>
              <span style={{ color:C.muted2,fontSize:"0.85rem",marginLeft:8 }}>
                {((parseFloat(sVal)/parseFloat(sOf))*100).toFixed(1)}%
              </span>
            </div>
          )}
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <GhostButton onClick={()=>setShowAddScore(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={saveScore}>✅ Save Score</PrimaryButton>
          </div>
        </Modal>

        {/* ═══ NOTE VIEWER ═══ */}
        {viewNote && <NoteViewerModal note={viewNote} onClose={()=>setViewNote(null)}/>}

        {/* ═══ TOAST ═══ */}
        {toast && (
          <div className="fade-up" style={{ position:"fixed",bottom:24,right:24,background:C.surf,border:`1px solid ${C.border}`,borderRadius:11,padding:"12px 20px",fontSize:"0.87rem",color:C.text,zIndex:9999,boxShadow:"0 8px 40px rgba(0,0,0,0.5)",maxWidth:320 }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROOT  — session check → auth → app | admin
═══════════════════════════════════════════════════════════ */
export default function Root() {
  const [screen,    setScreen]    = useState("loading"); // loading | auth | app | admin
  const [user,      setUser]      = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminEmail,setAdminEmail]= useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminErr,  setAdminErr]  = useState("");

  useEffect(() => {
    (async () => {
      try {
        const sess = await sGet(K_SESSION);
        if (sess?.email && sess?.pass) {
          const users = await sGet(K_USERS, []);
          const u = users.find(x => x.email===sess.email && x.pass===sess.pass);
          if (u) { setUser(u); setScreen("app"); return; }
        }
      } catch {}
      setScreen("auth");
    })();
  }, []);

  async function handleLogin(u)  { setUser(u); setScreen("app"); }
  async function handleLogout()  { await sSet(K_SESSION, null); setUser(null); setScreen("auth"); }

  function tryAdmin() {
    if (adminEmail===ADMIN_EMAIL && adminPass===ADMIN_PASS) {
      setShowAdmin(false); setScreen("admin");
    } else {
      setAdminErr("Invalid admin credentials.");
    }
  }

  /* loading splash */
  if (screen==="loading") return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:24, fontFamily:"'Outfit',sans-serif" }}>
      <style>{STYLES}</style>
      <div style={{ width:64,height:64,background:`linear-gradient(135deg,${C.blue},${C.purple})`,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,boxShadow:`0 0 50px rgba(59,130,246,0.4)` }}>🎓</div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontFamily:"'Syne',sans-serif",fontSize:"1.6rem",fontWeight:800,background:`linear-gradient(135deg,#fff,${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>ScholarSphere</div>
        <div style={{ color:C.muted,fontSize:"0.82rem",marginTop:4 }}>Loading your account…</div>
      </div>
      <Spinner size={28} color={C.blue}/>
    </div>
  );

  if (screen==="admin") return <AdminPanel onExit={()=>setScreen("auth")}/>;
  if (screen==="app" && user) return <MainApp user={user} onLogout={handleLogout}/>;

  return (
    <div style={{ position:"relative" }}>
      <style>{STYLES}</style>
      <AuthScreen onLogin={handleLogin}/>

      {/* admin access button (bottom corner) */}
      <button onClick={()=>setShowAdmin(true)}
        style={{ position:"fixed",bottom:20,right:20,background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.25)",color:"#fca5a5",borderRadius:9,padding:"7px 14px",fontSize:"0.74rem",cursor:"pointer",fontFamily:"'Outfit',sans-serif",fontWeight:600,backdropFilter:"blur(8px)",zIndex:500 }}>
        🔐 Admin Access
      </button>

      {/* admin login modal */}
      <Modal open={showAdmin} onClose={()=>{setShowAdmin(false);setAdminErr("");}} title="🔐 Developer Admin Login">
        <FormGroup label="Admin Email">
          <Input value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@email.com" type="email"/>
        </FormGroup>
        <FormGroup label="Admin Password">
          <Input value={adminPass} onChange={e=>setAdminPass(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e=>e.key==="Enter"&&tryAdmin()}/>
        </FormGroup>
        {adminErr && <Alert type="error">{adminErr}</Alert>}
        <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
          <GhostButton onClick={()=>{setShowAdmin(false);setAdminErr("");}}>Cancel</GhostButton>
          <PrimaryButton danger onClick={tryAdmin}>🔐 Enter Admin Panel</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}
