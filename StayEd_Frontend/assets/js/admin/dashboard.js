// Must run first, before anything else on this page executes.
Guards.admin();

// DIVISION_II_MUNICIPALITIES / DIVISION_II_IDS / slugifyMunicipality come from
// division-ii-municipalities.js (loaded before this file). This dashboard is
// scoped to Division II only -- the rest of the province is shown on the map
// for geographic context but stays non-interactive (see .outside-division in
// admin-dashboard.css).
function emptyGenderBucket(){return {total:0,high:0,moderate:0,low:0,highRiskRate:0}}
function emptyBucket(name){return {name,total:0,high:0,moderate:0,low:0,levels:{BLP:0,Elementary:0,JHS:0,SHS:0},clcs:0,genderRisk:{male:emptyGenderBucket(),female:emptyGenderBucket(),higherRiskGender:null}}}

let municipalityData={};
let clcsByMunicipality={};
let divisionGenderRiskData=null;
let levelAverages={BLP:0,Elementary:0,JHS:0,SHS:0};
let genderRiskData=null;
let riskTrendData=[];
let currentRiskCounts={high:0,moderate:0,low:0,unassessed:0,total:0};
let currentLevelCounts={BLP:0,Elementary:0,JHS:0,SHS:0};
let riskChartType='bar';
let levelChartType='bar';
let genderChartType='bar';
let riskChartInstance=null;
let levelChartInstance=null;
let genderChartInstance=null;
const map=document.querySelector('.mapwrap svg');
const zoomGroup=document.getElementById('zoomGroup');
const wrap=document.querySelector('.mapwrap');
const VB_CENTER={x:400,y:266.5};
const MIN_SCALE=0.8,MAX_SCALE=5,DEFAULT_SCALE=1.2;
let mapScaleState=DEFAULT_SCALE;
let mapTx=VB_CENTER.x*(1-DEFAULT_SCALE), mapTy=VB_CENTER.y*(1-DEFAULT_SCALE);
function applyMapTransform(){
  zoomGroup.setAttribute('transform',`translate(${mapTx} ${mapTy}) scale(${mapScaleState})`);
}
function clientToViewBox(clientX,clientY){
  const pt=map.createSVGPoint(); pt.x=clientX; pt.y=clientY;
  const ctm=map.getScreenCTM();
  if(!ctm) return {x:VB_CENTER.x,y:VB_CENTER.y};
  const p=pt.matrixTransform(ctm.inverse());
  return {x:p.x,y:p.y};
}
function zoomAtViewBoxPoint(Rx,Ry,factor){
  const newScale=Math.min(MAX_SCALE,Math.max(MIN_SCALE,mapScaleState*factor));
  if(newScale===mapScaleState) return;
  const Cx=(Rx-mapTx)/mapScaleState, Cy=(Ry-mapTy)/mapScaleState;
  mapTx=Rx-newScale*Cx; mapTy=Ry-newScale*Cy; mapScaleState=newScale;
  applyMapTransform();
}
document.getElementById('zoomInBtn').addEventListener('click',()=>zoomAtViewBoxPoint(VB_CENTER.x,VB_CENTER.y,1.25));
document.getElementById('zoomOutBtn').addEventListener('click',()=>zoomAtViewBoxPoint(VB_CENTER.x,VB_CENTER.y,0.8));
document.getElementById('zoomResetBtn').addEventListener('click',()=>{mapScaleState=DEFAULT_SCALE;mapTx=VB_CENTER.x*(1-DEFAULT_SCALE);mapTy=VB_CENTER.y*(1-DEFAULT_SCALE);applyMapTransform()});
applyMapTransform();

// Mouse-wheel zoom, centered on the cursor position
wrap.addEventListener('wheel',e=>{
  e.preventDefault();
  const factor=Math.exp(-e.deltaY*0.0016);
  const R=clientToViewBox(e.clientX,e.clientY);
  zoomAtViewBoxPoint(R.x,R.y,factor);
},{passive:false});

