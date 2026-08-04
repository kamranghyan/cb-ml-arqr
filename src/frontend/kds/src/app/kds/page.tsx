'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Volume2, VolumeX, RefreshCw, Wifi, WifiOff, Radio, LogOut } from 'lucide-react';
import { formatTimer, timerColorClass, timerBarColor, playNewOrderBeep } from '@/lib/utils';
import { fetchOrders, patchOrderStatus, normaliseOrder, toKdsStatus, WS_URL } from '@/lib/orders-api';
import type { KdsOrder, KdsStatus } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { connectWebSocket } from '@/lib/orders-api';

type Filter  = 'all' | 'new' | 'preparing' | 'ready' | 'delivered';
type WsState = 'connecting' | 'connected' | 'disconnected' | 'error';

const STATUS_NEXT: Record<KdsStatus, KdsStatus | null> = {
  new: 'preparing', preparing: 'ready', ready: 'delivered', delivered: null,
};
const STATUS_ORDER: Record<KdsStatus, number> = { new: 0, preparing: 1, ready: 2, delivered: 3 };
const STATUS_RANK:  Record<string, number>    = { new: 0, preparing: 1, ready: 2, delivered: 3 };
const STRIP_COLOR:  Record<KdsStatus, string> = {
  new: '#f97316', preparing: '#3b82f6', ready: '#22c55e', delivered: '#a855f7',
};
const BTN_CFG: Record<KdsStatus, { label: string; bg: string; color: string; border: string }[]> = {
  new:       [{ label: '✓ Accept', bg: '#EFF6FF', color: '#1d4ed8', border: '#BFDBFE' }, { label: '🔥 Preparing', bg: '#FFF3E0', color: '#c2410c', border: '#FED7AA' }],
  preparing: [{ label: '🔔 Mark Ready',  bg: '#F0FFF4', color: '#16a34a', border: '#BBF7D0' }],
  ready:     [{ label: '✓ Delivered',    bg: '#FAF5FF', color: '#7c3aed', border: '#DDD6FE' }],
  delivered: [{ label: '✓ Completed',    bg: '#F9FAFB', color: '#9CA3AF', border: '#E5E7EB' }],
};
const C = { red: '#E1251B', dark: '#891C1C', gold: '#FFC72C', bg: '#FFF8F1', white: '#fff', border: '#F0E8E0', text: '#1A1A1A', muted: '#687780', subtle: '#9CA3AF' };
const POLL_INTERVAL = 15000;

