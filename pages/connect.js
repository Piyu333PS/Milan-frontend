"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import io from "socket.io-client";

export default function ConnectPage() {
  // ====== STATE ======
  const [profile, setProfile] = useState({
    name: "", contact: "", photoDataUrls: [], interests: [],
    age: "", city: "", language: "", bio: ""
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [statusMessage, setStatusMessage] = useState("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");

  // diya count (SSR safe)
  const [diyaCount, setDiyaCount] = useState(7);

  // sockets + fx
  const fwRef = useRef({ raf: null, burst: () => {}, cleanup: null });
  const socketRef = useRef(null);
  const partnerRef = useRef(null);
  const connectingRef = useRef(false);
  const backendUrl = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL || "https://milan-j9u9.onrender.com",
    []
  );

  // ====== INIT PROFILE ======
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

  // ====== HEARTS BG ======
  useEffect(() => {
    const cvs = document.getElementById("heartsCanvas");
    if (!cvs) return; const ctx = cvs.getContext("2d"); if (!ctx) return;
    let W, H, rafId, dpr = Math.max(1, window.devicePixelRatio || 1), items = [];
    function resize(){ W=cvs.width=Math.round(innerWidth*dpr); H=cvs.height=Math.round(innerHeight*dpr); cvs.style.width=innerWidth+"px"; cvs.style.height=innerHeight+"px"; ctx.setTransform(dpr,0,0,dpr,0,0); } resize();
    addEventListener("resize", resize);
    function spawn(){ const small=innerWidth<760; const size=(small?6:10)+Math.random()*(small?16:22);
      items.push({x:Math.random()*innerWidth,y:innerHeight+size,s:size,v:(small?0.5:0.9)+Math.random()*(small?0.6:0.9),c:["#ff6ea7","#ff8fb7","#ff4d6d","#e6007a"][Math.floor(Math.random()*4)]});
    }
    function draw(){ ctx.clearRect(0,0,W,H);
      items.forEach(h=>{ ctx.save(); ctx.globalAlpha=.9; ctx.translate(h.x,h.y); ctx.rotate(Math.sin(h.y/40)*.03);
        ctx.fillStyle=h.c; const s=h.s; ctx.beginPath(); ctx.moveTo(0,0); ctx.bezierCurveTo(s/2,-s,s*1.5,s/3,0,s); ctx.bezierCurveTo(-s*1.5,s/3,-s/2,-s,0,0); ctx.fill(); ctx.restore(); h.y-=h.v; });
      items=items.filter(h=>h.y+h.s>-40);
      if(Math.random()<(innerWidth<760?0.06:0.12)) spawn(); rafId=requestAnimationFrame(draw);
    } draw();
    return ()=>{ cancelAnimationFrame(rafId); removeEventListener("resize", resize); };
  }, []);

  // ====== FIREWORKS (full spread) ======
  useEffect(() => { startFireworks(); return stopFireworks; }, []);
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
      if(Math.random()<0.02) burst(rand(W*.05,W*.95),rand(H*.12,H*.9));
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

  // ====== MATCHING ======
  function startSearch(type){
    if(isSearching||connectingRef.current) return;
    connectingRef.current=true;
    setIsSearching(true); setShowLoader(true);
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
          if(!roomCode){ setTimeout(()=>stopSearch(),800); return; }
          sessionStorage.setItem("partnerData",JSON.stringify(partnerRef.current));
          sessionStorage.setItem("roomCode",roomCode);
          localStorage.setItem("lastRoomCode",roomCode);
          setStatusMessage("💖 Milan Successful!");
          setTimeout(()=>{ window.location.href = type==="video"?"/video":"/chat"; },120);
        }catch(e){ setTimeout(()=>stopSearch(),500); }
      });
      socketRef.current.on("partnerDisconnected",()=>{ alert("Partner disconnected."); stopSearch(); });
      socketRef.current.on("connect_error",()=>{ alert("Connection error. Please try again."); stopSearch(); });
    }catch(e){ alert("Something went wrong starting the search."); stopSearch(); }
    finally{ setTimeout(()=>{ connectingRef.current=false; },300); }
  }
  function stopSearch(){
    if(socketRef.current){
      try{ socketRef.current.emit("disconnectByUser"); socketRef.current.disconnect(); }catch{}
      try{ socketRef.current.removeAllListeners && socketRef.current.removeAllListeners(); }catch{}
      socketRef.current=null;
    }
    setIsSearching(false); setShowLoader(false);
    setStatusMessage("❤️ जहाँ दिल मिले, वहीं होती है शुरुआत Milan की…");
  }

  // ====== UI HELPERS ======
  function completeness(p=profile){
    let s=0; if(p.name) s+=18; if(p.contact) s+=12; if(p.age) s+=10; if(p.city) s+=10; if(p.language) s+=10; if(p.bio) s+=15;
    if((p.interests||[]).length) s+=15; if((p.photoDataUrls||[]).length) s+=Math.min(10, p.photoDataUrls.length*4);
    return Math.min(100,Math.round(s));
  }
  const percent = completeness(profile);

  // ====== SET DIYA COUNT (client only) ======
  useEffect(() => {
    function setCount() {
      const w = window.innerWidth;
      setDiyaCount(w > 1200 ? 9 : w > 760 ? 7 : 5);
    }
    setCount();
    window.addEventListener("resize", setCount);
    return () => window.removeEventListener("resize", setCount);
  }, []);

  return (
    <>
      <Head>
        <title>Milan — Connect</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Poppins:wght@300;400;600;700;900&display=swap" rel="stylesheet"/>
      </Head>

      {/* Gold frame (sidebar offset fixed) */}
      <div className="frame" aria-hidden />

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
          <li>👤 Profile Info</li>
          <li>🔒 Security</li>
          <li>💘 Love Calculator</li>
          <li onClick={()=>{ localStorage.clear(); window.location.href='/login'; }}>🚪 Logout</li>
        </ul>
      </aside>

      {/* HERO — static no-scroll */}
      <main className="heroWrap">
        {/* Big stylish brand (center, large) */}
        <div className="heroBrand">Milan</div>
        <h3 className="brandTagline">Where hearts connect ❤️</h3>

        <h2 className="diwaliHead">
          🌟 Wishing you a sparkling Diwali full of love, light, and unforgettable connections – from all of us at Milan 💞
        </h2>
        <p className="lead">
          “Diye ki roshni jaise andheron ko mita deti hai, waise hi <b>Milan</b> aapke dil ki tanhayi mita dega.
          Is Diwali, connect karo aur ek nayi kahani shuru karo.”
        </p>

        <div className="ctaRow">
          <button className="cta ghost"   onClick={()=>startSearch('text')}>💬 Start Text Chat</button>
          <button className="cta primary" onClick={()=>startSearch('video')}>🎥 Start Video Chat</button>
          <a href="/studio" className="cta outline">🎨 Milan AI Studio</a>

          {/* Celebrate with badge */}
          <div className="celeBox">
            <span className="pill">🪔 Diwali Special</span>
            <button className="cta gold" onClick={()=>{
              const a=document.getElementById("bellAudio"); try{ a.currentTime=0; a.play(); }catch{}
              const {burst}=fwRef.current; const x=innerWidth/2,y=innerHeight*0.55;
              for(let i=0;i<5;i++) setTimeout(()=>burst(x+(Math.random()*220-110),y+(Math.random()*120-60)),i*140);
            }}>🎆 Let’s Celebrate Diwali</button>
          </div>
        </div>

        {showLoader && <div className="status">{statusMessage}</div>}

        {/* Diyas — centered & more lamps */}
        <div className="diyas">
          {Array.from({ length: diyaCount }).map((_, i) => (
            <div key={i} className="diya">
              <div className="bowl"/><div className="oil"/>
              <div className="flame" style={{animationDuration: `${1.2 + (i % 4) * 0.2}s`}}/>
            </div>
          ))}
        </div>
      </main>

      {/* STYLES */}
      <style>{`
        :root{ --bg:#07070c; --rose:#ff6ea7; --rose2:#ff9fb0; --gold:#ffd166; }
        html,body{ margin:0; padding:0; height:100%; overflow:hidden;
          background:
            radial-gradient(1200px 600px at 20% 10%, rgba(255,110,167,.10), transparent 60%),
            radial-gradient(900px 500px at 90% 20%, rgba(255,110,167,.06), transparent 60%),
            #08060c; color:#f7f7fb; font-family:Poppins, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        #heartsCanvas,#fxCanvas{ position:fixed; inset:0; pointer-events:none; z-index:1; }

        /* Gold frame — thicker, dual line, glow; left offset after sidebar */
        .frame{ position:fixed; top:10px; bottom:10px; right:10px; left:210px; z-index:2; pointer-events:none; }
        .frame::before, .frame::after{
          content:""; position:absolute; inset:0; border-radius:18px;
        }
        .frame::before{
          padding:2px; background:linear-gradient(135deg, rgba(255,209,102,.9), rgba(255,209,102,.45) 40%, rgba(255,110,167,.55), rgba(255,209,102,.9));
          -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite:xor; mask-composite:exclude; box-shadow:0 0 24px rgba(255,209,102,.32), 0 0 46px rgba(255,110,167,.2);
          border-radius:18px;
        }
        .frame::after{ inset:8px; border:2px solid rgba(255,209,102,.6); border-radius:14px; box-shadow:0 0 20px rgba(255,209,102,.28) inset; }

        .sidebar{ position:fixed; left:0; top:0; bottom:0; width:200px; background:rgba(255,255,255,.04);
          backdrop-filter:blur(8px); border-right:1px solid rgba(255,255,255,.06); z-index:5; display:flex; flex-direction:column; align-items:center; padding-top:18px; }
        .avatarWrap{ width:70px; height:70px; border-radius:50%; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,.35); }
        .name{ margin-top:8px; font-weight:800; }
        .meter{ width:140px; height:8px; background:rgba(255,255,255,.1); border-radius:8px; margin-top:6px; overflow:hidden; }
        .meter .bar{ height:100%; background:linear-gradient(90deg,var(--rose),var(--rose2)); }
        .photoPick{ margin-top:8px; font-size:12px; color:#fff; background:rgba(255,255,255,.08); padding:6px 10px; border-radius:8px; cursor:pointer; }
        .nav{ list-style:none; padding:0; width:100%; margin-top:18px; }
        .nav li{ padding:10px 14px; margin:6px 12px; border-radius:12px; background:rgba(255,255,255,.04); cursor:pointer; font-weight:700; }

        /* Full-height hero — CENTER everything, no scroll */
        .heroWrap{
          position:relative; margin-left:200px; z-index:3;
          height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:140px 12px 110px; /* extra top padding to avoid any crop */
          gap:10px;
        }

        /* Big Milan brand in center with gold gradient + glow */
        .heroBrand{
          position:absolute; top:96px; /* pushed down to prevent cut */
          text-align:center;
          font-family:'Great Vibes', cursive; font-size:120px; line-height:1.02;
          background: linear-gradient(180deg, #fff5cc, #ffd166 48%, #f3b03f);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          text-shadow: 0 0 22px rgba(255,209,102,.35), 0 0 40px rgba(255,110,167,.15);
          pointer-events:none;
        }

        /* New tagline under logo */
        .brandTagline{
          margin-top:32px;
          font-size:20px; font-weight:600; letter-spacing:.02em; text-align:center;
          background: linear-gradient(90deg, #ffd166, #ffb6c1);
          -webkit-background-clip:text; background-clip:text; color:transparent;
          text-shadow: 0 0 10px rgba(255,209,102,.18);
          font-style: italic;
        }

        .diwaliHead{
          margin:4px 0 0 0; max-width:980px;
          font-size:30px; font-weight:900; color:#ffe9ac;
          text-shadow:0 0 18px rgba(255,209,102,.22); letter-spacing:.3px; text-align:center;
        }
        .lead{ max-width:880px; text-align:center; color:#e9e5ef; opacity:.95; font-weight:600; }

        .ctaRow{ display:flex; gap:14px; margin-top:6px; flex-wrap:wrap; justify-content:center; align-items:flex-end; }
        .cta{
          padding:14px 18px; border-radius:14px; font-weight:900; border:0;
          cursor:pointer; display:inline-flex; align-items:center; justify-content:center; text-decoration:none;
          transition:transform .14s ease, box-shadow .14s ease, filter .14s ease;
        }
        .cta:hover{ transform: translateY(-2px); filter: brightness(1.02); }
        .cta:active{ transform: scale(.96); box-shadow: inset 0 0 0 9999px rgba(0,0,0,.05); }
        .cta:focus-visible{ outline: 3px solid rgba(255,209,102,.6); outline-offset: 2px; }

        .cta.primary{ background:linear-gradient(90deg,var(--rose),var(--rose2)); color:#0a0b12; box-shadow:0 10px 34px rgba(255,110,167,.25); }
        .cta.ghost{ background:rgba(255,255,255,.07); color:#fff; border:1px solid rgba(255,255,255,.14); }
        .cta.outline{ background:transparent; color:#fff; border:2px solid rgba(255,110,167,.45); box-shadow:0 0 0 2px rgba(255,110,167,.12) inset; }
        .cta.gold{ background:rgba(255,209,102,.18); color:#ffe9ac; border:1px solid rgba(255,209,102,.4); box-shadow:0 12px 36px rgba(255,209,102,.18); }

        .celeBox{ display:flex; flex-direction:column; align-items:center; gap:6px; }
        .pill{ font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#2a1a00;
          background:linear-gradient(90deg,#ffd166,#ffe9ac); padding:5px 10px; border-radius:999px; box-shadow:0 6px 18px rgba(255,209,102,.25); }

        .status{ margin-top:6px; font-weight:800; color:#fff; animation:blink 1s infinite; }
        @keyframes blink{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}

        /* Diyas (centered, many) */
        .diyas{ position:fixed; left:0; right:0; bottom:12px; display:flex; gap:22px; justify-content:center; align-items:flex-end; pointer-events:none; z-index:4; flex-wrap:wrap; }
        .diya{ position:relative; width:64px; height:42px; filter: drop-shadow(0 6px 14px rgba(255,128,0,.35)); }
        .bowl{ position:absolute; inset:auto 0 0 0; height:30px; border-radius:0 0 36px 36px / 0 0 22px 22px; background:radial-gradient(120% 140% at 50% -10%, #ffb86b, #8b2c03 60%); border-top:2px solid rgba(255,255,255,.25); }
        .oil{ position:absolute; left:8px; right:8px; bottom:18px; height:8px; border-radius:6px; background: linear-gradient(#5a1b00,#2b0a00); }
        .flame{ position:absolute; left:50%; bottom:26px; width:18px; height:26px; transform:translateX(-50%); background: radial-gradient(50% 65% at 50% 60%, #fff7cc 0%, #ffd166 55%, #ff8c00 75%, rgba(255,0,0,0) 80%); border-radius: 12px 12px 14px 14px / 18px 18px 8px 8px; animation: flicker 1.4s infinite ease-in-out; box-shadow: 0 0 18px 6px rgba(255,173,51,.45), 0 0 36px 12px rgba(255,140,0,.15); }
        .flame:before{ content:""; position:absolute; inset:4px; border-radius:inherit; background: radial-gradient(circle at 50% 70%, #fffbe6, rgba(255,255,255,0) 66%); filter: blur(1px); }

        /* MOBILE */
        @media(max-width:1024px){
          .frame{ left:12px; right:12px; }
          .heroBrand{ top:110px; font-size:96px; }
        }
        @media(max-width:860px){
          .sidebar{display:none;} /* mobile me clean hero */
          .heroWrap{ margin-left:0; padding-top:150px; }
        }
        @media(max-width:520px){
          .diwaliHead{font-size:22px;}
          .cta{width:100%;}
          .heroBrand{ font-size:72px; top:120px; }
          .brandTagline{ font-size:16px; margin-top:28px; }
        }
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
