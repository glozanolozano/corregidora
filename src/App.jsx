import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

// ════════════════════════════════════════════════════
// DESIGN TOKENS
// ════════════════════════════════════════════════════
const LIGHT = {
  bg:"#FFFFFF", card:"#FFFFFF", text:"#1A1A1A", sub:"#7A7A7A", muted:"#B0B0B0",
  div:"#E8E8E8", surf:"#F4F4F4", acc:"#4A5E80", neg:"#B8453A", warn:"#C07B2C",
  green:"#2D7A4F", inputBg:"#FAFAFA",
};
const DARK = {
  bg:"#000000", card:"#111111", text:"#F0F0F0", sub:"#888888", muted:"#555555",
  div:"#1E1E1E", surf:"#0A0A0A", acc:"#6B8ABF", neg:"#D4604F", warn:"#D4901F",
  green:"#4CAF7A", inputBg:"#0D0D0D",
};

// ════════════════════════════════════════════════════
// BUSINESS CONSTANTS
// ════════════════════════════════════════════════════
const CONTRACTS = {
  piramides:      { label:"Pirámides",      monthly:854545.45, rebate:150000 },
  socializadores: { label:"Socializadores", monthly:357517.25, rebate:50000  },
};
const RESERVE_TARGET = 140000;
const MONTHS_ALL = ["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11","2026-12"];
const ML = ym => ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+ym.split("-")[1]-1];

const CAT = {
  income:              { label:"Ingreso municipal",          sign:+1, ac:true,  icon:"↓", color:"#2D7A4F" },
  commission:          { label:"Comisión contadores",        sign:-1, ac:true,  icon:"↑", color:"#B8453A" },
  payroll_team:        { label:"Nómina equipo",              sign:-1, ac:true,  icon:"↑", color:"#B8453A" },
  payroll_gl:          { label:"Salario GL",                 sign:-1, ac:true,  icon:"↑", color:"#C07B2C" },
  rebate:              { label:"Reembolso al municipio",     sign:-1, ac:true,  icon:"↑", color:"#C07B2C" },
  reserve_fund:        { label:"Fondo de reserva",           sign:-1, ac:true,  icon:"↑", color:"#4A5E80" },
  extraordinary:       { label:"Gasto extraordinario",       sign:-1, ac:false, icon:"↑", color:"#B8453A" },
  loan_received:       { label:"Préstamo del socio",         sign:+1, ac:true,  icon:"↓", color:"#4A5E80" },
  loan_repayment:      { label:"Pago de préstamo al socio",  sign:-1, ac:true,  icon:"↑", color:"#B8453A" },
  profit_distribution: { label:"Retiro del socio",           sign:-1, ac:true,  icon:"↑", color:"#C07B2C" },
};

// Data loaded from Supabase at runtime

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
const $n = (n, d=0) => {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const s = new Intl.NumberFormat("es-MX",{minimumFractionDigits:d,maximumFractionDigits:d}).format(abs);
  return `$${s}`;
};
const $s = (n, d=0) => {
  if (n === 0) return "—";
  const neg = n < 0;
  return `${neg?"−":""}${$n(Math.abs(n),d)}`;
};
const fmtDate = d => {
  const [,m,day] = d.split("-");
  const names = "Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic".split(" ");
  return `${+day} ${names[+m-1]}`;
};
const fmtDateFull = d => {
  const [y,m,day] = d.split("-");
  const names = "Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic".split(" ");
  return `${+day} ${names[+m-1]} ${y}`;
};

// ════════════════════════════════════════════════════
// CALCULATIONS
// ════════════════════════════════════════════════════
const calcBalance = ms => ms.reduce((sum,m) => CAT[m.category].ac ? sum + CAT[m.category].sign * m.amount : sum, 0);
const calcLoans   = ms => ms.filter(m=>m.category==="loan_received").reduce((s,m)=>s+m.amount,0)
                         - ms.filter(m=>m.category==="loan_repayment").reduce((s,m)=>s+m.amount,0);
const calcReserve = ms => ms.filter(m=>m.category==="reserve_fund").reduce((s,m)=>s+m.amount,0)
                         - ms.filter(m=>m.category==="extraordinary").reduce((s,m)=>s+m.amount,0);

// ════════════════════════════════════════════════════
// EXPORT HELPERS
// ════════════════════════════════════════════════════
const $raw = (n, d=2) => new Intl.NumberFormat("es-MX",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);

