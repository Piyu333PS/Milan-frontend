"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

export default function ConnectPage() {
  // ====== STATE ======
  const [showProfile, setShowProfile] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showLoveCalc, setShowLoveCalc] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [profile, setProfile] = useState({
    name: "", contact: "", photoDataUrls: [], interests: [],
    age: "", city: "", language: "", bio: ""
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [modeText, setModeText] = useState("");
  const [statusMessage, setStatusMessage] = useState("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");

  // Diwali wish modal (kept)
  const [showWish, setShowWish] = useState(false);
  const [wishDone, setWishDone] = useState(false);
  const [wish, setWish] = useState("");

  // BG
  const fwRef = useRef({ raf: null, burst: () => {}, cleanup: null });

  // backend/socket
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com",
    []
  );

  // ====== EFFECTS ======
  useEffect(() => {
    try {
      const saved = localStorage.getItem("milan_profile");
      if (saved) {
        const p = JSON.parse(saved);
        setProfile(prev => ({ ...prev, ...p, photoDataUrls: p.photoDataUrls || [], interests: p.interests || [] }));
      } else {
        const registeredName = localStorage.getItem("registered_name") || "";
        const registeredContact = localStorage.getItem("registered_contact") || "";
        setProfile(p => ({ ...p, name: registeredName, contact: registeredContact }));
      }
    } catch {}
  }, []);

  // hearts background
  useEffect(() => {
    const cvs = document.getElementById("heartsCanvas");
    if (!cvs) return; const ctx = cvs.getContext("2d"); if (!ctx) return;
    let W, H, rafId, dpr = Math.max(1, window.devicePixelRatio || 1), items = [];
    function resize(){ W=cvs.width=Math.round(innerWidth*dpr); H=cvs.height=Math.round(innerHeight*dpr); cvs.style.width=innerWidth+"px"; cvs.style.height=innerHeight+"px"; ctx.setTransform(dpr,0,0,dpr,0,0); } resize();
    addEventListener("resize", resize);
    function spawn(){ const small=innerWidth<760; const size=(small?6:10)+Math.random()*(small?16:22); items.push({x:Math.random()*innerWidth,y:innerHeight+size,s:size,v:(small?0.5:0.9)+Math.random()*(small?0.6:0.9),c:["#ff6b81","#ff9fb0","#ff4d6d","#e6005c"][Math.floor(Math.random()*4)]}); }
    function draw(){ ctx.clearRect(0,0,W,H); items.forEach(h=>{ ctx.save(); ctx.globalAlpha=.95; ctx.translate(h.x,h.y); ctx.rotate(Math.sin(h.y/40)*.03); ctx.fillStyle=h.c; const s=h.s; ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(s/2,-s,s*1.5,s/3,0,s); ctx.bezierCurveTo(-s*1.5,s/3,-s/2,-s,0,0); ctx.fill(); ctx.restore(); h.y-=h.v; }); items=items.filter(h=>h.y+h.s>-40); if(Math.random()<(innerWidth<760?0.06:0.12)) spawn(); rafId=requestAnimationFrame(draw); } draw();
    return ()=>{ cancelAnimationFrame(rafId); removeEventListener("resize", resize); };
  }, []);

  // fireworks
  useEffect(() => { startFireworks(); return stopFireworks; }, []);

  // guard searching tab hidden
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && socketRef.current && isSearching) {
        try { socketRef.current.emit("disconnectByUser"); socketRef.current.disconnect(); } catch {}
        socketRef.current = null; setIsSearching(false); setShowLoader(false); setModeText("");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isSearching]);

  // ====== BG FIREWORKS ======
  function startFireworks(){
    const cvs=document.getElementById("fxCanvas"); if(!cvs) return;
    const ctx=cvs.getContext("2d"); let W,H,ents=[];
    function resize(){ W=cvs.width=innerWidth; H=cvs.height=innerHeight; }
    addEventListener("resize",resize); resize();
    function rand(a,b){return a+Math.random()*(b-a);}
    function hsv(h,s,v){ const f=(n,k=(n+h/60)%6)=>v-v*s*Math.max(Math.min(k,4-k,1),0); return `rgb(${(f(5)*255)|0},${(f(3)*255)|0},${(f(1)*255)|0})`; }
    function burst(x,y){ const n=60+((Math.random()*40)|0), hue=Math.random()*360;
      for(let i=0;i<n;i++){ const speed=rand(1.2,3.2); const ang=((Math.PI*2)*i)/n+rand(-0.03,0.03);
        ents.push({x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed-rand(0.2,0.6),life:rand(0.9,1.4),age:0,color:hsv(hue+rand(-20,20),0.9,1),r:rand(1,2.2)});
      } }
    function tick(){
      ctx.fillStyle="rgba(10,7,16,.22)"; ctx.fillRect(0,0,W,H);
      if(Math.random()<0.012) burst(rand(W*.1,W*.9),rand(H*.15,H*.55));
      ents=ents.filter(p=>((p.age+=0.016),p.age<p.life));
      for(const p of ents){ p.vy+=0.5*0.016; p.x+=p.vx; p.y+=p.vy; const a=1-p.age/p.life;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.color.replace("rgb","rgba").replace(")",`,`+a.toFixed(2)+`)`); ctx.fill();
      }
      fwRef.current.raf=requestAnimationFrame(tick);
    } tick();
    fwRef.current.burst=burst; fwRef.current.cleanup=()=>{ cancelAnimationFrame(fwRef.current.raf); removeEventListener("resize",resize); };
  }
  function stopFireworks(){ fwRef.current.cleanup && fwRef.current.cleanup(); }

  // ====== SEARCH / SOCKET ======
  function startSearch(type){
    if(isSearching||connectingRef.current) return;
    connectingRef.current=true;
    setIsSearching(true); setShowLoader(true);
    setModeText(type==="video"?"Video Chat":"Text Chat");
    setStatusMessage(type==="video"?"🎥 Searching for a Video Chat partner...":"💬 Searching for a Text Chat partner...");
    try{
      if(!socketRef.current||!socketRef.current.connected){
        socketRef.current=io(backendUrl,{transports:["websocket","polling"],reconnection:true,reconnectionAttempts:10,reconnectionDelay:800});
      }
      const token=localStorage.getItem("token")||"";
      socketRef.current.off&&socketRef.current.off("partnerFound");
      socketRef.current.off&&socketRef.current.off("partnerDisconnected");
      socketRef.current.off&&socketRef.current.off("connect_error");
      socketRef.current.emit("lookingForPartner",{type,token});

      socketRef.current.on("partnerFound",(data)=>{
        try{
          const roomCode=data?.roomCode||""; partnerRef.current=data?.partner||{};
          if(!roomCode){ setStatusMessage("Partner found but room creation failed. Trying again..."); setTimeout(()=>stopSearch(),800); return; }
          sessionStorage.setItem("partnerData",JSON.stringify(partnerRef.current));
          sessionStorage.setItem("roomCode",roomCode);
          localStorage.setItem("lastRoomCode",roomCode);
          setStatusMessage("💖 Milan Successful!");
          setTimeout(()=>{ window.location.href = type==="video"?"/video":"/chat"; },120);
        }catch(e){ console.error(e); setTimeout(()=>stopSearch(),500); }
      });
      socketRef.current.on("partnerDisconnected",()=>{ alert("Partner disconnected."); stopSearch(); });
      socketRef.current.on("connect_error",()=>{ alert("Connection error. Please try again."); stopSearch(); });
    }catch(e){ console.error(e); alert("Something went wrong starting the search."); stopSearch(); }
    finally{ setTimeout(()=>{ connectingRef.current=false; },300); }
  }
  function stopSearch(){
    if(socketRef.current){
      try{ socketRef.current.emit("disconnectByUser"); socketRef.current.disconnect(); }catch{}
      try{ socketRef.current.removeAllListeners && socketRef.current.removeAllListeners(); }catch{}
      socketRef.current=null;
    }
    setIsSearching(false); setShowLoader(false); setModeText("");
    setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
  }

  // ====== DIWALI ACTIONS ======
  function celebrate(){
    const a=document.getElementById("bellAudio"); try{ a.currentTime=0; a.play(); }catch{}
    const {burst}=fwRef.current; const x=innerWidth/2,y=innerHeight*0.3;
    for(let i=0;i<4;i++) setTimeout(()=>burst(x+(Math.random()*160-80),y+(Math.random()*80-40)),i*140);
  }
  function lightDiya(){ setWish(""); setWishDone(false); setShowWish(true); }
  function submitWish(){ setWishDone(true); const {burst}=fwRef.current; burst&&burst(innerHeight*.5, innerHeight*.32); }

  // ====== UI HELPERS ======
  function completeness(p=profile){
    let s=0; if(p.name) s+=18; if(p.contact) s+=12; if(p.age) s+=10; if(p.city) s+=10; if(p.language) s+=10; if(p.bio) s+=15;
    if((p.interests||[]).length) s+=15; if((p.photoDataUrls||[]).length) s+=Math.min(10, p.photoDataUrls.length*4);
    return Math.min(100,Math.round(s));
  }
  const percent = completeness(profile);

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Poppins:wght@300;400;600;700;900&display=swap" rel="stylesheet"/>
      </Head>

      {/* Backgrounds */}
      <canvas id="heartsCanvas"/>
      <canvas id="fxCanvas" style={{position:'fixed',inset:0,zIndex:1,pointerEvents:'none'}}/>
      <audio id="bellAudio" preload="auto">
        <source src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_4c76d6de8a.mp3?filename=soft-bell-ambient-10473.mp3" type="audio/mpeg"/>
      </audio>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="profileTop">
          <div className="avatarWrap"><Avatar /></div>
          <div className="name">{profile.name || "Pinky"}</div>
          <div className="meter"><div className="bar" style={{width:`${percent}%`}}/></div>
          <label htmlFor="photoPick" className="photoPick">Change / Add Photo</label>
          <input id="photoPick" type="file" accept="image/*" style={{display:'none'}}
            onChange={(e)=>{
              const f=e.target.files?.[0]; if(!f) return;
              const r=new FileReader();
              r.onload=(ev)=>{
                const du=ev.target?.result; const next=[...(profile.photoDataUrls||[])];
                if(next.length>=3) return alert('Max 3 photos');
                next.push(du); const p={...profile, photoDataUrls:next};
                setProfile(p); localStorage.setItem('milan_profile', JSON.stringify(p));
              };
              r.readAsDataURL(f); e.target.value='';
            }}/>
        </div>
        <ul className="nav">
          <li onClick={()=>{setShowProfile(true); setShowSecurity(false); setShowLoveCalc(false);}}>👤 Profile Info</li>
          <li onClick={()=>{setShowSecurity(true); setShowProfile(false); setShowLoveCalc(false);}}>🔒 Security</li>
          <li onClick={()=>{setShowLoveCalc(true); setShowProfile(false); setShowSecurity(false);}}>💘 Love Calculator</li>
          <li onClick={()=>setShowLogoutConfirm(true)}>🚪 Logout</li>
        </ul>
      </aside>

      {/* Main hero (clean badges + Hinglish quote) */}
      <main className="heroWrap">
        <div className="festiveHeader">🪔 Diwali Celebration with Milan 💖</div>
        <h1 className="brand">Milan</h1>
        <div className="divider"/>
        <h2 className="diwaliHead">Wish you a very Happy Diwali!</h2>
        <p className="lead">
          “Diye ki roshni jaise andheron ko mita deti hai, waise hi <b>Milan</b> aapke dil ki tanhayi mita dega.
          Is Diwali, connect karo aur ek nayi kahani shuru karo.” ✨
        </p>

        <div className="ctaRow">
          <button className="cta ghost"   onClick={()=>startSearch('text')}>💬 Start Text Chat</button>
          <button className="cta primary" onClick={()=>startSearch('video')}>🎥 Start Video Chat</button>

          {/* NEW: Milan AI Studio (goes to /studio) */}
          <a href="/studio" className="cta ghost">🎨 Milan AI Studio</a>

          <button className="cta gold"    onClick={celebrate}>🥳 Let’s Celebrate Diwali</button>
        </div>

        {showLoader && <div className="status">{statusMessage}</div>}

        {/* Inline AI section removed as per spec */}
        {/* <DiwaliAiStudio /> */}

        {/* Bottom diyas */}
        <div className="diyas">
          <div className="diya"><div className="bowl"/><div className="oil"/><div className="flame"/></div>
          <div className="diya"><div className="bowl"/><div className="oil"/><div className="flame" style={{animationDuration:'1.2s'}}/></div>
          <div className="diya"><div className="bowl"/><div className="oil"/><div className="flame" style={{animationDuration:'1.6s'}}/></div>
          <div className="diya"><div className="bowl"/><div className="oil"/><div className="flame" style={{animationDuration:'1.3s'}}/></div>
        </div>
      </main>

      {/* Wish Modal (unchanged) */}
      {showWish && (
        <div className="modalBack" onClick={(e)=>{ if(e.target.classList.contains('modalBack')) setShowWish(false); }}>
          <div className="modal">
            <h3>🪔 Make a Wish</h3>
            {!wishDone ? (<>
              <p>Close your eyes, type your wish, then light the diya. May it come true ✨</p>
              <textarea value={wish} onChange={(e)=>setWish(e.target.value)} placeholder="Type your Diwali wish..."/>
              <div className="actions">
                <button className="btn ghost" onClick={()=>setShowWish(false)}>Cancel</button>
                <button className="btn primary" onClick={submitWish}>Light the Diya</button>
              </div>
            </>) : (<>
              <p>Diya is lit 🔥 Your wish is released to the universe. Ab connection sachha mile! 💖</p>
              <div className="actions"><button className="btn primary" onClick={()=>setShowWish(false)}>Close</button></div>
            </>)}
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        :root{ --bg:#0a0b12; --rose:#ff6ea7; --rose2:#ff9fb0; --gold:#ffd166; }
        html,body{ margin:0; padding:0; height:100%; background:#0b0a12; color:#eef2ff; font-family:Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        #heartsCanvas,#fxCanvas{ position:fixed; inset:0; pointer-events:none; }

        .sidebar{ position:fixed; left:0; top:0; bottom:0; width:200px; background:rgba(255,255,255,.04); backdrop-filter:blur(8px); border-right:1px solid rgba(255,255,255,.06); z-index:5; display:flex; flex-direction:column; align-items:center; padding-top:18px; }
        .avatarWrap{ width:70px; height:70px; border-radius:50%; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,.35); }
        .name{ margin-top:8px; font-weight:800; }
        .meter{ width:140px; height:8px; background:rgba(255,255,255,.1); border-radius:8px; margin-top:6px; overflow:hidden; }
        .meter .bar{ height:100%; background:linear-gradient(90deg,var(--rose),var(--rose2)); }
        .photoPick{ margin-top:8px; font-size:12px; color:#fff; background:rgba(255,255,255,.08); padding:6px 10px; border-radius:8px; cursor:pointer; }
        .nav{ list-style:none; padding:0; width:100%; margin-top:18px; }
        .nav li{ padding:10px 14px; margin:6px 12px; border-radius:12px; background:rgba(255,255,255,.04); cursor:pointer; font-weight:700; }

        .heroWrap{ position:relative; margin-left:200px; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:24px 12px 120px; z-index:3; }
        .festiveHeader{ margin-top:8px; color:#ffe9ac; font-weight:800; letter-spacing:.12em; text-transform:uppercase; font-size:12px; opacity:.95; }
        .brand{ font-family:'Great Vibes', cursive; font-size:84px; margin:10px 0 6px; text-shadow:0 0 24px rgba(255,209,102,.35), 0 0 42px rgba(255,110,167,.18); }
        .divider{ width:min(760px,82vw); height:2px; background:linear-gradient(90deg, transparent, rgba(255,209,102,.65), transparent); margin:12px auto; }
        .diwaliHead{ margin:12px 0 6px; font-size:36px; font-weight:900; color:#ffe9ac; text-shadow:0 0 16px rgba(255,209,102,.22); }
        .lead{ max-width:820px; text-align:center; color:#cbd5e1; font-weight:600; }
        .ctaRow{ display:flex; gap:12px; margin-top:16px; flex-wrap:wrap; justify-content:center; }
        .cta{ padding:12px 16px; border-radius:12px; font-weight:900; border:0; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; }
        .cta.primary{ background:linear-gradient(90deg,var(--rose),var(--rose2)); color:#0a0b12; box-shadow:0 12px 40px rgba(255,110,167,.18); }
        .cta.gold{ background:rgba(255,209,102,.18); color:#ffe9ac; border:1px solid rgba(255,209,102,.35); box-shadow:0 12px 36px rgba(255,209,102,.18); }
        .cta.ghost{ background:rgba(255,255,255,.06); color:#fff; border:1px solid rgba(255,255,255,.12); }
        .status{ margin-top:10px; font-weight:800; color:#fff; animation:blink 1s infinite; }
        @keyframes blink{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}

        /* Diyas */
        .diyas{ position:fixed; left:0; right:0; bottom:16px; display:flex; gap:28px; justify-content:center; align-items:flex-end; pointer-events:none; z-index:4; }
        .diya{ position:relative; width:70px; height:44px; filter: drop-shadow(0 6px 14px rgba(255,128,0,.35)); }
        .bowl{ position:absolute; inset:auto 0 0 0; height:32px; border-radius:0 0 36px 36px / 0 0 24px 24px; background:radial-gradient(120% 140% at 50% -10%, #ffb86b, #8b2c03 60%); border-top:2px solid rgba(255,255,255,.25); }
        .oil{ position:absolute; left:8px; right:8px; bottom:18px; height:8px; border-radius:6px; background: linear-gradient(#5a1b00,#2b0a00); }
        .flame{ position:absolute; left:50%; bottom:28px; width:18px; height:28px; transform:translateX(-50%); background: radial-gradient(50% 65% at 50% 60%, #fff7cc 0%, #ffd166 55%, #ff8c00 75%, rgba(255,0,0,0) 80%); border-radius: 12px 12px 14px 14px / 18px 18px 8px 8px; animation: flicker 1.4s infinite ease-in-out; box-shadow: 0 0 18px 6px rgba(255,173,51,.45), 0 0 36px 12px rgba(255,140,0,.15); }
        .flame:before{ content:""; position:absolute; inset:4px; border-radius:inherit; background: radial-gradient(circle at 50% 70%, #fffbe6, rgba(255,255,255,0) 66%); filter: blur(1px); }

        @media(max-width:860px){ .brand{font-size:64px;} .lead{padding:0 12px;} }
        @media(max-width:720px){ .sidebar{position:static; width:100%; height:auto; flex-direction:row; gap:10px; justify-content:center; border:0; background:transparent;} .heroWrap{margin-left:0;} .nav{display:none;} .photoPick{display:none;} .meter{display:none;} }
      `}</style>
    </>
  );
}

// ===== Avatar =====
function Avatar(){
  const [profile,setProfile]=useState(null);
  useEffect(()=>{ (async()=>{ try{
    const uid=localStorage.getItem('uid'); const token=localStorage.getItem('token');
    if(!uid||!token) return; const res=await fetch(`/api/profile/${uid}`,{ headers:{ Authorization:`Bearer ${token}` } });
    if(!res.ok) throw new Error('fail'); const data=await res.json(); setProfile(data);
  }catch(e){ setProfile({name: localStorage.getItem('registered_name')||'M'}) } })(); },[]);
  if(!profile) return <div>Loading...</div>;
  const first=(profile.name?.trim()?.charAt(0).toUpperCase())||'M';
  return profile.avatar
    ? <img src={profile.avatar} alt="avatar" style={{width:70,height:70,borderRadius:'50%',objectFit:'cover'}}/>
    : <div style={{width:70,height:70,borderRadius:'50%',background:'#ec4899',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,fontWeight:700,color:'#fff'}}>{first}</div>;
}