// Click-and-drag panning (mouse + touch)
let isPanning=false,panLast=null,panMoved=false,justPanned=false;
function panStart(clientX,clientY){isPanning=true;panMoved=false;panLast=clientToViewBox(clientX,clientY);wrap.classList.add('dragging');hideTooltip()}
function panMove(clientX,clientY){
  if(!isPanning)return;
  const R=clientToViewBox(clientX,clientY);
  const dx=R.x-panLast.x, dy=R.y-panLast.y;
  if(Math.abs(dx)>0.6||Math.abs(dy)>0.6)panMoved=true;
  mapTx+=dx; mapTy+=dy; panLast=R;
  applyMapTransform();
}
function panEnd(){
  if(isPanning&&panMoved){justPanned=true;setTimeout(()=>{justPanned=false},50)}
  isPanning=false; wrap.classList.remove('dragging');
}
wrap.addEventListener('mousedown',e=>{if(e.button!==0)return;panStart(e.clientX,e.clientY)});
window.addEventListener('mousemove',e=>panMove(e.clientX,e.clientY));
window.addEventListener('mouseup',panEnd);
wrap.addEventListener('touchstart',e=>{const t=e.touches[0];panStart(t.clientX,t.clientY)},{passive:true});
wrap.addEventListener('touchmove',e=>{if(!isPanning)return;e.preventDefault();const t=e.touches[0];panMove(t.clientX,t.clientY)},{passive:false});
wrap.addEventListener('touchend',panEnd);
// Swallow the click-to-select that would otherwise fire right after a drag
map.addEventListener('click',e=>{if(justPanned){e.stopPropagation();justPanned=false}},true);

function riskLevel(d){if(!d.total)return 'low';const rate=d.high/d.total; return rate>=.20?'high':rate>=.10?'moderate':'low'}
function riskColor(d){return {high:'#D64545',moderate:'#F39422',low:'#6BBF59'}[riskLevel(d)]}
const levelKeys=['BLP','Elementary','JHS','SHS'];
const levelLabels={BLP:'Basic Literacy',Elementary:'Elementary',JHS:'Junior High',SHS:'Senior High'};
function recolorMap(){
  // Every Division II municipality gets a risk color, whether or not it has
  // a CLC registered yet -- riskLevel() defaults an empty bucket to "low"
  // (green), so an as-yet-unregistered Division II municipality still reads
  // as in-scope rather than "no data" gray. Only municipalities outside the
  // division (forced gray via .outside-division in CSS) stay ungraded.
  Object.entries(municipalityData).forEach(([id,d])=>{
    const el=map.querySelector('#'+CSS.escape(id));
    if(!el)return;
    el.style.fill=riskColor(d);
  });
  const riskCounts={low:0,moderate:0,high:0};
  Object.values(municipalityData).forEach(d=>{riskCounts[riskLevel(d)]++});
  document.getElementById('countLow').textContent=riskCounts.low;
  document.getElementById('countModerate').textContent=riskCounts.moderate;
  document.getElementById('countHigh').textContent=riskCounts.high;
  levelAverages=Object.fromEntries(levelKeys.map(k=>{
    const municipalities=Object.values(municipalityData);
    return [k,municipalities.length?municipalities.reduce((s,d)=>s+d.levels[k],0)/municipalities.length:0];
  }));
}
const tooltip=document.getElementById('mapTooltip');
function positionTooltip(event){
  const rect=wrap.getBoundingClientRect();
  tooltip.style.left=(event.clientX-rect.left)+'px';
  tooltip.style.top=(event.clientY-rect.top)+'px';
}
function showTooltip(el,event){
  const d=municipalityData[el.id];
  if(!d)return;
  tooltip.textContent=d.name;
  positionTooltip(event);
  tooltip.classList.add('show');
}
function hideTooltip(){tooltip.classList.remove('show')}
const CLC_LIST_PAGE_SIZE=3;
let clcListPage=1;
function renderClcList(id){
  const container=document.getElementById('clcList');
  if(!container)return;
  const list=clcsByMunicipality[id]||[];
  if(!list.length){
    container.innerHTML='<div class="clc-list-empty">No CLCs registered in this municipality yet.</div>';
    return;
  }
  const totalPages=Math.max(1,Math.ceil(list.length/CLC_LIST_PAGE_SIZE));
  if(clcListPage>totalPages) clcListPage=totalPages;
  if(clcListPage<1) clcListPage=1;
  const start=(clcListPage-1)*CLC_LIST_PAGE_SIZE;
  const pageItems=list.slice(start,start+CLC_LIST_PAGE_SIZE);
  const rows=pageItems.map(c=>{
    const teacherCount=(c.teachers||[]).length;
    const meta=[
      c.barangay||null,
      `${c.learners} learner${c.learners===1?'':'s'}`,
      teacherCount?`${teacherCount} teacher${teacherCount===1?'':'s'}`:'No teacher assigned',
    ].filter(Boolean).join(' · ');
    return `<div class="clc-row">
      <div class="clc-row-main">
        <span class="clc-row-name">${c.name}</span>
        <span class="clc-row-meta">${meta}</span>
      </div>
      <span class="clc-row-status ${c.status==='active'?'':'archived'}">${c.status==='active'?'Active':'Archived'}</span>
    </div>`;
  }).join('');
  const pager=list.length>CLC_LIST_PAGE_SIZE?`
    <div class="clc-list-pager">
      <button type="button" class="clc-pager-btn" id="clcListPrev" ${clcListPage<=1?'disabled':''} aria-label="Previous CLCs"><span class="material-symbols-outlined">chevron_left</span></button>
      <span class="clc-pager-info">${start+1}–${Math.min(start+CLC_LIST_PAGE_SIZE,list.length)} of ${list.length}</span>
      <button type="button" class="clc-pager-btn" id="clcListNext" ${clcListPage>=totalPages?'disabled':''} aria-label="Next CLCs"><span class="material-symbols-outlined">chevron_right</span></button>
    </div>`:'';
  container.innerHTML=rows+pager;
  document.getElementById('clcListPrev')?.addEventListener('click',()=>{clcListPage--;renderClcList(id)});
  document.getElementById('clcListNext')?.addEventListener('click',()=>{clcListPage++;renderClcList(id)});
}

