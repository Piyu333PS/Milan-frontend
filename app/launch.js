"use client";
import { useEffect, useRef, useState } from "react";

export default function LaunchPage() {
  const curtainRef = useRef(null);
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [curtainOpen, setCurtainOpen] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [sparkHearts, setSparkHearts] = useState([]);
  const [confetti, setConfetti] = useState([]);
  const [fireworksParticles, setFireworksParticles] = useState([]);

  // Handle Drag / Touch
  const handleStart = (clientY) => { setIsDragging(true); setStartY(clientY); };
  const handleMove = (clientY) => {
    if (!isDragging || curtainOpen) return;
    let diff = startY - clientY;
    if (diff < 0) diff = 0;
    curtainRef.current.style.transform = `translateY(${-diff}px)`;
  };
  const handleEnd = (clientY) => {
    if (!isDragging || curtainOpen) return;
    setIsDragging(false);
    let diff = startY - clientY;
    if (diff > window.innerHeight / 3) openCurtain();
    else curtainRef.current.style.transform = "translateY(0)";
  };

  const openCurtain = () => {
    curtainRef.current.style.transform = "translateY(-100%)";
    setCurtainOpen(true);
    startHearts();
    startSparkHearts();
    startFireworks();
    startConfetti();

    setTimeout(()=> window.location.href="/index.html", 7000);
  };

  // Event Handlers
  const onMouseDown = (e)=> handleStart(e.clientY);
  const onMouseMove = (e)=> handleMove(e.clientY);
  const onMouseUp = (e)=> handleEnd(e.clientY);
  const onTouchStart = (e)=> handleStart(e.touches[0].clientY);
  const onTouchMove = (e)=> handleMove(e.touches[0].clientY);
  const onTouchEnd = (e)=> handleEnd(e.changedTouches[0].clientY);

  // Hearts Animation
  const startHearts = () => {
    const arr = Array.from({length: 50}).map(()=>({
      id: Math.random(),
      left: Math.random()*window.innerWidth,
      top: window.innerHeight,
      x: Math.random()*600-300,
      y: -Math.random()*700-200
    }));
    setHearts(arr);
    setTimeout(()=> setHearts([]), 2500);
  };

  // Spark Hearts Trail
  const startSparkHearts = () => {
    const arr = Array.from({length:30}).map(()=>({
      id: Math.random(),
      left: Math.random()*window.innerWidth,
      top: window.innerHeight,
      speed: Math.random()*2+1
    }));
    setSparkHearts(arr);
    setTimeout(()=> setSparkHearts([]), 5000);
  };

  // Confetti
  const startConfetti = () => {
    const arr = Array.from({length: 80}).map(()=>({
      id: Math.random(),
      x: Math.random()*window.innerWidth,
      y: Math.random()*window.innerHeight/2,
      dx: Math.random()*6-3,
      dy: Math.random()*6-3,
      color: `hsl(${Math.random()*360},100%,50%)`,
      size: Math.random()*6+4
    }));
    setConfetti(arr);
  };

  // Fireworks
  const startFireworks = () => {
    const particles = Array.from({length:150}).map(()=>({
      x: window.innerWidth/2,
      y: window.innerHeight/2,
      dx: Math.random()*10-5,
      dy: Math.random()*10-5,
      alpha: 1
    }));
    setFireworksParticles(particles);
  };

  // Fireworks Animation
  useEffect(()=>{
    if(!curtainOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const animate = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      fireworksParticles.forEach(p=>{
        if(p.alpha<=0) return;
        ctx.fillStyle = `rgba(255,${Math.random()*255},${Math.random()*255},${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x,p.y,3,0,Math.PI*2);
        ctx.fill();
        p.x+=p.dx; p.y+=p.dy; p.alpha-=0.02;
      });
      requestAnimationFrame(animate);
    };
    animate();
  },[curtainOpen, fireworksParticles]);

  return (
    <div
      style={{position:'relative',width:'100vw',height:'100vh',overflow:'hidden',background:'linear-gradient(#8B0000,#800020)',display:'flex',justifyContent:'center',alignItems:'center'}}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {!curtainOpen && (
        <div ref={curtainRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',display:'flex',justifyContent:'center',alignItems:'center',transition:'transform 0.3s ease-out'}}>
          <button
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{padding:'25px 60px',fontSize:'1.6rem',borderRadius:'50px',border:'none',background:'#FF0044',color:'white',cursor:'grab',boxShadow:'0 0 25px #FF66AA'}}
          >
            Pull to Celebrate 🎉
          </button>
        </div>
      )}

      {curtainOpen && (
        <>
          <h1 style={{position:'absolute',top:'20%',width:'100%',textAlign:'center',fontSize:'2rem',color:'white',animation:'zoomIn 1s',transformOrigin:'center',animationIterationCount:1,animationTimingFunction:'ease-out'}}>
            🌹 Milan is Live! Let your hearts connect… 💖<br/>
            🙏 Ganesh Chaturthi ki shubhkamnaye! 🕉️
          </h1>

          {hearts.map(h=>(
            <div key={h.id} style={{position:'absolute',left:h.left,top:h.top,transform:`translate(${h.x}px, ${h.y}px)`,fontSize:'24px',color:'#FF3366'}}>💖</div>
          ))}

          {sparkHearts.map(h=>(
            <div key={h.id} style={{position:'absolute',left:h.left,top:h.top,fontSize:'16px',color:'#FF6699',opacity:0.7}}>💖</div>
          ))}

          {confetti.map(c=>(
            <div key={c.id} style={{position:'absolute',left:c.x,top:c.y,width:c.size,height:c.size,background:c.color,transform:`rotate(${Math.random()*360}deg)`}}></div>
          ))}

          <canvas ref={canvasRef} style={{position:'absolute',width:'100%',height:'100%',pointerEvents:'none'}} />
          <audio src="/sounds/romantic.mp3" autoPlay loop />
        </>
      )}
    </div>
  );
}
