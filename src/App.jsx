import { useState, useEffect } from "react";
import {
  Home, List, BarChart2, Landmark, Settings, Plus, Menu, X,
  AlertTriangle, Clock, ChevronRight, Edit2, Trash2, Bell, Sun, Moon,
} from "lucide-react";

// ════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════
const LIGHT = { bg:"#FFFFFF", text:"#0A0A0A", sub:"#6B6B6B", div:"#E8E8E8", surf:"#F6F6F6", acc:"#4A6FA5", neg:"#C0392B", warn:"#C07B2C" };
const DARK  = { bg:"#000000", text:"#F5F5F5", sub:"#888888", div:"#1A1A1A", surf:"#0D0D0D", acc:"#4A6FA5", neg:"#E05C4B", warn:"#D4901F" };

// ════════════════════════════════════════════════════
// BUSINESS CONSTANTS
// ════════════════════════════════════════════════════
const CONTRACTS = {
  piramides:      { label:"Pirámides",      monthly:854545.45, rebate:150000 },
  socializadores: { label:"Socializadores", monthly:357517.25, rebate:50000  },
};
const RESERVE_TARGET = 140000;

const CAT = {
  income:             { label:"Ingreso municipal",         sign:+1, ac:true  },
  commission:         { label:"Comisión contadores",       sign:-1, ac:true  },
  payroll:            { label:"Nómina",                    sign:-1, ac:true  },
  rebate:             { label:"Rebate municipal",          sign:-1, ac:true  },
  reserve_fund:       { label:"Fondo de reserva",          sign:-1, ac:true  },
  extraordinary:      { label:"Gasto extraordinario",      sign:-1, ac:false },
  loan_received:      { label:"Préstamo socio recibido",   sign:+1, ac:true  },
  loan_repayment:     { label:"Devolución préstamo socio", sign:-1, ac:true  },
  profit_distribution:{ label:"Distribución de utilidades",sign:-1, ac:true  },
};

// ════════════════════════════════════════════════════
// SEED DATA
// ════════════════════════════════════════════════════
const SEED = [
  { id:1,  date:"2026-04-15", contract:"piramides", category:"payroll",            amount:200000,    desc:"Nómina 15 abr — equipo",              method:"wire", by:"owner"     },
  { id:2,  date:"2026-04-15", contract:"piramides", category:"loan_received",      amount:200000,    desc:"Préstamo socio — anticipo nómina abr",method:null,   by:"owner"     },
  { id:3,  date:"2026-05-15", contract:"piramides", category:"payroll",            amount:130000,    desc:"Nómina 15 may — equipo",              method:"wire", by:"owner"     },
  { id:4,  date:"2026-05-15", contract:"piramides", category:"loan_received",      amount:130000,    desc:"Préstamo socio — anticipo nómina may",method:null,   by:"owner"     },
  { id:5,  date:"2026-06-09", contract:"piramides", category:"income",             amount:854545.45, desc:"Ingreso municipal mayo — Pirámides",  method:null,   by:"owner"     },
  { id:6,  date:"2026-06-09", contract:"piramides", category:"commission",         amount:68363.64,  desc:"Comisión contadores 8%",              method:null,   by:"owner"     },
  { id:7,  date:"2026-06-12", contract:"piramides", category:"loan_repayment",     amount:100000,    desc:"Devolución préstamo socio",           method:"wire", by:"owner"     },
  { id:8,  date:"2026-06-15", contract:"piramides", category:"payroll",            amount:380000,    desc:"Nómina 15 jun — equipo",              method:"wire", by:"assistant" },
  { id:9,  date:"2026-06-16", contract:"piramides", category:"loan_repayment",     amount:191182,    desc:"Devolución préstamo socio",           method:"wire", by:"owner"     },
  { id:10, date:"2026-06-16", contract:"piramides", category:"profit_distribution",amount:15000,     desc:"Distribución de utilidades jun",      method:"cash", by:"owner"     },
  { id:11, date:"2026-06-19", contract:"piramides", category:"payroll",            amount:25000,     desc:"Ajuste nómina jun — equipo",          method:"wire", by:"assistant" },
  { id:12, date:"2026-06-22", contract:"piramides", category:"loan_repayment",     amount:23818,     desc:"Devolución préstamo socio",           method:"wire", by:"owner"     },
  { id:13, date:"2026-06-23", contract:"piramides", category:"rebate",             amount:51181.81,  desc:"Rebate municipal jun (parcial)",      method:"cash", by:"owner"     },
];

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
const $n = (n, d = 2) => {
  const s = new Intl.NumberFormat("es-MX", { minimumFractionDigits:d, maximumFractionDigits:d }).format(Math.abs(n));
  return `$${s}`;
};
const fmtDate = (d) => {
  const [,m,day] = d.split("-");
  return `${+day} ${"ene feb mar abr may jun jul ago sep oct nov dic".split(" ")[+m-1]}`;
};
const ML = (ym) => "Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic".split(" ")[+ym.split("-")[1]-1];

// ════════════════════════════════════════════════════
// CALCULATIONS
// ════════════════════════════════════════════════════
const calcBalance = (ms) => ms.reduce((sum,m) => CAT[m.category].ac ? sum + CAT[m.category].sign * m.amount : sum, 0);
const calcLoans   = (ms) => ms.filter(m=>m.category==="loan_received").reduce((s,m)=>s+m.amount,0)
                           - ms.filter(m=>m.category==="loan_repayment").reduce((s,m)=>s+m.amount,0);