const exportExcel = (rows, cols, filename) => {
  const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

const exportPDF = (title, cols, rows, filename, landscape=false) => {
  const doc = new jsPDF({orientation:landscape?"l":"p", unit:"mm", format:"letter"});
  doc.setFont("helvetica","bold"); doc.setFontSize(14);
  doc.text(title, 14, 18);
  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}`, 14, 24);
  doc.autoTable({
    startY:30, head:[cols], body:rows,
    styles:{fontSize:8, cellPadding:2.5, font:"helvetica"},
    headStyles:{fillColor:[74,95,128], textColor:255, fontStyle:"bold"},
    alternateRowStyles:{fillColor:[248,248,248]},
    margin:{left:14,right:14},
  });
  doc.save(`${filename}.pdf`);
};

const ExportBar = ({s, onExcel, onPDF}) => (
  <div style={{display:"flex", gap:8}}>
    <button onClick={onExcel} style={{display:"flex", alignItems:"center", gap:5, padding:"7px 12px", fontSize:12, fontWeight:500, fontFamily:"inherit", border:`1px solid ${s.div}`, borderRadius:7, background:s.inputBg, color:s.sub, cursor:"pointer"}}>↓ Excel</button>
    <button onClick={onPDF} style={{display:"flex", alignItems:"center", gap:5, padding:"7px 12px", fontSize:12, fontWeight:500, fontFamily:"inherit", border:`1px solid ${s.div}`, borderRadius:7, background:s.inputBg, color:s.sub, cursor:"pointer"}}>↓ PDF</button>
  </div>
);
const Eyebrow = ({s, children, mb=6}) => (
  <div style={{fontSize:11, fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", color:s.sub, marginBottom:mb}}>{children}</div>
);

// ════════════════════════════════════════════════════
// 1. PANEL PRINCIPAL (consolidated)
// ════════════════════════════════════════════════════
function DashboardView({s, mvs}) {
  const balance  = calcBalance(mvs);
  const loans    = calcLoans(mvs);
  const reserve  = calcReserve(mvs);
  const curMonth = "2026-06";
  const mm       = mvs.filter(m=>m.date.startsWith(curMonth));
  const inc      = mm.filter(m=>m.category==="income").reduce((s,m)=>s+m.amount,0);
  const com      = mm.filter(m=>m.category==="commission").reduce((s,m)=>s+m.amount,0);
  const payTeam  = mm.filter(m=>m.category==="payroll_team").reduce((s,m)=>s+m.amount,0);
  const payGL    = mm.filter(m=>m.category==="payroll_gl").reduce((s,m)=>s+m.amount,0);
  const reb      = mm.filter(m=>m.category==="rebate").reduce((s,m)=>s+m.amount,0);
  const rsv      = mm.filter(m=>m.category==="reserve_fund").reduce((s,m)=>s+m.amount,0);
  const ext      = mm.filter(m=>m.category==="extraordinary").reduce((s,m)=>s+m.amount,0);
  const dist     = mm.filter(m=>m.category==="profit_distribution").reduce((s,m)=>s+m.amount,0);
  const loanPay  = mm.filter(m=>m.category==="loan_repayment").reduce((s,m)=>s+m.amount,0);
  const totalExp = com+payTeam+payGL+reb+rsv+ext;
  const profit   = inc - totalExp;

  // Acumulados mes a mes
  const accumData = useMemo(() => {
    let profitAcc = 0, reserveAcc = 0;
    return MONTHS_ALL.map(ym => {
      const mo = mvs.filter(m=>m.date.startsWith(ym));
      const mInc = mo.filter(m=>m.category==="income").reduce((s,m)=>s+m.amount,0);
      const mExp = mo.filter(m=>["commission","payroll_team","payroll_gl","rebate","reserve_fund","extraordinary"].includes(m.category)).reduce((s,m)=>s+m.amount,0);
      const mRsv = mo.filter(m=>m.category==="reserve_fund").reduce((s,m)=>s+m.amount,0);
      const mExt = mo.filter(m=>m.category==="extraordinary").reduce((s,m)=>s+m.amount,0);
      profitAcc += (mInc - mExp);
      reserveAcc += (mRsv - mExt);
      return {ym, profit:mInc-mExp, profitAcc, reserve:mRsv-mExt, reserveAcc, hasData:mo.length>0};
    });
  }, [mvs]);

  const section = {marginBottom:36};
  const row = {display:"flex", justifyContent:"space-between", alignItems:"center", padding:"13px 0"};
  const labelSt = {fontSize:15, color:s.text};
  const valSt = {fontSize:15, fontVariantNumeric:"tabular-nums", fontWeight:500};

  return (
    <div style={{padding:"36px 28px", maxWidth:660, margin:"0 auto"}}>
      {/* ── HERO ── */}
      <div style={section}>
        <Eyebrow s={s} mb={12}>Dinero en manos de contadores</Eyebrow>
        <div style={{fontSize:60, fontWeight:280, letterSpacing:"-0.03em", lineHeight:1, fontVariantNumeric:"tabular-nums", color:balance<0?s.neg:s.text}}>
          {$n(balance,2)}
        </div>
      </div>

      {/* ── ESTATUS GENERAL ── */}
      <div style={{...section, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:1, background:s.div, borderRadius:10, overflow:"hidden"}}>
        {[
          {label:"Préstamos pendientes", val:loans, neg:loans>0},
          {label:"Fondo de reserva",     val:reserve},
          {label:"Utilidad del mes",     val:profit, signed:true, neg:profit<0},
        ].map((item,i) => (
          <div key={i} style={{background:s.card, padding:"18px 20px"}}>
            <div style={{fontSize:11, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:8}}>{item.label}</div>
            <div style={{fontSize:24, fontWeight:400, fontVariantNumeric:"tabular-nums", color:item.neg?s.neg:s.text}}>{item.signed?$s(item.val):$n(Math.abs(item.val))}</div>
            {item.label==="Fondo de reserva"&&(
              <div style={{marginTop:8, height:3, background:s.div, borderRadius:2}}>
                <div style={{height:"100%", width:`${Math.min(100,(reserve/RESERVE_TARGET)*100)}%`, background:s.acc, borderRadius:2, transition:"width .3s"}} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── ACUMULADOS ── */}
      <div style={section}>
        <Eyebrow s={s} mb={14}>Acumulados — Abr a Dic 2026</Eyebrow>
        <div style={{border:`1px solid ${s.div}`, borderRadius:10, overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <div style={{minWidth:500}}>
              <div style={{display:"grid", gridTemplateColumns:"0.7fr 1fr 1fr 1fr 1fr", padding:"11px 18px", borderBottom:`1px solid ${s.div}`, background:s.surf}}>
                {["Mes","Utilidad","Ut. acumulada","Reserva","Rsv. acumulada"].map((h,i) => (
                  <div key={i} style={{fontSize:11, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", color:s.sub, textAlign:i>0?"right":"left"}}>{h}</div>
                ))}
              </div>
              {accumData.map((d,i) => (
                <div key={d.ym} style={{display:"grid", gridTemplateColumns:"0.7fr 1fr 1fr 1fr 1fr", padding:"11px 18px", borderBottom:i<accumData.length-1?`1px solid ${s.div}`:"none", opacity:d.hasData?1:0.35}}>
                  <div style={{fontSize:14, fontWeight:500}}>{ML(d.ym)}</div>
                  <div style={{fontSize:14, fontVariantNumeric:"tabular-nums", textAlign:"right", color:d.profit<0?s.neg:d.profit>0?s.text:s.muted}}>{d.hasData?$s(d.profit):"—"}</div>
                  <div style={{fontSize:14, fontVariantNumeric:"tabular-nums", textAlign:"right", fontWeight:600, color:d.profitAcc<0?s.neg:s.text}}>{d.hasData?$s(d.profitAcc):"—"}</div>
                  <div style={{fontSize:14, fontVariantNumeric:"tabular-nums", textAlign:"right", color:d.reserve>0?s.text:s.muted}}>{d.hasData&&d.reserve>0?$n(d.reserve):"—"}</div>
                  <div style={{fontSize:14, fontVariantNumeric:"tabular-nums", textAlign:"right", fontWeight:600, color:s.text}}>{d.reserveAcc>0?$n(d.reserveAcc):"—"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── INGRESOS & COBRANZAS ── */}
      <div style={section}>
        <Eyebrow s={s} mb={14}>Ingresos — Cobranza municipal</Eyebrow>
        <div style={{border:`1px solid ${s.div}`, borderRadius:10, overflow:"hidden"}}>
          {[
            {label:"Pirámides — Mayo",      status:"cobrado", date:"9 Jun 2026",  amount:CONTRACTS.piramides.monthly,      ok:true},
            {label:"Pirámides — Junio",      status:"pendiente", date:"Est. 12 Jul", amount:CONTRACTS.piramides.monthly,    ok:false},
            {label:"Socializadores — Abril", status:"vencido",  date:"Venció 12 May", amount:CONTRACTS.socializadores.monthly, ok:false, overdue:true},
            {label:"Socializadores — Mayo",  status:"vencido",  date:"Venció 12 Jun", amount:CONTRACTS.socializadores.monthly, ok:false, overdue:true},
            {label:"Socializadores — Junio", status:"pendiente", date:"Est. 12 Jul", amount:CONTRACTS.socializadores.monthly, ok:false},
          ].map((item,i,arr) => (
            <div key={i} style={{...row, padding:"13px 18px", borderBottom:i<arr.length-1?`1px solid ${s.div}`:"none"}}>
              <div>
                <div style={{fontSize:15, fontWeight:500, color:s.text}}>{item.label}</div>
                <div style={{fontSize:13, color:item.overdue?s.neg:s.sub, marginTop:2}}>{item.date}</div>
              </div>
              <div style={{textAlign:"right", display:"flex", alignItems:"center", gap:12}}>
                <span style={{...valSt, color:s.text}}>{$n(item.amount)}</span>
                <span style={{fontSize:10, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", padding:"3px 8px", borderRadius:4,
                  background:item.ok?`${s.green}18`:item.overdue?`${s.neg}15`:`${s.warn}15`,
                  color:item.ok?s.green:item.overdue?s.neg:s.warn
                }}>{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── EGRESOS DEL MES ── */}
      <div style={section}>
        <Eyebrow s={s} mb={14}>Egresos — Junio 2026</Eyebrow>
        <div style={{border:`1px solid ${s.div}`, borderRadius:10, overflow:"hidden"}}>
          {[
            {label:"Comisión contadores",        val:com},
            {label:"Nómina equipo",              val:payTeam},
            {label:"Salario GL",                 val:payGL},
            {label:"Reembolso al municipio",     val:reb},
            {label:"Fondo de reserva",           val:rsv},
            {label:"Gastos extraordinarios",     val:ext},
            {label:"Pago préstamos al socio",    val:loanPay},
            {label:"Retiro del socio",           val:dist},
          ].map((item,i,arr) => (
            <div key={i} style={{...row, padding:"11px 18px", borderBottom:i<arr.length-1?`1px solid ${s.div}`:"none"}}>
              <span style={labelSt}>{item.label}</span>
              <span style={{...valSt, color:item.val>0?s.neg:s.muted}}>{item.val>0?`−${$n(item.val)}`:"—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CIERRE ── */}
      <div style={{display:"flex", alignItems:"center", gap:12, padding:"14px 18px", border:`1px solid ${s.div}`, borderRadius:10}}>
        <div style={{width:10, height:10, borderRadius:"50%", background:s.warn, flexShrink:0}} />
        <div>
          <div style={{fontSize:15, fontWeight:500}}>Cierre de junio — incompleto</div>
          <div style={{fontSize:13, color:s.sub, marginTop:3}}>3 pagos de Socializadores sin registrar. Reembolso Pirámides parcial.</div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// 2. MOVIMIENTOS (Libro Mayor)
// ════════════════════════════════════════════════════
function MovementsView({s, mvs, role, onAdd, onEdit, onDelete}) {
  const [fC, setFC]     = useState("all");
  const [search, setSrch] = useState("");
  const [asc, setAsc]   = useState(false);

  const list = useMemo(() => {
    return mvs
      .filter(m => (fC==="all" || m.contract===fC))
      .filter(m => !search || m.desc.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => { const c = a.date.localeCompare(b.date)||a.id-b.id; return asc?c:-c; });
  }, [mvs, fC, search, asc]);

  const canAct = m => role==="owner" || m.by==="assistant";
  const inp = {padding:"10px 14px", fontSize:14, fontFamily:"inherit", border:`1px solid ${s.div}`, borderRadius:8, background:s.inputBg, color:s.text, outline:"none", boxSizing:"border-box"};

  return (
    <div style={{padding:"32px 24px", maxWidth:860, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24}}>
        <div>
          <Eyebrow s={s} mb={6}>Libro mayor</Eyebrow>
          <div style={{fontSize:24, fontWeight:600, letterSpacing:"-0.02em"}}>Movimientos</div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <ExportBar s={s}
            onExcel={()=>{
              const rows = list.map(m=>[m.date, CONTRACTS[m.contract].label, CAT[m.category].label, CAT[m.category].sign>0?m.amount:-m.amount, m.method==="wire"?"Transferencia":m.method==="cash"?"Efectivo":"", m.desc, m.by==="assistant"?"Asistente":"Propietario"]);
              exportExcel(rows, ["Fecha","Contrato","Categoría","Monto","Método","Descripción","Registrado por"], "movimientos");
            }}
            onPDF={()=>{
              const rows = list.map(m=>[fmtDate(m.date), CONTRACTS[m.contract].label, CAT[m.category].label, `$${$raw(CAT[m.category].sign>0?m.amount:-m.amount)}`, m.method==="wire"?"Transf.":m.method==="cash"?"Efectivo":"—", m.desc]);
              exportPDF("Movimientos — Corregidora", ["Fecha","Contrato","Categoría","Monto","Método","Descripción"], rows, "movimientos", true);
            }}
          />
          <button onClick={onAdd} style={{display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:8, background:s.acc, color:"#fff", border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:500}}>
            + Nuevo
          </button>
        </div>
      </div>

      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:24}}>
        <div style={{position:"relative", flex:"1 1 200px"}}>
          <input value={search} onChange={e=>setSrch(e.target.value)} placeholder="Buscar por descripción" style={{...inp, width:"100%", paddingLeft:36}} />
          <span style={{position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:s.muted, fontSize:14}}>⌕</span>
        </div>
        <select value={fC} onChange={e=>setFC(e.target.value)} style={{...inp, cursor:"pointer", minWidth:180}}>
          <option value="all">Todos los contratos</option>
          <option value="piramides">Pirámides</option>
          <option value="socializadores">Socializadores</option>
        </select>
        <button onClick={()=>setAsc(!asc)} style={{...inp, cursor:"pointer", display:"flex", alignItems:"center", gap:6, background:s.inputBg, color:s.sub, whiteSpace:"nowrap"}}>
          {asc?"Más antiguo primero":"Más reciente primero"}
        </button>
      </div>

      <div>
        {list.length===0 ? (
          <div style={{padding:40, textAlign:"center", color:s.sub, fontSize:14}}>Sin movimientos para esta selección</div>
        ) : list.map((m,i) => {
          const cat = CAT[m.category];
          const pos = cat.sign > 0;
          const methodLabel = m.method==="wire"?"Transferencia":m.method==="cash"?"Efectivo":null;
          return (
            <div key={m.id} onClick={()=>canAct(m)&&onEdit(m)}
              style={{display:"flex", alignItems:"center", gap:14, padding:"14px 0", borderBottom:`1px solid ${s.div}`, cursor:canAct(m)?"pointer":"default"}}>
              <div style={{width:36, height:36, borderRadius:"50%", background:`${cat.color}15`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                <span style={{fontSize:16, color:cat.color, lineHeight:1}}>{cat.icon}</span>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:14, fontWeight:600, color:s.text}}>{m.desc || cat.label}</div>
                <div style={{fontSize:12, color:s.sub, marginTop:2}}>
                  {fmtDate(m.date)} · {CONTRACTS[m.contract].label}
                  {methodLabel && ` · ${methodLabel}`}
                  {m.by==="assistant" && <span style={{marginLeft:6, color:s.acc, fontSize:11}}>Asistente</span>}
                </div>
              </div>
              <div style={{fontSize:14, fontWeight:600, fontVariantNumeric:"tabular-nums", color:pos?s.green:s.neg, textAlign:"right", flexShrink:0}}>
                {pos?"":"\u2212"}{$n(m.amount,2)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{fontSize:12, color:s.sub, marginTop:20}}>{list.length} movimiento{list.length!==1?"s":""}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// 3. ESTADO DE RESULTADOS
// ════════════════════════════════════════════════════
function IncomeView({s, mvs}) {
  const [tab, setTab] = useState("all");
  const TABS = [{id:"piramides",label:"Pirámides"},{id:"socializadores",label:"Socializadores"},{id:"all",label:"Consolidado"}];

  const getData = (c, ym) => {
    const mm = mvs.filter(m => m.date.startsWith(ym) && (c==="all" || m.contract===c));
    const sum = k => mm.filter(m=>m.category===k).reduce((s,m)=>s+m.amount,0);
    const inc=sum("income"), com=sum("commission"), payTeam=sum("payroll_team"), payGL=sum("payroll_gl"), reb=sum("rebate"), rsv=sum("reserve_fund"), ext=sum("extraordinary"), dist=sum("profit_distribution");
    const totalExp = com+payTeam+payGL+reb+rsv+ext;
    return {inc, com, payTeam, payGL, reb, rsv, ext, gen:inc-totalExp, dist, ret:inc-totalExp-dist};
  };

  const ROWS = [
    {key:"inc",     label:"Ingresos",                 bold:false},
    {key:"com",     label:"Comisión contadores",       bold:false},
    {key:"payTeam", label:"Nómina equipo",             bold:false},
    {key:"payGL",   label:"Salario GL",                bold:false},
    {key:"reb",     label:"Reembolso municipio",       bold:false},
    {key:"rsv",     label:"Fondo de reserva",          bold:false},
    {key:"ext",     label:"Gastos extraordinarios",    bold:false},
    {key:"gen",     label:"Utilidad generada",         bold:true, sep:true},
    {key:"dist",    label:"Utilidad distribuida",      bold:false},
    {key:"ret",     label:"Utilidad retenida",         bold:true, sep:true},
  ];

  const data = MONTHS_ALL.map(ym => getData(tab, ym));
  const thSt = {padding:"12px 14px", fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, borderBottom:`1px solid ${s.div}`, whiteSpace:"nowrap"};

  return (
    <div style={{padding:"32px 24px", maxWidth:1100, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4}}>
        <div>
          <Eyebrow s={s} mb={6}>2026</Eyebrow>
          <div style={{fontSize:24, fontWeight:600, letterSpacing:"-0.02em"}}>Estado de resultados</div>
        </div>
        <ExportBar s={s}
          onExcel={()=>{
            const header = ["Concepto", ...MONTHS_ALL.map(ym=>ML(ym))];
            const rows = ROWS.map(row => [row.label, ...data.map(d => d[row.key]===0?"":(["com","payTeam","payGL","reb","rsv","ext","dist"].includes(row.key)?-d[row.key]:d[row.key]))]);
            exportExcel(rows, header, `estado_resultados_${tab}`);
          }}
          onPDF={()=>{
            const header = ["Concepto", ...MONTHS_ALL.map(ym=>ML(ym))];
            const rows = ROWS.map(row => [row.label, ...data.map(d => {const v=d[row.key]; const isE=["com","payTeam","payGL","reb","rsv","ext","dist"].includes(row.key); if(v===0) return "—"; if(isE) return `-$${$raw(v,0)}`; if(row.bold&&v<0) return `−$${$raw(Math.abs(v),0)}`; return `$${$raw(v,0)}`;})]);
            exportPDF(`Estado de resultados — ${TABS.find(t=>t.id===tab).label}`, header, rows, `estado_resultados_${tab}`, true);
          }}
        />
      </div>

      <div style={{display:"flex", gap:0, marginBottom:28, background:s.surf, borderRadius:8, padding:3, width:"fit-content"}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"8px 18px", fontSize:13, fontWeight:500, border:"none", cursor:"pointer", fontFamily:"inherit",
            borderRadius:6, transition:"all .15s",
            background:tab===t.id?s.text:"transparent",
            color:tab===t.id?(s===LIGHT?"#fff":"#000"):s.sub,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{overflowX:"auto", borderRadius:10, border:`1px solid ${s.div}`}}>
        <table style={{width:"100%", borderCollapse:"collapse", minWidth:700, tableLayout:"fixed"}}>
          <thead>
            <tr>
              <th style={{...thSt, textAlign:"left", position:"sticky", left:0, background:s.card, zIndex:1, width:"18%"}}>Concepto</th>
              {MONTHS_ALL.map(ym => <th key={ym} style={{...thSt, textAlign:"right"}}>{ML(ym)}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.key} style={{borderTop:row.sep?`2px solid ${s.div}`:undefined}}>
                <td style={{padding:"14px 14px", fontSize:14, fontWeight:row.bold?600:400, color:s.text, borderBottom:`1px solid ${s.div}`, position:"sticky", left:0, background:s.card, zIndex:1, width:"18%"}}>
                  {row.label}
                </td>
                {data.map((d,mi) => {
                  const v = d[row.key];
                  const isExp = ["com","payTeam","payGL","reb","rsv","ext","dist"].includes(row.key);
                  const isTotal = row.bold;
                  const col = v===0 ? s.muted : (isExp||(isTotal&&v<0)) ? s.neg : s.text;
                  let display = "—";
                  if (v !== 0) {
                    if (isExp) display = `−${$n(v)}`;
                    else if (isTotal) display = $s(v);
                    else display = $n(v);
                  }
                  return (
                    <td key={mi} style={{padding:"14px 14px", fontSize:14, textAlign:"right", fontVariantNumeric:"tabular-nums", fontWeight:row.bold?600:400, color:col, borderBottom:`1px solid ${s.div}`, whiteSpace:"nowrap"}}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:12, color:s.sub, marginTop:12}}>Montos en pesos mexicanos, redondeados. Desliza horizontalmente para ver todos los meses.</div>
    </div>
  );
}

// ════════════════════════════════════════════════════
// 4. CONFIGURACIÓN
// ════════════════════════════════════════════════════
function SettingsView({s}) {
  const [cfg, setCfg] = useState({piramides:{monthly:854545.45,commission:8,rebate:150000},socializadores:{monthly:357517.25,commission:8,rebate:50000}});
  const [rsv, setRsv] = useState(140000);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const {data} = await supabase.from("app_settings").select("*").eq("id",1).single();
      if (data) {
        setCfg({
          piramides:{monthly:+data.piramides_monthly, commission:+data.piramides_commission, rebate:+data.piramides_rebate},
          socializadores:{monthly:+data.socializadores_monthly, commission:+data.socializadores_commission, rebate:+data.socializadores_rebate},
        });
        setRsv(+data.reserve_target);
      }
    })();
  }, []);

  const handleSave = async () => {
    await supabase.from("app_settings").update({
      piramides_monthly:cfg.piramides.monthly, piramides_commission:cfg.piramides.commission, piramides_rebate:cfg.piramides.rebate,
      socializadores_monthly:cfg.socializadores.monthly, socializadores_commission:cfg.socializadores.commission, socializadores_rebate:cfg.socializadores.rebate,
      reserve_target:rsv,
    }).eq("id",1);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
  };

  const inp = {width:"100%", padding:"10px 14px", fontSize:14, fontFamily:"inherit", background:s.inputBg, border:`1px solid ${s.div}`, borderRadius:8, color:s.text, outline:"none", boxSizing:"border-box", fontVariantNumeric:"tabular-nums"};
  const lbl = {fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:6, display:"block"};

  const Field = ({label, val, onChange, prefix="$"}) => (
    <div style={{marginBottom:16}}>
      <label style={lbl}>{label}</label>
      <div style={{display:"flex", border:`1px solid ${s.div}`, borderRadius:8, overflow:"hidden"}}>
        <span style={{padding:"10px 12px", fontSize:14, color:s.sub, background:s.surf, borderRight:`1px solid ${s.div}`, flexShrink:0}}>{prefix}</span>
        <input type="number" value={val} onChange={e=>onChange(+e.target.value||0)} style={{...inp, border:"none", borderRadius:0, flex:1}} />
      </div>
    </div>
  );

  return (
    <div style={{padding:"32px 24px", maxWidth:500, margin:"0 auto"}}>
      <Eyebrow s={s} mb={6}>Administración</Eyebrow>
      <div style={{fontSize:24, fontWeight:600, letterSpacing:"-0.02em", marginBottom:28}}>Configuración</div>
      {["piramides","socializadores"].map(cid => (
        <div key={cid} style={{border:`1px solid ${s.div}`, borderRadius:10, padding:20, marginBottom:16}}>
          <div style={{fontSize:15, fontWeight:600, marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${s.div}`}}>{CONTRACTS[cid].label}</div>
          <Field label="Ingreso mensual esperado" val={cfg[cid].monthly} onChange={v=>setCfg(p=>({...p,[cid]:{...p[cid],monthly:v}}))} />
          <Field label="Comisión contadores (%)" val={cfg[cid].commission} onChange={v=>setCfg(p=>({...p,[cid]:{...p[cid],commission:v}}))} prefix="%" />
          <Field label="Reembolso municipal mensual" val={cfg[cid].rebate} onChange={v=>setCfg(p=>({...p,[cid]:{...p[cid],rebate:v}}))} />
        </div>
      ))}
      <div style={{border:`1px solid ${s.div}`, borderRadius:10, padding:20, marginBottom:24}}>
        <div style={{fontSize:15, fontWeight:600, marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${s.div}`}}>Fondo de reserva</div>
        <Field label="Meta mensual combinada" val={rsv} onChange={setRsv} />
      </div>
      <button onClick={handleSave} style={{width:"100%", padding:13, fontSize:14, fontWeight:600, background:saved?s.green:s.acc, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit", transition:"background .2s"}}>
        {saved?"Guardado ✓":"Guardar cambios"}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════
// 5. RETORNOS MUNICIPIO
// ════════════════════════════════════════════════════
function RebatesView({s}) {
  const [data, setData] = useState([]);
  const [fC, setFC]     = useState("all");
  const [editing, setEd]= useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRebates = useCallback(async () => {
    const {data:rows} = await supabase.from("rebates").select("*").order("month").order("contract");
    if (rows) setData(rows.map(r => ({...r, amount:+r.amount})));
    setLoading(false);
  }, []);

  useEffect(() => { fetchRebates(); }, [fetchRebates]);

  const list = data.filter(r => fC==="all" || r.contract===fC).sort((a,b) => a.month.localeCompare(b.month) || a.contract.localeCompare(b.contract));

  const summary = (cid) => {
    const rows   = data.filter(r => r.contract===cid);
    const target = CONTRACTS[cid].rebate;
    const paid   = rows.reduce((s,r)=>s+r.amount,0);
    const months = rows.length;
    const complete = rows.filter(r=>r.status==="pagado").length;
    return {paid, total:target*months, complete, months};
  };

  const badge = (st) => {
    const map = {
      pagado:   {bg:`${s.green}18`, color:s.green, label:"Pagado"},
      parcial:  {bg:`${s.warn}15`,  color:s.warn,  label:"Parcial"},
      pendiente:{bg:`${s.neg}12`,   color:s.neg,   label:"Pendiente"},
    };
    const c = map[st] || map.pendiente;
    return <span style={{fontSize:10.5, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", padding:"3px 8px", borderRadius:4, background:c.bg, color:c.color}}>{c.label}</span>;
  };

  const inp = {width:"100%", padding:"10px 14px", fontSize:14, fontFamily:"inherit", background:s.inputBg, border:`1px solid ${s.div}`, borderRadius:8, color:s.text, outline:"none", boxSizing:"border-box"};
  const lbl = {display:"block", fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:6};

  return (
    <div style={{padding:"32px 24px", maxWidth:800, margin:"0 auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28}}>
        <div>
          <Eyebrow s={s} mb={6}>Control de reembolsos</Eyebrow>
          <div style={{fontSize:24, fontWeight:600, letterSpacing:"-0.02em"}}>Retornos municipio</div>
        </div>
        <ExportBar s={s}
          onExcel={()=>{
            const rows = list.map(r=>[CONTRACTS[r.contract].label, `${ML(r.month)} 2026`, CONTRACTS[r.contract].rebate, r.amount, r.date||"", r.status]);
            exportExcel(rows, ["Contrato","Mes","Esperado","Pagado","Fecha","Estatus"], "retornos_municipio");
          }}
          onPDF={()=>{
            const rows = list.map(r=>[CONTRACTS[r.contract].label, `${ML(r.month)} 2026`, `$${$raw(CONTRACTS[r.contract].rebate,0)}`, r.amount>0?`$${$raw(r.amount,0)}`:"—", r.date?fmtDate(r.date):"—", r.status]);
            exportPDF("Retornos municipio — Corregidora", ["Contrato","Mes","Esperado","Pagado","Fecha","Estatus"], rows, "retornos_municipio");
          }}
        />
      </div>

      {/* Summary */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:s.div, borderRadius:10, overflow:"hidden", marginBottom:28}}>
        {["piramides","socializadores"].map(cid => {
          const sm = summary(cid);
          const pct = sm.total>0 ? Math.min(100,(sm.paid/sm.total)*100) : 0;
          return (
            <div key={cid} style={{background:s.card, padding:"18px 20px"}}>
              <div style={{fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:8}}>{CONTRACTS[cid].label}</div>
              <div style={{fontSize:22, fontWeight:400, fontVariantNumeric:"tabular-nums"}}>{$n(sm.paid)}</div>
              <div style={{fontSize:12, color:s.sub, marginTop:4}}>de {$n(sm.total)} esperados · {sm.complete}/{sm.months} completos</div>
              <div style={{marginTop:10, height:3, background:s.div, borderRadius:2}}>
                <div style={{height:"100%", width:`${pct}%`, background:pct>=90?s.green:s.warn, borderRadius:2, transition:"width .3s"}} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div style={{marginBottom:20}}>
        <select value={fC} onChange={e=>setFC(e.target.value)} style={{padding:"10px 14px", fontSize:14, fontFamily:"inherit", border:`1px solid ${s.div}`, borderRadius:8, background:s.inputBg, color:s.text, outline:"none", cursor:"pointer"}}>
          <option value="all">Todos los contratos</option>
          <option value="piramides">Pirámides</option>
          <option value="socializadores">Socializadores</option>
        </select>
      </div>

      {/* Table */}
      <div style={{border:`1px solid ${s.div}`, borderRadius:10, overflow:"hidden"}}>
        <div style={{display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.7fr", padding:"10px 18px", borderBottom:`1px solid ${s.div}`, background:s.surf}}>
          {["Contrato / Mes","Esperado","Pagado","Fecha","Estatus"].map((h,i) => (
            <div key={i} style={{fontSize:10.5, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", color:s.sub, textAlign:i>=1&&i<=3?"right":"left"}}>{h}</div>
          ))}
        </div>
        {list.map((r,i) => {
          const target = CONTRACTS[r.contract].rebate;
          return (
            <div key={r.id} onClick={()=>setEd({...r})} style={{display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 1fr 0.7fr", padding:"13px 18px", borderBottom:i<list.length-1?`1px solid ${s.div}`:"none", cursor:"pointer", alignItems:"center"}}>
              <div>
                <div style={{fontSize:14, fontWeight:500}}>{CONTRACTS[r.contract].label}</div>
                <div style={{fontSize:12, color:s.sub, marginTop:1}}>{ML(r.month)} 2026</div>
              </div>
              <div style={{fontSize:14, fontVariantNumeric:"tabular-nums", textAlign:"right", color:s.sub}}>{$n(target)}</div>
              <div style={{fontSize:14, fontVariantNumeric:"tabular-nums", textAlign:"right", fontWeight:500, color:r.amount>=target?s.text:r.amount>0?s.warn:s.muted}}>{r.amount>0?$n(Math.round(r.amount)):"—"}</div>
              <div style={{fontSize:13, textAlign:"right", color:s.sub}}>{r.date?fmtDate(r.date):"—"}</div>
              <div style={{textAlign:"right"}}>{badge(r.status)}</div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <>
          <div onClick={()=>setEd(null)} style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:200, backdropFilter:"blur(3px)"}} />
          <div style={{position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:420, maxHeight:"88vh", overflowY:"auto", background:s.card, borderRadius:14, padding:28, zIndex:201, boxShadow:"0 24px 80px rgba(0,0,0,0.2)"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
              <div>
                <Eyebrow s={s} mb={4}>Editar</Eyebrow>
                <div style={{fontSize:20, fontWeight:600}}>Retorno municipal</div>
              </div>
              <button onClick={()=>setEd(null)} style={{background:"none", border:"none", cursor:"pointer", padding:6, fontSize:20, color:s.sub, lineHeight:1}}>✕</button>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:16}}>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                <div><label style={lbl}>Contrato</label><div style={{...inp, background:s.surf, color:s.sub}}>{CONTRACTS[editing.contract].label}</div></div>
                <div><label style={lbl}>Mes correspondiente</label><div style={{...inp, background:s.surf, color:s.sub}}>{ML(editing.month)} 2026</div></div>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                <div><label style={lbl}>Monto pagado</label><input type="number" value={editing.amount} onChange={e=>setEd({...editing,amount:+e.target.value||0})} style={inp} /></div>
                <div><label style={lbl}>Fecha de pago</label><input type="date" value={editing.date||""} onChange={e=>setEd({...editing,date:e.target.value||null})} style={inp} /></div>
              </div>
              <div><label style={lbl}>Estatus</label><select value={editing.status} onChange={e=>setEd({...editing,status:e.target.value})} style={{...inp,cursor:"pointer"}}><option value="pagado">Pagado</option><option value="parcial">Parcial</option><option value="pendiente">Pendiente</option></select></div>
              <button onClick={async ()=>{await supabase.from("rebates").update({amount:editing.amount, date:editing.date, status:editing.status}).eq("id",editing.id);setEd(null);fetchRebates();}} style={{padding:13, fontSize:14, fontWeight:600, background:s.acc, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit", marginTop:4}}>Guardar cambios</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════
// MOVEMENT MODAL (redesigned)
// ════════════════════════════════════════════════════
function MovementModal({s, movement, role, onSave, onDelete, onClose}) {
  const [form, setForm] = useState(movement ? {...movement} : {date:"2026-06-24", contract:"piramides", category:"payroll_team", amount:"", desc:"", method:"wire"});
  const up = (k,v) => setForm(p=>({...p,[k]:v}));
  const isDesktop = typeof window!=="undefined" && window.innerWidth >= 640;

  const overlay = {position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:200, backdropFilter:"blur(3px)"};
  const panel = isDesktop
    ? {position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:480, maxHeight:"88vh", overflowY:"auto", background:s.card, borderRadius:14, padding:28, zIndex:201, boxShadow:"0 24px 80px rgba(0,0,0,0.2)"}
    : {position:"fixed", bottom:0, left:0, right:0, maxHeight:"88vh", overflowY:"auto", background:s.card, borderTopLeftRadius:16, borderTopRightRadius:16, padding:"24px 20px 40px", zIndex:201, boxShadow:"0 -8px 40px rgba(0,0,0,0.15)"};

  const inp = {width:"100%", padding:"10px 14px", fontSize:14, fontFamily:"inherit", background:s.inputBg, border:`1px solid ${s.div}`, borderRadius:8, color:s.text, outline:"none", boxSizing:"border-box"};
  const lbl = {display:"block", fontSize:10.5, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:6};

  return (
    <>
      <div onClick={onClose} style={overlay} />
      <div style={panel}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
          <div>
            <Eyebrow s={s} mb={4}>{movement?"Editar":"Nuevo"}</Eyebrow>
            <div style={{fontSize:20, fontWeight:600}}>Movimiento</div>
          </div>
          <button onClick={onClose} style={{background:"none", border:"none", cursor:"pointer", padding:6, fontSize:20, color:s.sub, lineHeight:1}}>✕</button>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:16}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div><label style={lbl}>Fecha</label><input type="date" value={form.date} onChange={e=>up("date",e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Contrato</label><select value={form.contract} onChange={e=>up("contract",e.target.value)} style={{...inp,cursor:"pointer"}}><option value="piramides">Pirámides</option><option value="socializadores">Socializadores</option></select></div>
          </div>
          <div><label style={lbl}>Categoría</label><select value={form.category} onChange={e=>up("category",e.target.value)} style={{...inp,cursor:"pointer"}}>{Object.entries(CAT).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div><label style={lbl}>Monto (MXN)</label><input type="number" value={form.amount} onChange={e=>up("amount",e.target.value)} placeholder="0.00" style={inp} /></div>
            <div><label style={lbl}>Método</label><select value={form.method||""} onChange={e=>up("method",e.target.value||null)} style={{...inp,cursor:"pointer"}}><option value="">N/A</option><option value="wire">Transferencia</option><option value="cash">Efectivo</option></select></div>
          </div>
          <div><label style={lbl}>Descripción</label><input type="text" value={form.desc} onChange={e=>up("desc",e.target.value)} placeholder="Descripción del movimiento" style={inp} /></div>

          {/* PHASE 2: POST to Supabase */}
          <div style={{display:"flex", alignItems:"center", gap:12, marginTop:8}}>
            {movement && (role==="owner"||movement.by==="assistant") && (
              <button onClick={()=>{onDelete(movement.id);onClose();}} style={{width:44, height:44, borderRadius:8, border:`1px solid ${s.neg}40`, background:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
                <span style={{fontSize:18, color:s.neg}}>🗑</span>
              </button>
            )}
            <button onClick={()=>{if(form.amount&&form.date)onSave({...form,amount:+form.amount});}} style={{flex:1, padding:13, fontSize:14, fontWeight:600, background:s.acc, color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit"}}>
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════
const NAV = [
  {id:"dashboard",        label:"Panel principal",     icon:"◉"},
  {id:"movements",        label:"Movimientos",         icon:"☰"},
  {id:"rebates",          label:"Retornos municipio",  icon:"↩"},
  {id:"income_statement", label:"Estado de resultados",icon:"▤"},
  {id:"settings",         label:"Configuración",       icon:"⚙"},
];

export default function Corregidora() {
  const [dark,    setDark]    = useState(typeof window!=="undefined" && window.matchMedia("(prefers-color-scheme:dark)").matches);
  const [view,    setView]    = useState("dashboard");
  const [role,    setRole]    = useState("owner");
  const [drawer,  setDrawer]  = useState(false);
  const [mvs,     setMvs]     = useState([]);
  const [adding,  setAdding]  = useState(false);
  const [editing, setEditing] = useState(null);
  const [mobile,  setMobile]  = useState(typeof window!=="undefined" && window.innerWidth < 700);
  const [loading, setLoading] = useState(true);
  const s = dark ? DARK : LIGHT;

  const fetchMovements = useCallback(async () => {
    const {data} = await supabase.from("movements").select("*").order("date", {ascending:false}).order("created_at", {ascending:false});
    if (data) setMvs(data.map(m => ({...m, desc:m.description, by:m.role, amount:+m.amount})));
    setLoading(false);
  }, []);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  useEffect(()=>{
    const l=document.createElement("link"); l.rel="stylesheet"; l.href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@280;300;400;500;600;700&display=swap"; document.head.appendChild(l);
    const st=document.createElement("style"); st.textContent=`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter Tight',-apple-system,sans-serif}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(128,128,128,.15);border-radius:2px}input,select,button,textarea{font-family:inherit}`; document.head.appendChild(st);
  },[]);

  useEffect(()=>{
    const mq=window.matchMedia("(prefers-color-scheme:dark)"); const h=e=>setDark(e.matches); mq.addEventListener("change",h); return()=>mq.removeEventListener("change",h);
  },[]);

  useEffect(()=>{
    const h=()=>setMobile(window.innerWidth<700); window.addEventListener("resize",h); return()=>window.removeEventListener("resize",h);
  },[]);

  const activeView = role==="assistant" ? "movements" : view;

  // PHASE 2: replace role toggle with real Supabase auth (JWT)
  const SidebarContent = () => (
    <div style={{display:"flex", flexDirection:"column", height:"100%", padding:"28px 0"}}>
      <div style={{padding:"0 22px 32px"}}>
        <div style={{fontSize:17, fontWeight:500, letterSpacing:"-0.01em"}}>
          <span style={{color:s.acc, marginRight:5, fontSize:24, lineHeight:1}}>·</span>Corregidora
        </div>
      </div>
      <nav style={{flex:1}}>
        {NAV.map(({id, label, icon}) => {
          const dis = role==="assistant" && id!=="movements";
          const act = activeView === id;
          return (
            <div key={id} onClick={()=>{if(dis)return; setView(id); setDrawer(false);}}
              style={{display:"flex", alignItems:"center", gap:11, padding:"11px 22px", cursor:dis?"not-allowed":"pointer", opacity:dis?0.2:1, color:act?s.acc:s.sub, borderLeft:act?`2px solid ${s.acc}`:"2px solid transparent", fontSize:14, fontWeight:act?600:400, userSelect:"none", transition:"all .12s"}}>
              <span style={{fontSize:15, width:20, textAlign:"center"}}>{icon}</span>{label}
            </div>
          );
        })}
      </nav>
      <div style={{borderTop:`1px solid ${s.div}`, padding:"18px 22px 0"}}>
        <div style={{fontSize:10, fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase", color:s.sub, marginBottom:10}}>Rol</div>
        <div style={{display:"flex", gap:0, background:s.surf, borderRadius:7, padding:3, marginBottom:14}}>
          {[["owner","Propietario"],["assistant","Asistente"]].map(([r,l])=>(
            <button key={r} onClick={()=>{setRole(r);if(r==="assistant")setView("movements");}} style={{flex:1, padding:"6px 4px", fontSize:12, fontWeight:500, border:"none", borderRadius:5, cursor:"pointer", fontFamily:"inherit", transition:"all .12s", background:role===r?s.text:"transparent", color:role===r?(s===LIGHT?"#fff":"#000"):s.sub}}>{l}</button>
          ))}
        </div>
        <button onClick={()=>setDark(!dark)} style={{background:"none", border:"none", cursor:"pointer", padding:"4px 0", display:"flex", alignItems:"center", gap:6, color:s.sub, fontSize:12}}>
          {dark?"☀ Modo claro":"☽ Modo oscuro"}
        </button>
      </div>
    </div>
  );

  const VIEWS = {
    dashboard:        <DashboardView s={s} mvs={mvs} />,
    movements:        <MovementsView s={s} mvs={mvs} role={role} onAdd={()=>setAdding(true)} onEdit={m=>setEditing(m)} onDelete={async(id)=>{await supabase.from("movements").delete().eq("id",id);fetchMovements();}} />,
    rebates:          <RebatesView s={s} />,
    income_statement: <IncomeView s={s} mvs={mvs} />,
    settings:         <SettingsView s={s} />,
  };

  return (
    <div style={{display:"flex", height:"100vh", overflow:"hidden", background:s.bg, color:s.text, fontFamily:"'Inter Tight',-apple-system,sans-serif"}}>
      {/* Desktop sidebar */}
      {!mobile && (
        <div style={{width:240, flexShrink:0, borderRight:`1px solid ${s.div}`, background:s.bg, overflowY:"auto", height:"100vh"}}>
          <SidebarContent />
        </div>
      )}
      {/* Mobile drawer */}
      {mobile && drawer && (
        <>
          <div onClick={()=>setDrawer(false)} style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100, backdropFilter:"blur(2px)"}} />
          <div style={{position:"fixed", left:0, top:0, bottom:0, width:270, background:s.bg, borderRight:`1px solid ${s.div}`, zIndex:101, overflowY:"auto"}}>
            <SidebarContent />
          </div>
        </>
      )}
      {/* Main content */}
      <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0}}>
        {mobile && (
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:`1px solid ${s.div}`, background:s.bg, flexShrink:0}}>
            <button onClick={()=>setDrawer(true)} style={{background:"none", border:"none", cursor:"pointer", padding:4, fontSize:20, color:s.text}}>☰</button>
            <div style={{fontSize:16, fontWeight:500}}><span style={{color:s.acc, marginRight:3, fontSize:20}}>·</span>Corregidora</div>
            <button onClick={()=>setDark(!dark)} style={{background:"none", border:"none", cursor:"pointer", padding:4, fontSize:16, color:s.sub}}>{dark?"☀":"☽"}</button>
          </div>
        )}
        <div style={{flex:1, overflowY:"auto"}}>{VIEWS[activeView]}</div>
      </div>
      {/* Modals */}
      {(adding||editing) && (
        <MovementModal s={s} movement={editing} role={role}
          onSave={async(m)=>{
            if(editing){
              await supabase.from("movements").update({date:m.date, contract:m.contract, category:m.category, amount:m.amount, description:m.desc, method:m.method||null}).eq("id",editing.id);
              setEditing(null);
            } else {
              await supabase.from("movements").insert({date:m.date, contract:m.contract, category:m.category, amount:m.amount, description:m.desc||'', method:m.method||null, role:role});
              setAdding(false);
            }
            fetchMovements();
          }}
          onDelete={async(id)=>{await supabase.from("movements").delete().eq("id",id);fetchMovements();}}
          onClose={()=>{setAdding(false);setEditing(null);}}
        />
      )}
    </div>
  );
}