export default function KitchenDisplayPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [orders,    setOrders]    = useState<KdsOrder[]>([]);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [audio,     setAudio]     = useState(true);
  const [toast,     setToast]     = useState<string | null>(null);
  const [clock,     setClock]     = useState('');
  const [pollPct,   setPollPct]   = useState(0);
  const [apiState,  setApiState]  = useState<'loading' | 'live' | 'error'>('loading');
  const [apiError,  setApiError]  = useState('');
  const [wsState,   setWsState]   = useState<WsState>('disconnected');
  const [wsLog,     setWsLog]     = useState<string[]>([]);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const pollStart  = useRef(Date.now());
  const prevIds    = useRef<Set<string>>(new Set());
  const wsRef      = useRef<WebSocket | null>(null);
  const wsRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleLogout() { setLoggingOut(true); await logout(); router.push('/login/kds'); }

  useEffect(() => { const tick = () => { const n = new Date(); setClock([n.getHours(),n.getMinutes(),n.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':')); }; tick(); const id = setInterval(tick,1000); return()=>clearInterval(id); },[]);
  useEffect(() => { const id = setInterval(()=>{ setOrders(prev=>prev.map(o=>o.status!=='delivered'?{...o,elapsedSeconds:Math.min(o.elapsedSeconds+1,o.maxSeconds+300)}:o)); },1000); return()=>clearInterval(id); },[]);
  useEffect(() => { const id = setInterval(()=>{ setPollPct(Math.min(100,((Date.now()-pollStart.current)%POLL_INTERVAL)/POLL_INTERVAL*100)); },200); return()=>clearInterval(id); },[]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(null),5000); };
  const addWsLog  = (msg: string) => { const time=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); setWsLog(prev=>[`[${time}] ${msg}`,...prev.slice(0,9)]); };

  const connectWs = useCallback(async () => {
    if (wsRef.current?.readyState===WebSocket.OPEN) return;
    setWsState('connecting'); addWsLog('Connecting to WebSocket…');
    const ws = await connectWebSocket(); wsRef.current = ws;
    ws.onopen = () => { setWsState('connected'); addWsLog('✓ Connected'); ws.send(JSON.stringify({action:'subscribe',channel:'orders'})); };
    ws.onmessage = (event) => {
      try {
        const msg=JSON.parse(event.data); addWsLog(`← ${JSON.stringify(msg).slice(0,80)}`);
        const orderId=msg.orderId??msg.order_id; const status=msg.status??msg.orderStatus; const flags=msg.flags;
        if (orderId&&(status||flags)) {
          const kdsStatus=toKdsStatus(status??'',flags); const displayId=`LM-${orderId.slice(0,6).toUpperCase()}`;
          setOrders(prev => {
            const exists=prev.find(o=>(o as any)._apiId===orderId||o.id===displayId);
            if (exists) { showToast(`📡 WS: Order #${displayId} → ${kdsStatus.toUpperCase()}`); return prev.map(o=>((o as any)._apiId===orderId||o.id===displayId)?{...o,status:kdsStatus}:o); }
            else if (msg.lineItems||msg.items) { const n=normaliseOrder(msg); showToast(`🔔 WS: New order #${n.id} — Table ${n.table}`); if(audio) playNewOrderBeep(); return [n,...prev]; }
            return prev;
          });
        }
      } catch { addWsLog(`← (non-JSON) ${event.data?.slice(0,60)}`); }
    };
    ws.onerror = ()=>{setWsState('error');addWsLog('✗ WebSocket error');};
    ws.onclose = (e)=>{ setWsState('disconnected'); addWsLog(`✗ Disconnected (code ${e.code})`); if(wsRetryRef.current) clearTimeout(wsRetryRef.current); wsRetryRef.current=setTimeout(connectWs,5000); };
  }, [audio]);

  useEffect(()=>{ connectWs(); return()=>{ if(wsRetryRef.current) clearTimeout(wsRetryRef.current); wsRef.current?.close(); }; },[connectWs]);
  const wsSend = (p: object) => { if(wsRef.current?.readyState===WebSocket.OPEN){const m=JSON.stringify(p);wsRef.current.send(m);addWsLog(`→ ${m.slice(0,80)}`);} };

  const loadOrders = useCallback(async (silent=false) => {
    if (!silent) setApiState('loading');
    try {
      const fresh=await fetchOrders(); const freshIds=new Set(fresh.map((o:any)=>o.id));
      const newOnes=fresh.filter((o:any)=>!prevIds.current.has(o.id));
      if (newOnes.length>0&&prevIds.current.size>0) newOnes.forEach((o:any)=>{showToast(`🔔 New order #${o.id} — Table ${o.table}`);if(audio)playNewOrderBeep();});
      prevIds.current=freshIds;
      setOrders(prev=>{ const m=new Map(prev.map(o=>[o.id,o])); return fresh.map((o:any)=>{ const e=m.get(o.id); if(!e) return o; const er=STATUS_RANK[e.status]??0; const fr=STATUS_RANK[o.status]??0; const status=er>fr?e.status:o.status; return{...o,status,elapsedSeconds:e.elapsedSeconds,items:e.items}; }); });
      setApiState('live'); pollStart.current=Date.now();
    } catch (err:any) { setApiError(err?.message??'Failed'); setApiState('error'); }
  },[audio]);

  useEffect(()=>{ loadOrders(); const id=setInterval(()=>loadOrders(true),POLL_INTERVAL); return()=>clearInterval(id); },[loadOrders]);

  const advanceOrder = async (orderId: string) => {
    const order=orders.find(o=>o.id===orderId); if(!order) return;
    const next=STATUS_NEXT[order.status]; if(!next) return;
    setAdvancing(orderId); setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status:next}:o));
    try { const apiId=(order as any)._apiId??orderId; await patchOrderStatus(apiId,next); wsSend({action:'orderStatusUpdate',orderId:apiId,status:next}); showToast(`Order #${orderId} → ${next.toUpperCase()}`); }
    catch (err:any) { setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status:order.status}:o)); showToast(`⚠ Failed: ${err?.message}`); }
    finally { setAdvancing(null); }
  };

  const toggleDish = (orderId: string, idx: number) => { setOrders(prev=>prev.map(o=>{ if(o.id!==orderId) return o; const items=o.items.map((it,i)=>i===idx?{...it,done:!it.done}:it); return{...o,items}; })); };

  const filtered = orders.filter(o=>{ if(filter==='all') return o.status!=='delivered'; if(filter==='delivered') return o.status==='delivered'; return o.status===filter; }).sort((a,b)=>STATUS_ORDER[a.status]-STATUS_ORDER[b.status]||b.elapsedSeconds-a.elapsedSeconds);
  const counts = { pending:orders.filter(o=>o.status==='new').length, preparing:orders.filter(o=>o.status==='preparing').length, ready:orders.filter(o=>o.status==='ready').length };

  const apiColor = apiState==='live'?{bg:'#F0FFF4',border:'#BBF7D0',text:'#16a34a'}:apiState==='error'?{bg:'#FFF0F0',border:'#FFD0D0',text:C.red}:{bg:'#FFFBEB',border:'#FDE68A',text:'#d97706'};
  const wsColor  = wsState==='connected'?{bg:'#F0FFF4',border:'#BBF7D0',text:'#16a34a'}:wsState==='connecting'?{bg:'#FFFBEB',border:'#FDE68A',text:'#d97706'}:{bg:'#FFF0F0',border:'#FFD0D0',text:C.red};

  return (
    <div style={{minHeight:'100dvh',background:C.bg,display:'flex',flexDirection:'column',fontFamily:'DM Sans,sans-serif'}}>

      {toast&&<div style={{position:'fixed',top:80,right:20,zIndex:50,background:C.white,border:`1.5px solid #FED7AA`,borderRadius:18,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 8px 24px rgba(137,28,28,0.15)',maxWidth:320}}><div style={{width:32,height:32,borderRadius:10,background:'#FFF3E0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>🔔</div><p style={{fontSize:13,fontWeight:600,color:C.text,margin:0}}>{toast}</p></div>}

      {/* Header */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px',background:`linear-gradient(135deg,${C.dark},#B22222)`,boxShadow:'0 2px 12px rgba(137,28,28,0.2)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:38,height:38,borderRadius:12,background:'rgba(255,199,44,0.2)',border:'1.5px solid rgba(255,199,44,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🍽️</div>
          <div><p style={{color:'#fff',fontSize:17,fontWeight:800,margin:0,fontFamily:'Georgia,serif'}}>Menulay · KDS</p><p style={{color:'rgba(255,199,44,0.7)',fontSize:10,fontWeight:700,letterSpacing:2,textTransform:'uppercase',margin:0}}>Kitchen Display System</p></div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{textAlign:'center'}}><p style={{fontFamily:'monospace',fontSize:22,fontWeight:800,color:'#fff',margin:0}}>{clock||'00:00:00'}</p><p style={{fontSize:10,color:'rgba(255,255,255,0.5)',margin:0}}>{new Date().toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'})}</p></div>
          <div style={{display:'flex',alignItems:'center',gap:6,background:apiColor.bg,border:`1px solid ${apiColor.border}`,borderRadius:20,padding:'5px 12px'}}>
            {apiState==='live'?<Wifi size={11} color={apiColor.text}/>:apiState==='error'?<WifiOff size={11} color={apiColor.text}/>:<RefreshCw size={11} color={apiColor.text} className="animate-spin"/>}
            <span style={{fontSize:10,fontWeight:700,color:apiColor.text,letterSpacing:1,textTransform:'uppercase'}}>{apiState==='live'?'REST Live':apiState==='error'?'API Error':'Loading…'}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,background:wsColor.bg,border:`1px solid ${wsColor.border}`,borderRadius:20,padding:'5px 12px'}}>
            <Radio size={11} color={wsColor.text}/>
            <span style={{fontSize:10,fontWeight:700,color:wsColor.text,letterSpacing:1,textTransform:'uppercase'}}>WS {wsState==='connected'?'Live':wsState==='connecting'?'…':'Off'}</span>
            {wsState==='connected'&&<span style={{width:6,height:6,borderRadius:'50%',background:'#22c55e',display:'inline-block'}}/>}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {[{val:counts.pending,label:'Pending',color:'#f97316'},{val:counts.preparing,label:'Preparing',color:'#3b82f6'},{val:counts.ready,label:'Ready',color:'#22c55e'}].map(s=>(
            <div key={s.label} style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'6px 14px',borderRadius:12,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)'}}>
              <span style={{fontSize:20,fontWeight:800,color:s.color,fontFamily:'Georgia,serif'}}>{s.val}</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.6)',fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>{s.label}</span>
            </div>
          ))}
          <button onClick={()=>setAudio(!audio)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:10,border:`1.5px solid ${audio?'rgba(255,255,255,0.25)':'#FFD0D0'}`,background:audio?'rgba(255,255,255,0.12)':'#FFF0F0',color:audio?'#fff':C.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            {audio?<Volume2 size={14}/>:<VolumeX size={14}/>} Audio {audio?'On':'Off'}
          </button>
          <button onClick={handleLogout} disabled={loggingOut} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:10,border:'1.5px solid #FFD0D0',background:'#FFF0F0',color:C.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>
            <LogOut size={14} className={loggingOut?'animate-spin':''}/> {loggingOut?'Signing out…':'Sign Out'}
          </button>
        </div>
      </header>

      {/* Poll bar */}
      <div style={{height:3,background:C.border,flexShrink:0}}><div style={{height:'100%',background:C.red,transition:'width 0.2s',width:`${pollPct}%`}}/></div>

      {/* API error */}
      {apiState==='error'&&<div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 24px',background:'#FFF0F0',borderBottom:'1px solid #FFD0D0',flexShrink:0}}><WifiOff size={14} color={C.red}/><p style={{fontSize:12,color:C.red,flex:1,margin:0}}>{apiError}</p><button onClick={()=>loadOrders()} style={{padding:'4px 14px',borderRadius:8,background:'#FFF0F0',border:'1px solid #FFD0D0',color:C.red,fontSize:12,fontWeight:700,cursor:'pointer'}}>Retry</button></div>}

      {/* Filter bar */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 24px',background:C.white,borderBottom:`1.5px solid ${C.border}`,flexShrink:0}}>
        {([{key:'all',label:'All Orders'},{key:'new',label:'🟠 New'},{key:'preparing',label:'🔵 Preparing'},{key:'ready',label:'🟢 Ready'}] as const).map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} style={{padding:'6px 16px',borderRadius:20,border:`1.5px solid ${filter===f.key?C.red:C.border}`,background:filter===f.key?'#FFF0EE':C.white,color:filter===f.key?C.red:C.muted,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}>{f.label}</button>
        ))}
        <div style={{width:1,height:20,background:C.border,margin:'0 4px'}}/>
        <button onClick={()=>setFilter('delivered')} style={{padding:'6px 16px',borderRadius:20,border:`1.5px solid ${filter==='delivered'?'#7c3aed':C.border}`,background:filter==='delivered'?'#FAF5FF':C.white,color:filter==='delivered'?'#7c3aed':C.muted,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all 0.2s'}}>✓ Delivered</button>
      </div>

      {/* WS log */}
      {wsLog.length>0&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 24px',background:'#F0FFF4',borderBottom:'1px solid #BBF7D0',flexShrink:0,overflow:'hidden'}}><Radio size={12} color="#16a34a" style={{flexShrink:0}}/><p style={{fontSize:10,color:'#16a34a',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,margin:0}}>{wsLog[0]}</p><span style={{fontSize:9,color:C.subtle,flexShrink:0}}>{wsLog.length} events</span></div>}

      {/* Loading */}
      {apiState==='loading'&&orders.length===0&&<div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}><div style={{width:40,height:40,border:`3px solid ${C.red}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/><p style={{fontSize:14,color:C.muted,fontWeight:600}}>Loading orders from API…</p><p style={{fontSize:11,color:C.subtle,fontFamily:'monospace'}}>GET /orders?tenantId=t123&restaurantId=r456</p></div>}

      {/* Grid */}
      {(apiState!=='loading'||orders.length>0)&&(
        <div style={{flex:1,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,padding:20,alignContent:'start',overflowY:'auto'}}>
          {filtered.length===0&&<div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'64px 0',gap:12,border:`2px dashed ${C.border}`,borderRadius:24,background:C.white}}><span style={{fontSize:40,opacity:0.2}}>✓</span><p style={{fontSize:13,color:C.muted,fontWeight:600,margin:0}}>No orders in this category</p><p style={{fontSize:11,color:C.subtle,margin:0}}>{orders.length===0?'Waiting for orders…':`${orders.length} orders in other categories`}</p></div>}

          {filtered.map(order=>{
            const pct=Math.min(100,(order.elapsedSeconds/order.maxSeconds)*100);
            const isUrgent=pct>=90; const isAdvancing=advancing===order.id; const allDone=order.items.every(i=>i.done);
            return(
              <div key={order.id} style={{background:C.white,borderRadius:20,display:'flex',flexDirection:'column',border:`1.5px solid ${isUrgent?'#FFD0D0':C.border}`,boxShadow:isUrgent?'0 0 0 3px rgba(225,37,27,0.08),0 4px 16px rgba(137,28,28,0.08)':'0 2px 12px rgba(137,28,28,0.06)',transition:'all 0.2s',overflow:'hidden'}}>
                <div style={{height:5,background:STRIP_COLOR[order.status]}}/>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'12px 16px 10px',borderBottom:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <p style={{fontFamily:'monospace',fontSize:13,fontWeight:800,color:C.dark,margin:0}}>#{order.id}</p>
                      {allDone&&order.status!=='delivered'&&<span style={{fontSize:9,background:'#F0FFF4',border:'1px solid #BBF7D0',color:'#16a34a',padding:'2px 8px',borderRadius:20,fontWeight:700}}>ALL DONE</span>}
                    </div>
                    <p style={{fontSize:11,color:C.muted,margin:'3px 0 0'}}>🪑 Table {order.table} · {order.zone}</p>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p style={{fontFamily:'monospace',fontSize:22,fontWeight:800,margin:0}} className={timerColorClass(order.elapsedSeconds,order.maxSeconds)}>{formatTimer(order.elapsedSeconds)}</p>
                    <p style={{fontSize:10,color:C.subtle,margin:'2px 0 0'}}>Placed {order.placedAt}</p>
                  </div>
                </div>
                <div style={{height:4,background:C.border}}><div style={{height:'100%',borderRadius:4,transition:'width 1s',width:`${pct}%`,background:timerBarColor(order.elapsedSeconds,order.maxSeconds)}}/></div>
                <div style={{display:'flex',flexDirection:'column',gap:8,padding:'12px 16px',flex:1}}>
                  {order.items.map((dish,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:18,width:28,textAlign:'center'}}>{dish.emoji}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:700,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:dish.done?C.subtle:C.text,textDecoration:dish.done?'line-through':'none'}}>{dish.name}</p>
                        {dish.mods&&<p style={{fontSize:10,color:C.subtle,margin:0}}>{dish.mods}</p>}
                      </div>
                      <span style={{fontSize:12,color:C.muted,fontWeight:600}}>×{dish.qty}</span>
                      <button onClick={()=>toggleDish(order.id,i)} style={{width:22,height:22,borderRadius:6,border:`1.5px solid ${dish.done?C.red:C.border}`,background:dish.done?C.red:C.white,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,transition:'all 0.2s'}}>
                        {dish.done&&<span style={{color:'#fff',fontSize:12,fontWeight:800}}>✓</span>}
                      </button>
                    </div>
                  ))}
                </div>
                {order.note&&<div style={{margin:'0 12px 8px',padding:'8px 12px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:12,display:'flex',alignItems:'flex-start',gap:6}}><span style={{color:'#d97706',fontSize:12,marginTop:1}}>⚠</span><p style={{fontSize:10,color:'#92400e',lineHeight:1.5,margin:0,fontWeight:600}}>{order.note}</p></div>}
                <div style={{display:'flex',gap:8,padding:'10px 12px 12px',borderTop:`1px solid ${C.border}`}}>
                  {BTN_CFG[order.status].map((btn,i)=>(
                    <button key={btn.label} onClick={()=>i===0&&advanceOrder(order.id)} disabled={order.status==='delivered'||isAdvancing}
                      style={{flex:1,height:36,borderRadius:10,border:`1.5px solid ${btn.border}`,background:btn.bg,color:btn.color,fontSize:12,fontWeight:700,cursor:order.status==='delivered'?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,transition:'all 0.2s',opacity:(order.status==='delivered'||isAdvancing)?0.5:1}}>
                      {isAdvancing&&i===0?<div style={{width:14,height:14,border:`2px solid ${btn.color}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>:btn.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`.animate-spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}