// ── Shared chart helpers (mirrors assets/js/teacher/dashboard.js's ST_*
// constants/motion so Chart.js views and [data-animate] panels behave the
// same on both dashboards -- kept local here rather than imported, since the
// teacher file doesn't expose these on window). ───────────────────────────
const ST_REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.color = '#5a6275';
const ST_LEGEND_BOTTOM = { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, color: '#5a6275' } };
const ST_TOOLTIP = { backgroundColor: '#111a36', padding: 10, cornerRadius: 8, displayColors: true, boxPadding: 4 };
const ST_TOOLTIP_SHARE = { ...ST_TOOLTIP, callbacks: { label(ctx){ const total=ctx.dataset.data.reduce((a,b)=>a+b,0); const pct=total?Math.round(ctx.parsed/total*100):0; return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`; } } };
const ST_CHART_STAGGER = (step) => ({ delay: (ctx) => ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * step : 0 });
const ST_CENTER_TOTAL = {
  id: 'stCenterTotal',
  afterDraw(chart){
    if(chart.config.type!=='doughnut')return;
    const {ctx,chartArea:a}=chart;
    const sum=chart.data.datasets[0].data.reduce((x,y)=>x+y,0);
    const cx=(a.left+a.right)/2, cy=(a.top+a.bottom)/2;
    ctx.save();
    ctx.textAlign='center';
    ctx.fillStyle='#111a36';
    ctx.font="800 24px 'Libre Franklin', sans-serif";
    ctx.fillText(sum,cx,cy+4);
    ctx.font='500 11px Inter';
    ctx.fillStyle='#8a91a0';
    ctx.fillText(chart.canvas.dataset.unit||'learners',cx,cy+21);
    ctx.restore();
  },
};
function countTo(el,to){
  const from=Number(el.dataset.cur??0);
  el.dataset.cur=to;
  if(ST_REDUCE_MOTION){el.textContent=to;return;}
  const t0=performance.now(),dur=700;
  const tick=(t)=>{
    const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,3);
    el.textContent=Math.round(from+(to-from)*e);
    if(k<1)requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function selectMunicipality(id){const d=municipalityData[id]||emptyBucket(id);map.querySelectorAll('.municipality').forEach(x=>x.classList.remove('selected'));const el=map.querySelector('#'+CSS.escape(id));if(el){el.classList.add('selected');el.parentNode.appendChild(el)}
  const dotClass={high:'is-high',moderate:'is-moderate',low:'is-low'}[riskLevel(d)]||'';
  document.getElementById('name').innerHTML=`<span class="risk-dot ${dotClass}"></span>${d.name}`;
  document.getElementById('empty').hidden=true;document.getElementById('panel').hidden=false;
  document.getElementById('clcListSection').hidden=false;
  document.getElementById('municipalitySelect').value=id;
  document.getElementById('scopeMeta').textContent=`Municipality view · ${(clcsByMunicipality[id]||[]).length} CLC${(clcsByMunicipality[id]||[]).length===1?'':'s'} registered`;
  const unassessed=Math.max(0,d.total-d.high-d.moderate-d.low);
  applyOverview({total:d.total,clcs:d.clcs,high:d.high,moderate:d.moderate,low:d.low,unassessed});
  applyRiskBars({high:d.high,moderate:d.moderate,low:d.low},d.total);
  const max=Math.max(1,...Object.values(d.levels),...Object.values(levelAverages));
  document.getElementById('levels').innerHTML=levelKeys.map(k=>{
    const val=d.levels[k];const avg=levelAverages[k];const avgPct=Math.min(100,avg/max*100);
    return `<div class="st-hbar-row"><span class="st-hbar-label">${levelLabels[k]}<small>${val} learner${val===1?'':'s'}</small></span><div class="st-hbar-track" data-tooltip="${levelLabels[k]}: ${val} learner${val===1?'':'s'} · division average ${avg.toFixed(1)}"><div class="st-hbar st-hbar--level" style="--w:${val/max*100}%"></div><div class="avg-mark" style="left:${avgPct}%" title="Division average: ${avg.toFixed(1)} learners"></div></div><span class="st-hbar-value num">${val}</span></div>`;
  }).join('');
  clcListPage=1;
  renderClcList(id);
  currentRiskCounts={high:d.high,moderate:d.moderate,low:d.low,unassessed,total:d.total};
  currentLevelCounts={...d.levels};
  genderRiskData=d.genderRisk||null;
  renderGenderRisk();
  renderRiskChart();
  renderLevelChart();
}
function selectAllMunicipalities(){
  map.querySelectorAll('.municipality').forEach(x=>x.classList.remove('selected'));
  document.getElementById('name').innerHTML='<span class="risk-dot"></span>Pangasinan II — All Municipalities';
  document.getElementById('empty').hidden=true;document.getElementById('panel').hidden=false;
  // Listing every CLC across the whole province here would swamp the panel --
  // that view is per-municipality only.
  document.getElementById('clcListSection').hidden=true;
  document.getElementById('municipalitySelect').value='all';
  const t={total:0,clcs:0,high:0,moderate:0,low:0};
  const lv={BLP:0,Elementary:0,JHS:0,SHS:0};
  Object.values(municipalityData).forEach(d=>{
    t.total+=d.total; t.clcs+=d.clcs; t.high+=d.high; t.moderate+=d.moderate; t.low+=d.low;
    Object.keys(lv).forEach(k=>lv[k]+=d.levels[k]);
  });
  document.getElementById('scopeMeta').textContent=`Division-wide snapshot · ${Object.keys(municipalityData).length} municipalities`;
  const unassessed=Math.max(0,t.total-t.high-t.moderate-t.low);
  applyOverview({total:t.total,clcs:t.clcs,high:t.high,moderate:t.moderate,low:t.low,unassessed});
  applyRiskBars({high:t.high,moderate:t.moderate,low:t.low},t.total);
  const max=Math.max(1,...Object.values(lv));
  document.getElementById('levels').innerHTML=levelKeys.map(k=>{
    const val=lv[k];
    return `<div class="st-hbar-row"><span class="st-hbar-label">${levelLabels[k]}<small>${val} learner${val===1?'':'s'}</small></span><div class="st-hbar-track" data-tooltip="${levelLabels[k]}: ${val} learner${val===1?'':'s'}"><div class="st-hbar st-hbar--level" style="--w:${val/max*100}%"></div></div><span class="st-hbar-value num">${val}</span></div>`;
  }).join('');
  currentRiskCounts={high:t.high,moderate:t.moderate,low:t.low,unassessed,total:t.total};
  currentLevelCounts={...lv};
  genderRiskData=divisionGenderRiskData;
  renderGenderRisk();
  renderRiskChart();
  renderLevelChart();
}

// Overview card: total + 4-segment risk strip + 4-item legend (High /
// Moderate / Low / Not yet assessed). The strip's segments and the legend's
// percentages always sum to 100%, which is what explains the "not yet
// assessed" bucket -- riskLevel() alone only ever covers assessed learners.
const HELP_TEXT={high:'Needs closer follow-up',moderate:'Needs monitoring',low:'Currently lower concern',unassessed:'No prediction yet'};
function applyOverview({total,clcs,high,moderate,low,unassessed}){
  countTo(document.getElementById('total'),total);
  countTo(document.getElementById('clcs'),clcs);
  countTo(document.getElementById('high'),high);
  countTo(document.getElementById('moderate'),moderate);
  countTo(document.getElementById('lowSummary'),low);
  countTo(document.getElementById('unassessed'),unassessed);
  const vals={high,moderate,low,unassessed};
  const stripSpans=document.querySelectorAll('.st-risk-strip > span');
  const order=['high','moderate','low','unassessed'];
  stripSpans.forEach((span,i)=>{ span.style.flexGrow=vals[order[i]]||0; });
  const pct=(k)=>total?Math.round(vals[k]/total*100):0;
  document.querySelectorAll('.st-risk-legend--4 .pct').forEach((el,i)=>{
    const key=order[i];
    el.innerHTML=`${pct(key)}%<span class="pct-suffix"> · ${HELP_TEXT[key]}</span>`;
  });
}

function applyRiskBars(counts,total){
  const pct=(k)=>total?Math.round(counts[k]/total*100):0;
  const names={high:'High risk',moderate:'Moderate risk',low:'Low risk'};
  [['high','highBar','highPct','highCountText'],['moderate','modBar','modPct','modCountText'],['low','lowBar','lowPct','lowCountText']].forEach(([k,b,p,c])=>{
    const bar=document.getElementById(b);
    const pctVal=pct(k);
    bar.style.setProperty('--w',pctVal+'%');
    document.getElementById(p).textContent=pctVal+'%';
    document.getElementById(c).textContent=`${counts[k]} learner${counts[k]===1?'':'s'}`;
    bar.closest('.st-hbar-track').dataset.tooltip=`${names[k]}: ${counts[k]} learner${counts[k]===1?'':'s'} (${pctVal}%)`;
  });
}

// ── Chart type toggles: Risk Distribution (Bar/Donut/Trend), Learning Level
// (Bar/Donut), Risk by Gender (Bar/Compare/Donut) -- all rendered with
// Chart.js, loaded from cdnjs in dashboard.html. ───────────────────────────
function renderGenderRisk(){
  if(!genderRiskData) return;
  const {male,female,higherRiskGender}=genderRiskData;
  applyGenderBars(male,female);
  const callout=document.getElementById('genderRiskCallout');
  if(callout){
    let text;
    if(higherRiskGender==='male') text=`Male learners currently show a higher High-Risk rate (${male.highRiskRate}% vs ${female.highRiskRate}% for female learners).`;
    else if(higherRiskGender==='female') text=`Female learners currently show a higher High-Risk rate (${female.highRiskRate}% vs ${male.highRiskRate}% for male learners).`;
    else if(higherRiskGender==='tie') text=`Male and female learners currently show the same High-Risk rate (${male.highRiskRate}%).`;
    else text='Not enough assessed learners yet to compare risk by gender.';
    callout.innerHTML=`<span class="material-symbols-outlined">insights</span><span>${text}</span>`;
  }
  renderGenderChart();
}
function applyGenderBars(male,female){
  const pct=(bucket)=>bucket.total?Math.round(bucket.high/bucket.total*100):0;
  const malePct=pct(male), femalePct=pct(female);
  const maleBar=document.getElementById('maleBar'), femaleBar=document.getElementById('femaleBar');
  maleBar.style.setProperty('--w',malePct+'%');
  document.getElementById('malePct').textContent=malePct+'%';
  document.getElementById('maleCountText').textContent=`${male.high} of ${male.total} learner${male.total===1?'':'s'}`;
  maleBar.closest('.st-hbar-track').dataset.tooltip=`Male: ${male.high} of ${male.total} learner${male.total===1?'':'s'} are High risk (${malePct}%)`;
  femaleBar.style.setProperty('--w',femalePct+'%');
  document.getElementById('femalePct').textContent=femalePct+'%';
  document.getElementById('femaleCountText').textContent=`${female.high} of ${female.total} learner${female.total===1?'':'s'}`;
  femaleBar.closest('.st-hbar-track').dataset.tooltip=`Female: ${female.high} of ${female.total} learner${female.total===1?'':'s'} are High risk (${femalePct}%)`;
}

// Chart.js is loaded from a CDN script tag -- if that request ever fails
// (offline, blocked CDN), every chart-type view should say so plainly
// instead of silently rendering an empty canvas.
function chartJsReady(canvas,note){
  if(typeof Chart!=='undefined') return true;
  if(note) note.textContent='Chart library failed to load -- check your connection and reload the page.';
  return false;
}

function renderRiskChart(){
  const barView=document.getElementById('riskBarView');
  const chartView=document.getElementById('riskChartView');
  if(!barView||!chartView) return;

  if(riskChartType==='bar'){
    barView.hidden=false; chartView.hidden=true;
    if(riskChartInstance){riskChartInstance.destroy();riskChartInstance=null;}
    return;
  }
  barView.hidden=true; chartView.hidden=false;
  const note=document.getElementById('riskChartNote');
  const canvas=document.getElementById('riskChartCanvas');
  if(riskChartInstance){riskChartInstance.destroy();riskChartInstance=null;}
  if(!canvas||!chartJsReady(canvas,note)) return;

  if(riskChartType==='pie'){
    note.textContent='Current risk distribution for the selected area.';
    canvas.dataset.unit='assessed';
    riskChartInstance=new Chart(canvas.getContext('2d'),{
      type:'doughnut',
      plugins:[ST_CENTER_TOTAL],
      data:{
        labels:['High Risk','Moderate Risk','Low Risk'],
        datasets:[{data:[currentRiskCounts.high,currentRiskCounts.moderate,currentRiskCounts.low],backgroundColor:['#D64545','#F39422','#6BBF59'],borderColor:'#fff',borderWidth:3,hoverOffset:6}],
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',animation:ST_REDUCE_MOTION?false:{animateRotate:true,animateScale:false,duration:1000},plugins:{legend:ST_LEGEND_BOTTOM,tooltip:ST_TOOLTIP_SHARE}},
    });
    return;
  }

  if(riskChartType==='line'){
    if(!riskTrendData.length){
      note.textContent='No prediction runs recorded in the last 6 months yet.';
      return;
    }
    note.textContent='Division-wide monthly trend of assessed risk levels (last 6 months) -- not filtered by the selected area.';
    const ds=(label,color,key)=>({label,data:riskTrendData.map(m=>m[key]),borderColor:color,backgroundColor:color+'22',fill:false,tension:.35,pointRadius:3,pointHoverRadius:6,borderWidth:2.5});
    riskChartInstance=new Chart(canvas.getContext('2d'),{
      type:'line',
      data:{
        labels:riskTrendData.map(m=>m.month),
        datasets:[ds('High','#D64545','high'),ds('Moderate','#F39422','moderate'),ds('Low','#6BBF59','low')],
      },
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
        animation:ST_REDUCE_MOTION?false:{duration:700,delay:(ctx)=>ctx.type==='data'&&ctx.mode==='default'?ctx.dataIndex*110:0},
        plugins:{legend:ST_LEGEND_BOTTOM,tooltip:{...ST_TOOLTIP,callbacks:{footer:(items)=>`Total assessed: ${items.reduce((a,i)=>a+i.parsed.y,0)}`}}},
        scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:'#eef1f5'},border:{display:false}},x:{grid:{display:false},border:{display:false}}}},
    });
  }
}

function renderLevelChart(){
  const barView=document.getElementById('levelBarView');
  const chartView=document.getElementById('levelChartView');
  if(!barView||!chartView) return;

  if(levelChartType==='bar'){
    barView.hidden=false; chartView.hidden=true;
    if(levelChartInstance){levelChartInstance.destroy();levelChartInstance=null;}
    return;
  }
  barView.hidden=true; chartView.hidden=false;
  const note=document.getElementById('levelChartNote');
  const canvas=document.getElementById('levelChartCanvas');
  if(levelChartInstance){levelChartInstance.destroy();levelChartInstance=null;}
  if(!canvas||!chartJsReady(canvas,note)) return;

  note.textContent='Learner count per ALS learning level for the selected area.';
  canvas.dataset.unit='learners';
  levelChartInstance=new Chart(canvas.getContext('2d'),{
    type:'doughnut',
    plugins:[ST_CENTER_TOTAL],
    data:{
      labels:levelKeys.map(k=>levelLabels[k]),
      datasets:[{data:levelKeys.map(k=>currentLevelCounts[k]||0),backgroundColor:['#12355b','#4c6f95','#006a68','#9db5d3'],borderColor:'#fff',borderWidth:3,hoverOffset:6}],
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',animation:ST_REDUCE_MOTION?false:{animateRotate:true,animateScale:false,duration:1000},plugins:{legend:ST_LEGEND_BOTTOM,tooltip:ST_TOOLTIP_SHARE}},
  });
}

function renderGenderChart(){
  const barView=document.getElementById('genderBarView');
  const chartView=document.getElementById('genderChartView');
  if(!barView||!chartView) return;

  if(genderChartType==='bar'){
    barView.hidden=false; chartView.hidden=true;
    if(genderChartInstance){genderChartInstance.destroy();genderChartInstance=null;}
    return;
  }
  barView.hidden=true; chartView.hidden=false;
  const note=document.getElementById('genderChartNote');
  const canvas=document.getElementById('genderChartCanvas');
  if(genderChartInstance){genderChartInstance.destroy();genderChartInstance=null;}
  if(!canvas||!chartJsReady(canvas,note)) return;
  if(!genderRiskData){
    note.textContent='Not enough assessed learners yet to compare risk by gender.';
    return;
  }
  const {male,female}=genderRiskData;

  if(genderChartType==='grouped'){
    note.textContent='Risk-level counts compared side by side, male vs female.';
    genderChartInstance=new Chart(canvas.getContext('2d'),{
      type:'bar',
      data:{
        labels:['High Risk','Moderate Risk','Low Risk'],
        datasets:[
          {label:'Male',data:[male.high,male.moderate,male.low],backgroundColor:'#12355b',borderRadius:6,barThickness:26},
          {label:'Female',data:[female.high,female.moderate,female.low],backgroundColor:'#4c6f95',borderRadius:6,barThickness:26},
        ],
      },
      options:{responsive:true,maintainAspectRatio:false,animation:ST_REDUCE_MOTION?false:{duration:900,...ST_CHART_STAGGER(100)},plugins:{legend:ST_LEGEND_BOTTOM,tooltip:ST_TOOLTIP},scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:'#eef1f5'},border:{display:false}},x:{grid:{display:false},border:{display:false}}}},
    });
    return;
  }

  if(genderChartType==='pie'){
    note.textContent='Share of all currently High-Risk learners, by gender.';
    canvas.dataset.unit='high risk';
    genderChartInstance=new Chart(canvas.getContext('2d'),{
      type:'doughnut',
      plugins:[ST_CENTER_TOTAL],
      data:{
        labels:['Male (High Risk)','Female (High Risk)'],
        datasets:[{data:[male.high,female.high],backgroundColor:['#12355b','#4c6f95'],borderColor:'#fff',borderWidth:3,hoverOffset:6}],
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',animation:ST_REDUCE_MOTION?false:{animateRotate:true,animateScale:false,duration:1000},plugins:{legend:ST_LEGEND_BOTTOM,tooltip:ST_TOOLTIP_SHARE}},
    });
  }
}

function bindChartToggle(toggleId,onChange){
  document.querySelectorAll(`#${toggleId} .chart-type-btn`).forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll(`#${toggleId} .chart-type-btn`).forEach(b=>b.classList.toggle('is-active',b===btn));
      onChange(btn.dataset.chartType);
    });
  });
}