const calcReserve = (ms) => ms.filter(m=>m.category==="reserve_fund").reduce((s,m)=>s+m.amount,0)
                           - ms.filter(m=>m.category==="extraordinary").reduce((s,m)=>s+m.amount,0);
const calcProfit  = (ms, ym) => {
  const mm   = ms.filter(m=>m.date.startsWith(ym));
  const inc  = mm.filter(m=>m.category==="income").reduce((s,m)=>s+m.amount,0);
  const exp  = mm.filter(m=>["commission","payroll","rebate","reserve_fund","extraordinary"].includes(m.category)).reduce((s,m)=>s+m.amount,0);
  const dist = mm.filter(m=>m.category==="profit_distribution").reduce((s,m)=>s+m.amount,0);
  return { gen: inc-exp, dist, ret: inc-exp-dist };
};

// ════════════════════════════════════════════════════
// SHARED UI PRIMITIVES
// ════════════════════════════════════════════════════
const Eyebrow = ({ s, children, mb=6 }) => (
  <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:s.sub, marginBottom:mb }}>
    {children}
  </div>
);
const Card = ({ s, children, style={} }) => (
  <div style={{ border:`1px solid ${s.div}`, borderRadius:10, padding:20, ...style }}>
    {children}
  </div>
);

// ════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════
function DashboardView({ s, mvs }) {
  const heroSize = typeof window !== "undefined" && window.innerWidth < 640 ? 44 : 62;
  const balance  = calcBalance(mvs);
  const loans    = calcLoans(mvs);
  const reserve  = calcReserve(mvs);
  const { gen, dist, ret } = calcProfit(mvs, "2026-06");
  const last5    = [...mvs].sort((a,b) => b.date.localeCompare(a.date) || b.id-a.id).slice(0,5);
  const pirRebate = mvs.filter(m=>m.contract==="piramides"&&m.category==="rebate"&&m.date.startsWith("2026-06")).reduce((s,m)=>s+m.amount,0);
  const socRebate = mvs.filter(m=>m.contract==="socializadores"&&m.category==="rebate"&&m.date.startsWith("2026-06")).reduce((s,m)=>s+m.amount,0);

  return (
    <div style={{ padding:"28px 20px", maxWidth:660, margin:"0 auto" }}>

      {/* ── HERO ── */}
      <div style={{ marginBottom:36 }}>
        <Eyebrow s={s} mb={10}>Dinero en manos de contadores</Eyebrow>
        <div style={{ fontSize:heroSize, fontWeight:300, letterSpacing:"-0.025em", lineHeight:1, fontVariantNumeric:"tabular-nums", color:balance<0?s.neg:s.text }}>
          {$n(balance)}
        </div>
        <div style={{ fontSize:13, color:s.sub, marginTop:10 }}>
          Próximo ingreso estimado:&nbsp;<strong style={{ color:s.text }}>12 jul 2026</strong> — Pirámides + Socializadores
        </div>
      </div>

      {/* ── LOANS + RESERVE ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <Card s={s}>
          <Eyebrow s={s}>Préstamos pendientes</Eyebrow>
          <div style={{ fontSize:28, fontWeight:400, letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums", color:loans>0?s.neg:s.text }}>{$n(loans)}</div>
          <div style={{ fontSize:11, color:s.sub, marginTop:4 }}>{loans>0?"El negocio me debe":"Sin deuda pendiente"}</div>
        </Card>
        <Card s={s}>
          <Eyebrow s={s}>Fondo de reserva</Eyebrow>
          <div style={{ fontSize:28, fontWeight:400, letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums" }}>{$n(reserve)}</div>
          <div style={{ fontSize:11, color:s.sub, marginTop:4 }}>Meta mensual: {$n(RESERVE_TARGET,0)}</div>
          <div style={{ marginTop:10, height:3, background:s.div, borderRadius:2 }}>
            <div style={{ height:"100%", width:`${Math.min(100,(reserve/RESERVE_TARGET)*100)}%`, background:s.acc, borderRadius:2 }} />
          </div>
        </Card>
      </div>

      {/* ── MONTH PROFIT ── */}
      <Card s={s} style={{ marginBottom:12 }}>
        <Eyebrow s={s} mb={12}>Utilidad — Junio 2026</Eyebrow>
        <div style={{ display:"flex", gap:0, borderTop:`1px solid ${s.div}`, paddingTop:12 }}>
          {[{label:"Generada",val:gen},{label:"Distribuida",val:dist},{label:"Retenida",val:ret}].map((item,i)=>(
            <div key={i} style={{ flex:1, paddingLeft:i>0?16:0, paddingRight:i<2?16:0, borderRight:i<2?`1px solid ${s.div}`:"none" }}>
              <div style={{ fontSize:11, color:s.sub, marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:20, fontWeight:500, fontVariantNumeric:"tabular-nums", color:item.val<0?s.neg:s.text }}>{$n(item.val,0)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── PENDING COLLECTIONS ── */}
      <Card s={s} style={{ marginBottom:12 }}>
        <Eyebrow s={s} mb={12}>Cobranzas pendientes</Eyebrow>
        <div style={{ background:`${s.neg}12`, border:`1px solid ${s.neg}30`, borderRadius:8, padding:"11px 14px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
            <AlertTriangle size={13} color={s.neg} />
            <span style={{ fontSize:12, fontWeight:600, color:s.neg }}>Socializadores — 2 pagos vencidos</span>
          </div>
          {[{p:"Abril",due:"12 may",ov:true},{p:"Mayo",due:"12 jun",ov:true},{p:"Junio",due:"12 jul",ov:false}].map((item,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderTop:i>0?`1px solid ${s.neg}20`:"none" }}>
              <span style={{ fontSize:13, color:s.text }}>Pago {item.p}</span>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:11, color:item.ov?s.neg:s.sub }}>{item.ov?`Vencido ${item.due}`:`Est. ${item.due}`}</span>
                <span style={{ fontSize:12, fontVariantNumeric:"tabular-nums", fontWeight:500, color:s.text }}>{$n(CONTRACTS.socializadores.monthly)}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <Clock size={13} color={s.sub} />
            <span style={{ fontSize:13, color:s.text }}>Pirámides — Pago junio</span>
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <span style={{ fontSize:11, color:s.sub }}>Est. 12 jul 2026</span>
            <span style={{ fontSize:12, fontVariantNumeric:"tabular-nums", fontWeight:500 }}>{$n(CONTRACTS.piramides.monthly)}</span>
          </div>
        </div>
      </Card>

      {/* ── REBATE STATUS ── */}
      <Card s={s} style={{ marginBottom:12 }}>
        <Eyebrow s={s} mb={12}>Rebate municipal — Junio 2026</Eyebrow>
        {[{label:"Pirámides",paid:pirRebate,target:CONTRACTS.piramides.rebate},{label:"Socializadores",paid:socRebate,target:CONTRACTS.socializadores.rebate}].map((item,i)=>{
          const pct = Math.min(100,(item.paid/item.target)*100);
          const ok  = item.paid>=item.target;
          return (
            <div key={i} style={{ marginBottom:i===0?14:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                <span style={{ fontSize:13 }}>{item.label}</span>
                <span style={{ fontSize:12, fontVariantNumeric:"tabular-nums", color:ok?s.text:s.warn }}>{$n(item.paid)} / {$n(item.target)}{!ok?" — Pendiente":" ✓"}</span>
              </div>
              <div style={{ height:3, background:s.div, borderRadius:2 }}>
                <div style={{ height:"100%", width:`${pct}%`, background:ok?s.acc:s.warn, borderRadius:2 }} />
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── LAST 5 MOVEMENTS ── */}
      <Card s={s} style={{ marginBottom:12 }}>
        <Eyebrow s={s} mb={4}>Últimos movimientos</Eyebrow>
        {last5.map((m,i)=>{
          const cat = CAT[m.category];
          const pos = cat.sign>0;
          return (
            <div key={m.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderTop:i>0?`1px solid ${s.div}`:"none" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{cat.label}</div>
                <div style={{ fontSize:11, color:s.sub, marginTop:2 }}>{CONTRACTS[m.contract].label} · {fmtDate(m.date)}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:600, fontVariantNumeric:"tabular-nums", color:pos?s.text:s.neg }}>
                {pos?"+":" −"}{$n(m.amount)}
              </div>
            </div>
          );
        })}
      </Card>

      {/* ── MONTH CLOSE ── */}
      <Card s={s}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:s.warn, flexShrink:0 }} />
          <div>
            <div style={{ fontSize:13, fontWeight:500 }}>Cierre de junio — incompleto</div>
            <div style={{ fontSize:11, color:s.sub, marginTop:3 }}>3 pagos de Socializadores sin registrar (2 vencidos). Rebate Pirámides parcial.</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════
// MOVEMENTS
// ════════════════════════════════════════════════════
function MovementsView({ s, mvs, role, onAdd, onEdit, onDelete }) {
  const [fC, setFC]    = useState("all");
  const [fM, setFM]    = useState("all");
  const [fK, setFK]    = useState("all");
  const [asc, setAsc]  = useState(false);
  const [conf, setConf]= useState(null);

  const months  = [...new Set(mvs.map(m=>m.date.slice(0,7)))].sort();
  const list    = mvs
    .filter(m=>(fC==="all"||m.contract===fC)&&(fM==="all"||m.date.startsWith(fM))&&(fK==="all"||m.category===fK))
    .sort((a,b)=>{ const c=a.date.localeCompare(b.date)||a.id-b.id; return asc?c:-c; });
  const canAct  = (m) => role==="owner" || m.by==="assistant";
  const sel     = { padding:"7px 10px", fontSize:12, fontFamily:"inherit", border:`1px solid ${s.div}`, borderRadius:7, background:s.bg, color:s.text, outline:"none", cursor:"pointer" };

  return (
    <div style={{ padding:"24px 20px", maxWidth:800, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
        <div>
          <Eyebrow s={s} mb={4}>Movimientos</Eyebrow>
          <div style={{ fontSize:13, color:s.sub }}>{list.length} entrada{list.length!==1?"s":""}</div>
        </div>
        <button onClick={onAdd} style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, background:s.text, color:s.bg, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:500 }}>
          <Plus size={14} color={s.bg} /> Nuevo
        </button>
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
        <select value={fC} onChange={e=>setFC(e.target.value)} style={sel}>
          <option value="all">Todos los contratos</option>
          <option value="piramides">Pirámides</option>
          <option value="socializadores">Socializadores</option>
        </select>
        <select value={fM} onChange={e=>setFM(e.target.value)} style={sel}>
          <option value="all">Todos los meses</option>
          {months.map(m=><option key={m} value={m}>{ML(m)} 2026</option>)}
        </select>
        <select value={fK} onChange={e=>setFK(e.target.value)} style={sel}>
          <option value="all">Todas las categorías</option>
          {Object.entries(CAT).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={()=>setAsc(!asc)} style={{ ...sel, display:"flex", alignItems:"center", gap:4 }}>
          {asc?"↑ Más antiguo":"↓ Más reciente"}
        </button>
      </div>

      <div style={{ border:`1px solid ${s.div}`, borderRadius:10, overflow:"hidden" }}>
        {list.length===0?(
          <div style={{ padding:40, textAlign:"center", color:s.sub, fontSize:14 }}>Sin movimientos para esta selección</div>
        ):list.map((m,i)=>{
          const cat = CAT[m.category];
          const pos = cat.sign>0;
          const act = canAct(m);
          return (
            <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderTop:i>0?`1px solid ${s.div}`:"none", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{cat.label}</span>
                  <span style={{ fontSize:10.5, color:s.sub, background:s.surf, padding:"1px 6px", borderRadius:4 }}>{CONTRACTS[m.contract].label}</span>
                  {m.method&&<span style={{ fontSize:10.5, color:s.sub }}>{m.method==="wire"?"Wire":"Efectivo"}</span>}
                  {m.by==="assistant"&&<span style={{ fontSize:10, color:s.acc, border:`1px solid ${s.acc}50`, padding:"1px 6px", borderRadius:4 }}>Asistente</span>}
                </div>
                <div style={{ fontSize:11, color:s.sub, marginTop:3 }}>{m.desc} · {fmtDate(m.date)}</div>
              </div>
              <div style={{ display:"flex", gap:4, alignItems:"center", flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:600, fontVariantNumeric:"tabular-nums", color:pos?s.text:s.neg, textAlign:"right", minWidth:100 }}>
                  {pos?"+":" −"}{$n(m.amount)}
                </div>
                <div style={{ display:"flex", gap:0, width:60, justifyContent:"flex-end" }}>
                  {act&&<>
                    <button onClick={()=>onEdit(m)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 5px", display:"flex", borderRadius:4 }}><Edit2 size={13} color={s.sub} /></button>
                    {conf===m.id
                      ?<button onClick={()=>{onDelete(m.id);setConf(null);}} style={{ background:s.neg, border:"none", cursor:"pointer", padding:"3px 7px", color:"#fff", borderRadius:4, fontSize:10.5, fontFamily:"inherit", fontWeight:600 }}>Borrar</button>
                      :<button onClick={()=>setConf(m.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 5px", display:"flex", borderRadius:4 }}><Trash2 size={13} color={s.sub} /></button>
                    }
                  </>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// INCOME STATEMENT
// ════════════════════════════════════════════════════
function IncomeView({ s, mvs }) {
  const [tab, setTab] = useState("piramides");
  const MONTHS = ["2026-04","2026-05","2026-06"];
  const TABS   = [{id:"piramides",label:"Pirámides"},{id:"socializadores",label:"Socializadores"},{id:"all",label:"Consolidado"}];

  const getData = (c,ym) => {
    const mm  = mvs.filter(m=>m.date.startsWith(ym)&&(c==="all"||m.contract===c));
    const sum = k=>mm.filter(m=>m.category===k).reduce((s,m)=>s+m.amount,0);
    const inc=sum("income"),com=sum("commission"),pay=sum("payroll"),reb=sum("rebate"),rsv=sum("reserve_fund"),ext=sum("extraordinary"),dist=sum("profit_distribution");
    const exp=com+pay+reb+rsv+ext;
    return {inc,com,pay,reb,rsv,ext,gen:inc-exp,dist,ret:inc-exp-dist};
  };

  const ROWS = [
    {key:"inc", label:"Ingreso municipal",      type:"income" },
    {key:"com", label:"Comisión contadores",    type:"expense"},
    {key:"pay", label:"Nómina",                 type:"expense"},
    {key:"reb", label:"Rebate municipal",       type:"expense"},
    {key:"rsv", label:"Fondo de reserva",       type:"expense"},
    {key:"ext", label:"Gastos extraordinarios", type:"expense"},
    {key:"gen", label:"Utilidad generada",      type:"total"  },
    {key:"dist",label:"Distribuida al socio",   type:"dist"   },
    {key:"ret", label:"Utilidad retenida",      type:"total"  },
  ];

  const data = MONTHS.map(ym=>getData(tab,ym));

  return (
    <div style={{ padding:"24px 20px", maxWidth:860, margin:"0 auto" }}>
      <Eyebrow s={s} mb={20}>Estado de resultados</Eyebrow>
      <div style={{ display:"flex", borderBottom:`1px solid ${s.div}`, marginBottom:24 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"8px 16px", fontSize:13, fontWeight:tab===t.id?600:400, border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", color:tab===t.id?s.text:s.sub, borderBottom:tab===t.id?`2px solid ${s.text}`:"2px solid transparent", marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:380 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", padding:"8px 12px", fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, borderBottom:`1px solid ${s.div}` }}>Concepto</th>
              {MONTHS.map(ym=><th key={ym} style={{ textAlign:"right", padding:"8px 12px", fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, borderBottom:`1px solid ${s.div}` }}>{ML(ym)}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row,ri)=>(
              <tr key={row.key} style={{ borderTop:(row.type==="total"&&ri>0)?`1.5px solid ${s.div}`:undefined }}>
                <td style={{ padding:"10px 12px", fontSize:13, color:row.type==="total"?s.text:s.sub, fontWeight:row.type==="total"?600:400, borderBottom:`1px solid ${s.div}` }}>
                  {row.type==="expense"&&<span style={{ marginRight:6, opacity:0.3 }}>↳</span>}{row.label}
                </td>
                {data.map((d,mi)=>{
                  const v   = d[row.key];
                  const isE = row.type==="expense"||row.type==="dist";
                  const col = v===0?s.sub:(isE?s.neg:(v<0?s.neg:s.text));
                  return (
                    <td key={mi} style={{ padding:"10px 12px", fontSize:13, textAlign:"right", fontVariantNumeric:"tabular-nums", fontWeight:row.type==="total"?600:400, color:col, borderBottom:`1px solid ${s.div}` }}>
                      {v===0?"—":isE?`(${$n(v)})`:$n(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// TREASURY
// ════════════════════════════════════════════════════
function TreasuryView({ s, mvs }) {
  const balance = calcBalance(mvs);
  const MONTHS  = ["2026-04","2026-05","2026-06"];
  const rows    = MONTHS.map(ym=>{
    const mm  = mvs.filter(m=>m.date.startsWith(ym));
    const inc = mm.filter(m=>["income","loan_received"].includes(m.category)).reduce((s,m)=>s+m.amount,0);
    const out = mm.filter(m=>["commission","payroll","rebate","reserve_fund","loan_repayment","profit_distribution"].includes(m.category)).reduce((s,m)=>s+m.amount,0);
    return { ym, inc, out };
  });

  const PROJ = [
    { label:"Pirámides — Nómina equipo",     amount:430000, method:"Wire"           },
    { label:"Pirámides — Rebate municipal",  amount:150000, method:"Efectivo"        },
    { label:"Socializadores — Sueldo socio", amount:150000, method:"Wire + Efectivo" },
    { label:"Socializadores — Rebate mun.",  amount:50000,  method:"Efectivo"        },
  ];

  return (
    <div style={{ padding:"24px 20px", maxWidth:660, margin:"0 auto" }}>
      <Eyebrow s={s} mb={24}>Tesorería</Eyebrow>

      <Card s={s} style={{ marginBottom:16 }}>
        <Eyebrow s={s} mb={8}>Saldo actual en contadores</Eyebrow>
        <div style={{ fontSize:48, fontWeight:300, letterSpacing:"-0.02em", fontVariantNumeric:"tabular-nums", color:balance<0?s.neg:s.text, lineHeight:1 }}>{$n(balance)}</div>
        <div style={{ fontSize:12, color:s.sub, marginTop:10 }}>Próximo ingreso: Pirámides + Socializadores · 12 jul 2026</div>
      </Card>

      <Card s={s} style={{ marginBottom:16, padding:0, overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${s.div}` }}><Eyebrow s={s} mb={0}>Evolución mensual</Eyebrow></div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>{["Mes","Entradas","Salidas","Neto"].map((h,i)=><th key={h} style={{ padding:"10px 16px", fontSize:10.5, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", color:s.sub, textAlign:i===0?"left":"right", borderBottom:`1px solid ${s.div}` }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={r.ym}>
                <td style={{ padding:"12px 16px", fontSize:13, borderBottom:i<2?`1px solid ${s.div}`:"none" }}>{ML(r.ym)} 2026</td>
                <td style={{ padding:"12px 16px", fontSize:13, fontVariantNumeric:"tabular-nums", textAlign:"right", borderBottom:i<2?`1px solid ${s.div}`:"none" }}>{r.inc>0?$n(r.inc):"—"}</td>
                <td style={{ padding:"12px 16px", fontSize:13, fontVariantNumeric:"tabular-nums", textAlign:"right", color:s.sub, borderBottom:i<2?`1px solid ${s.div}`:"none" }}>{r.out>0?$n(r.out):"—"}</td>
                <td style={{ padding:"12px 16px", fontSize:13, fontVariantNumeric:"tabular-nums", textAlign:"right", fontWeight:600, borderBottom:i<2?`1px solid ${s.div}`:"none" }}>{$n(r.inc-r.out)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card s={s} style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${s.div}` }}><Eyebrow s={s} mb={0}>Solicitar a contadores — Julio 2026</Eyebrow></div>
        <div style={{ padding:"0 20px" }}>
          {PROJ.map((item,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0", borderBottom:i<PROJ.length-1?`1px solid ${s.div}`:"none" }}>
              <div>
                <div style={{ fontSize:13 }}>{item.label}</div>
                <div style={{ fontSize:11, color:s.sub, marginTop:2 }}>{item.method}</div>
              </div>
              <div style={{ fontSize:13, fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{$n(item.amount,0)}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", padding:"14px 20px", borderTop:`1.5px solid ${s.div}` }}>
          <span style={{ fontSize:13, fontWeight:600 }}>Total estimado</span>
          <span style={{ fontSize:17, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{$n(PROJ.reduce((s,i)=>s+i.amount,0),0)}</span>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════
function SettingsView({ s }) {
  const [cfg, setCfg] = useState({ piramides:{monthly:854545.45,commission:8,rebate:150000}, socializadores:{monthly:357517.25,commission:8,rebate:50000} });
  const [rsv, setRsv] = useState(140000);
  const base  = { width:"100%", padding:"9px 12px", fontSize:13, fontFamily:"inherit", background:s.bg, border:`1px solid ${s.div}`, borderRadius:7, color:s.text, outline:"none", fontVariantNumeric:"tabular-nums" };
  const lbl   = { fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:6, display:"block" };

  const Field = ({ label, val, onChange, prefix="$" }) => (
    <div style={{ marginBottom:14 }}>
      <label style={lbl}>{label}</label>
      <div style={{ display:"flex", border:`1px solid ${s.div}`, borderRadius:7, overflow:"hidden" }}>
        <span style={{ padding:"9px 11px", fontSize:13, color:s.sub, background:s.surf, borderRight:`1px solid ${s.div}`, flexShrink:0 }}>{prefix}</span>
        <input type="number" value={val} onChange={e=>onChange(+e.target.value||0)} style={{ ...base, border:"none", borderRadius:0, flex:1 }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding:"24px 20px", maxWidth:480, margin:"0 auto" }}>
      <Eyebrow s={s} mb={24}>Configuración</Eyebrow>
      {/* PHASE 2: replace local state with Supabase persistence */}
      <div style={{ background:`${s.acc}12`, border:`1px solid ${s.acc}30`, borderRadius:8, padding:"12px 14px", marginBottom:24 }}>
        <div style={{ fontSize:10.5, fontWeight:600, color:s.acc, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:4 }}>Fase 2</div>
        <div style={{ fontSize:12, color:s.sub }}>Backup, restauración y autenticación real se integrarán con Supabase.</div>
      </div>
      {["piramides","socializadores"].map(cid=>(
        <Card s={s} key={cid} style={{ marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:14, paddingBottom:12, borderBottom:`1px solid ${s.div}` }}>{CONTRACTS[cid].label}</div>
          <Field label="Ingreso mensual esperado" val={cfg[cid].monthly} onChange={v=>setCfg(p=>({...p,[cid]:{...p[cid],monthly:v}}))} />
          <Field label="Comisión contadores (%)" val={cfg[cid].commission} onChange={v=>setCfg(p=>({...p,[cid]:{...p[cid],commission:v}}))} prefix="%" />
          <Field label="Rebate municipal mensual" val={cfg[cid].rebate} onChange={v=>setCfg(p=>({...p,[cid]:{...p[cid],rebate:v}}))} />
        </Card>
      ))}
      <Card s={s} style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:14, paddingBottom:12, borderBottom:`1px solid ${s.div}` }}>Fondo de reserva</div>
        <Field label="Meta mensual combinada" val={rsv} onChange={setRsv} />
      </Card>
      <button style={{ width:"100%", padding:12, fontSize:13, fontWeight:600, background:s.text, color:s.bg, border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>Guardar cambios</button>
    </div>
  );
}

// ════════════════════════════════════════════════════
// MOVEMENT MODAL
// ════════════════════════════════════════════════════
function MovementModal({ s, movement, role, onSave, onClose }) {
  const [form, setForm] = useState(movement?{...movement}:{ date:"2026-06-24", contract:"piramides", category:"payroll", amount:"", desc:"", method:"wire" });
  const up = (k,v) => setForm(p=>({...p,[k]:v}));
  const isDesktop = window.innerWidth>=640;
  const panelStyle = isDesktop
    ?{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:460, maxHeight:"88vh", overflowY:"auto", background:s.bg, border:`1px solid ${s.div}`, borderRadius:12, padding:24, zIndex:201 }
    :{ position:"fixed", bottom:0, left:0, right:0, maxHeight:"88vh", overflowY:"auto", background:s.bg, borderTop:`1px solid ${s.div}`, borderTopLeftRadius:16, borderTopRightRadius:16, padding:"20px 20px 36px", zIndex:201 };
  const inp = { width:"100%", padding:"9px 12px", fontSize:13, fontFamily:"inherit", background:s.bg, border:`1px solid ${s.div}`, borderRadius:7, color:s.text, outline:"none", boxSizing:"border-box" };
  const lbl = { display:"block", fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:6 };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, backdropFilter:"blur(4px)" }} />
      <div style={panelStyle}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>{movement?"Editar movimiento":"Nuevo movimiento"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}><X size={18} color={s.sub} /></button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={lbl}>Fecha</label><input type="date" value={form.date} onChange={e=>up("date",e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Contrato</label><select value={form.contract} onChange={e=>up("contract",e.target.value)} style={{...inp,cursor:"pointer"}}><option value="piramides">Pirámides</option><option value="socializadores">Socializadores</option></select></div>
          </div>
          <div><label style={lbl}>Categoría</label><select value={form.category} onChange={e=>up("category",e.target.value)} style={{...inp,cursor:"pointer"}}>{Object.entries(CAT).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={lbl}>Monto (MXN)</label><input type="number" value={form.amount} onChange={e=>up("amount",e.target.value)} placeholder="0.00" style={inp} /></div>
            <div><label style={lbl}>Método</label><select value={form.method||""} onChange={e=>up("method",e.target.value||null)} style={{...inp,cursor:"pointer"}}><option value="">N/A</option><option value="wire">Wire / Transferencia</option><option value="cash">Efectivo</option></select></div>
          </div>
          <div><label style={lbl}>Descripción</label><input type="text" value={form.desc} onChange={e=>up("desc",e.target.value)} placeholder="Descripción del movimiento" style={inp} /></div>
          {/* PHASE 2: POST to Supabase instead of local state */}
          <button onClick={()=>{if(form.amount&&form.date&&form.desc)onSave({...form,amount:+form.amount});}} style={{ padding:11, fontSize:13, fontWeight:600, background:s.text, color:s.bg, border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit", marginTop:4 }}>
            {movement?"Guardar cambios":"Registrar movimiento"}
          </button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════
// NOTIFICATIONS PANEL
// ════════════════════════════════════════════════════
function NotificationsPanel({ s, onClose }) {
  const [sel, setSel] = useState(null);
  const EMAILS = [
    { id:1, type:"movement", subject:"Nuevo movimiento registrado por asistente", preview:"Nómina 15 jun — equipo · Pirámides · $380,000", time:"15 jun, 3:47 pm",
      body:"Tu asistente registró el siguiente movimiento:\n\nConcepto: Nómina\nContrato: Pirámides\nMonto: $380,000.00\nMétodo: Wire\nFecha: 15 jun 2026\n\nSi hay un error, puedes editarlo desde Movimientos." },
    { id:2, type:"overdue",  subject:"Pago municipal vencido — Socializadores", preview:"El pago de mayo venció el 12 de junio sin registrarse.", time:"12 jun, 9:00 am",
      body:"El pago municipal de mayo del contrato Socializadores debió llegar antes del 12 de junio.\n\nMonto esperado: $357,517.25\n\nSi ya fue recibido, regístralo en Movimientos.\nSi no, contacta al municipio para seguimiento." },
    { id:3, type:"payroll",  subject:"Recordatorio: Nómina quincenal el 15 de julio", preview:"La próxima nómina se dispersa el 15 jul 2026.", time:"12 jul, 8:00 am",
      body:"La nómina quincenal está programada para el 15 de julio.\n\nPirámides — equipo: ~$430,000 (Wire)\nSocializadores — sueldo socio: $150,000 (Wire + Efectivo)\n\nAsegúrate de tener saldo disponible con los contadores." },
  ];
  const dot = { movement:s.acc, overdue:s.neg, payroll:s.warn };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:300, backdropFilter:"blur(2px)" }} />
      <div style={{ position:"fixed", right:0, top:0, bottom:0, width:360, background:s.bg, borderLeft:`1px solid ${s.div}`, zIndex:301, display:"flex", flexDirection:"column", maxWidth:"100vw" }}>
        <div style={{ padding:"18px 20px", borderBottom:`1px solid ${s.div}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:13, fontWeight:600 }}>Correos automáticos</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", display:"flex" }}><X size={16} color={s.sub} /></button>
        </div>
        {/* PHASE 2: real email delivery via Resend/SendGrid */}
        <div style={{ fontSize:10.5, color:s.sub, padding:"8px 20px", borderBottom:`1px solid ${s.div}` }}>Vista previa — integración real en Fase 2</div>
        {sel?(
          <div style={{ flex:1, overflowY:"auto", padding:20 }}>
            <button onClick={()=>setSel(null)} style={{ background:"none", border:"none", cursor:"pointer", color:s.acc, fontSize:12, fontFamily:"inherit", padding:0, marginBottom:16 }}>← Volver</button>
            <div style={{ fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:4 }}>Asunto</div>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:16, lineHeight:1.4 }}>{sel.subject}</div>
            <div style={{ padding:16, background:s.surf, borderRadius:8, border:`1px solid ${s.div}`, fontSize:13, color:s.sub, whiteSpace:"pre-line", lineHeight:1.8 }}>{sel.body}</div>
            <div style={{ fontSize:11, color:s.sub, marginTop:12 }}>Enviado: {sel.time}</div>
          </div>
        ):(
          <div style={{ flex:1, overflowY:"auto" }}>
            {EMAILS.map(e=>(
              <div key={e.id} onClick={()=>setSel(e)} style={{ padding:"15px 20px", borderBottom:`1px solid ${s.div}`, cursor:"pointer", display:"flex", gap:12, alignItems:"flex-start" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:dot[e.type], flexShrink:0, marginTop:4 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:s.text, marginBottom:3 }}>{e.subject}</div>
                  <div style={{ fontSize:11, color:s.sub, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.preview}</div>
                  <div style={{ fontSize:10, color:s.sub, marginTop:3 }}>{e.time}</div>
                </div>
                <ChevronRight size={14} color={s.sub} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════
export default function Corregidora() {
  const [dark,   setDark]   = useState(window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [view,   setView]   = useState("dashboard");
  const [role,   setRole]   = useState("owner");
  const [drawer, setDrawer] = useState(false);
  const [mvs,    setMvs]    = useState(SEED);
  const [adding, setAdding] = useState(false);
  const [editing,setEditing]= useState(null);
  const [notifs, setNotifs] = useState(false);
  const [mobile, setMobile] = useState(window.innerWidth<640);

  const s = dark?DARK:LIGHT;

  useEffect(()=>{
    const link = document.createElement("link");
    link.rel   = "stylesheet";
    link.href  = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300..700&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter Tight',-apple-system,sans-serif}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(128,128,128,.2);border-radius:2px}input,select,button,textarea{font-family:inherit}`;
    document.head.appendChild(style);
  },[]);

  useEffect(()=>{
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h  = e=>setDark(e.matches);
    mq.addEventListener("change",h);
    return ()=>mq.removeEventListener("change",h);
  },[]);

  useEffect(()=>{
    const h = ()=>setMobile(window.innerWidth<640);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);

  const activeView = role==="assistant"?"movements":view;

  const NAV = [
    {id:"dashboard",       label:"Panel principal",      Icon:Home},
    {id:"movements",       label:"Movimientos",          Icon:List},
    {id:"income_statement",label:"Estado de resultados", Icon:BarChart2},
    {id:"treasury",        label:"Tesorería",            Icon:Landmark},
    {id:"settings",        label:"Configuración",        Icon:Settings},
  ];

  // PHASE 2: replace role toggle with real Supabase auth (JWT roles: owner / assistant)
  const Sidebar = () => (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", padding:"24px 0" }}>
      <div style={{ padding:"0 20px 28px" }}>
        <div style={{ fontSize:16, fontWeight:500, letterSpacing:"-0.01em" }}>
          <span style={{ color:s.acc, marginRight:4, fontSize:22, lineHeight:1 }}>·</span>Corregidora
        </div>
      </div>
      <nav style={{ flex:1 }}>
        {NAV.map(({id,label,Icon})=>{
          const dis = role==="assistant"&&id!=="movements";
          const act = activeView===id;
          return (
            <div key={id} onClick={()=>{ if(dis)return; setView(id); setDrawer(false); }}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", cursor:dis?"not-allowed":"pointer", opacity:dis?0.25:1, color:act?s.acc:s.sub, borderLeft:act?`2px solid ${s.acc}`:"2px solid transparent", fontSize:13.5, fontWeight:act?600:400, userSelect:"none" }}>
              <Icon size={16} color={act?s.acc:s.sub} />{label}
            </div>
          );
        })}
      </nav>
      <div style={{ borderTop:`1px solid ${s.div}` }}>
        <div style={{ padding:"18px 20px 12px" }}>
          <div style={{ fontSize:10, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:10 }}>Rol en vista</div>
          <div style={{ display:"flex", gap:6 }}>
            {[["owner","Propietario"],["assistant","Asistente"]].map(([r,l])=>(
              <button key={r} onClick={()=>{ setRole(r); setView("dashboard"); }} style={{ flex:1, padding:"6px 4px", fontSize:11.5, fontWeight:500, border:`1px solid ${role===r?s.text:s.div}`, borderRadius:6, cursor:"pointer", background:role===r?s.text:"transparent", color:role===r?s.bg:s.sub, transition:"all .15s" }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0 20px 18px" }}>
          <button onClick={()=>setNotifs(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex", alignItems:"center", gap:6, color:s.sub, fontSize:12 }}>
            <Bell size={14} color={s.sub} /> Correos (3)
          </button>
          <button onClick={()=>setDark(!dark)} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}>
            {dark?<Sun size={15} color={s.sub} />:<Moon size={15} color={s.sub} />}
          </button>
        </div>
      </div>
    </div>
  );

  const VIEWS = {
    dashboard:        <DashboardView s={s} mvs={mvs} />,
    movements:        <MovementsView s={s} mvs={mvs} role={role} onAdd={()=>setAdding(true)} onEdit={m=>setEditing(m)} onDelete={id=>setMvs(p=>p.filter(m=>m.id!==id))} />,
    income_statement: <IncomeView s={s} mvs={mvs} />,
    treasury:         <TreasuryView s={s} mvs={mvs} />,
    settings:         <SettingsView s={s} />,
  };

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:s.bg, color:s.text, fontFamily:"'Inter Tight',-apple-system,sans-serif" }}>

      {/* Desktop sidebar */}
      {!mobile&&(
        <div style={{ width:232, flexShrink:0, borderRight:`1px solid ${s.div}`, background:s.bg, overflowY:"auto", height:"100vh" }}>
          <Sidebar />
        </div>
      )}

      {/* Mobile drawer */}
      {mobile&&drawer&&(
        <>
          <div onClick={()=>setDrawer(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100, backdropFilter:"blur(2px)" }} />
          <div style={{ position:"fixed", left:0, top:0, bottom:0, width:260, background:s.bg, borderRight:`1px solid ${s.div}`, zIndex:101, overflowY:"auto" }}>
            <Sidebar />
          </div>
        </>
      )}

      {/* Main */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        {mobile&&(
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:`1px solid ${s.div}`, background:s.bg, flexShrink:0 }}>
            <button onClick={()=>setDrawer(true)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", padding:4 }}><Menu size={20} color={s.text} /></button>
            <div style={{ fontSize:15, fontWeight:500 }}><span style={{ color:s.acc, marginRight:3, fontSize:18 }}>·</span>Corregidora</div>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={()=>setNotifs(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}><Bell size={18} color={s.sub} /></button>
              <button onClick={()=>setDark(!dark)} style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex" }}>{dark?<Sun size={18} color={s.sub} />:<Moon size={18} color={s.sub} />}</button>
            </div>
          </div>
        )}
        <div style={{ flex:1, overflowY:"auto" }}>{VIEWS[activeView]}</div>
      </div>

      {/* Modals */}
      {(adding||editing)&&(
        <MovementModal s={s} movement={editing} role={role}
          onSave={m=>{ if(editing){setMvs(p=>p.map(x=>x.id===m.id?m:x));setEditing(null);}else{setMvs(p=>[...p,{...m,id:Date.now(),by:role}]);setAdding(false);} }}
          onClose={()=>{ setAdding(false); setEditing(null); }}
        />
      )}
      {notifs&&<NotificationsPanel s={s} onClose={()=>setNotifs(false)} />}
    </div>
  );
}