bindChartToggle('riskChartToggle',(type)=>{riskChartType=type;renderRiskChart();});
bindChartToggle('levelChartToggle',(type)=>{levelChartType=type;renderLevelChart();});
bindChartToggle('genderChartToggle',(type)=>{genderChartType=type;renderGenderChart();});

// ── Motion: [data-animate] panels fill in once they scroll into view (same
// pattern as the teacher dashboard's own IntersectionObserver). Once a panel
// is in view, its bars/strip already transition smoothly on their own --
// --w, flex-grow and the count-up numbers above are updated unconditionally
// on every selection change, and the CSS transitions already declared on
// .st-hbar/.st-risk-strip animate old value -> new value directly. Toggling
// .is-inview off and back on here would instead force every bar through a
// visible "collapse to 0% then regrow" each time, which is wrong for a
// value change -- scrolling back into view (the actual "replay" case) is
// already handled by this same observer re-firing on intersection change. */
const motionObserver=new IntersectionObserver((entries)=>{
  entries.forEach(({target,isIntersecting})=>{
    target.classList.toggle('is-inview',isIntersecting);
  });
},{threshold:.2});
document.querySelectorAll('[data-animate]').forEach(el=>motionObserver.observe(el));

// Normalize the SVG asset against the canonical list. The map contains other
// province areas for context, but only the requested municipalities are
// selectable and included in the dashboard scope.
map.querySelectorAll('.division-ii').forEach(el=>{
  if(DIVISION_II_IDS.has(el.id))return;
  el.classList.remove('division-ii');
  el.classList.add('outside-division');
  el.dataset.divisionIi='false';
  el.tabIndex=-1;
});

// Only canonical Division II municipalities are interactive -- the rest of the
// province renders for geographic context but is not part of this scope.
map.querySelectorAll('.division-ii').forEach(el=>{
  el.addEventListener('mouseenter',e=>showTooltip(el,e));
  el.addEventListener('mousemove',positionTooltip);
  el.addEventListener('mouseleave',hideTooltip);
  el.addEventListener('click',()=>{hideTooltip();selectMunicipality(el.id)});
  el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hideTooltip();selectMunicipality(el.id)}})
});

// Search / jump-to-municipality dropdown
const select=document.getElementById('municipalitySelect');
function populateMunicipalitySelect(){
  select.querySelectorAll('option:not([value="all"])').forEach(opt=>opt.remove());
  Object.entries(municipalityData).sort((a,b)=>a[1].name.localeCompare(b[1].name)).forEach(([id,d])=>{
    const opt=document.createElement('option');opt.value=id;opt.textContent=d.name;select.appendChild(opt);
  });
}
select.addEventListener('change',()=>{if(select.value==='all')selectAllMunicipalities();else if(select.value)selectMunicipality(select.value)});

async function loadDashboard(){
  document.getElementById('muniCount').textContent=DIVISION_II_MUNICIPALITIES.length;
  try{
    const [dashboardData,clcResponse]=await Promise.all([
      API.getAdminDashboard(),
      API.getAdminClcs(),
    ]);
    // The API aggregates by whatever municipality string is on each CLC,
    // with no division filter -- restrict to Division II here so a CLC
    // mistakenly registered outside the division can't leak onto this map.
    municipalityData={};
    Object.entries(dashboardData?.municipalities||{}).forEach(([id,d])=>{
      if(DIVISION_II_IDS.has(id)) municipalityData[id]=d;
    });
    divisionGenderRiskData=dashboardData?.genderRisk||null;
    genderRiskData=divisionGenderRiskData;
    riskTrendData=dashboardData?.riskTrend||[];
    clcsByMunicipality={};
    (clcResponse?.data||[]).forEach(clc=>{
      const slug=slugifyMunicipality(clc.municipality);
      if(!DIVISION_II_IDS.has(slug)) return;
      (clcsByMunicipality[slug]=clcsByMunicipality[slug]||[]).push(clc);
    });
  }catch(error){
    console.error('[AdminDashboard] Unable to load dashboard data',error);
    Utils.toast('Unable to load division risk data.','error');
    municipalityData={};
    clcsByMunicipality={};
    genderRiskData=null;
    riskTrendData=[];
  }
  // Guarantee every Division II municipality has a bucket -- the API only
  // returns entries for municipalities that already have CLCs/learners, but
  // the whole division should still be clickable on the map.
  DIVISION_II_MUNICIPALITIES.forEach(({id,name})=>{
    if(!municipalityData[id]) municipalityData[id]=emptyBucket(name);
  });
  recolorMap();
  renderGenderRisk();
  populateMunicipalitySelect();
  const requestedMunicipality = new URLSearchParams(window.location.search).get('municipality');
  if (requestedMunicipality && municipalityData[requestedMunicipality]) {
    selectMunicipality(requestedMunicipality);
  } else {
    selectAllMunicipalities();
  }
}
loadDashboard();

// Legend click-to-filter
let activeFilter=null;
document.querySelectorAll('.legend-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const level=btn.dataset.level;
    activeFilter=(activeFilter===level)?null:level;
    document.querySelectorAll('.legend-item').forEach(b=>b.classList.toggle('active',b.dataset.level===activeFilter));
    map.querySelectorAll('.municipality').forEach(el=>{
      if(!activeFilter){el.classList.remove('dim');return}
      const isOutside=el.classList.contains('outside-division');
      const d=municipalityData[el.id];
      const matches=activeFilter==='outside'?isOutside:(d&&riskLevel(d)===activeFilter);
      el.classList.toggle('dim',!matches);
    });
  });
});
