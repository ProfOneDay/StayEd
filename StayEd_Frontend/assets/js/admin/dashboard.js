// Must run first, before anything else on this page executes.
Guards.admin();

// DIVISION_II_MUNICIPALITIES / DIVISION_II_IDS / slugifyMunicipality come from
// division-ii-municipalities.js (loaded before this file). This dashboard is
// scoped to Division II only -- the rest of the province is shown on the map
// for geographic context but stays non-interactive (see .outside-division in
// admin-dashboard.css).
function emptyBucket(name){return {name,total:0,high:0,moderate:0,low:0,levels:{BLP:0,Elementary:0,JHS:0,SHS:0},clcs:0}}

let municipalityData={};
let clcsByMunicipality={};
let levelAverages={BLP:0,Elementary:0,JHS:0,SHS:0};
let genderRiskData=null;
let riskTrendData=[];
let currentRiskCounts={high:0,moderate:0,low:0};
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
const levelLabels={BLP:'Basic Literacy Program',Elementary:'Elementary',JHS:'Junior High School',SHS:'Senior High School'};
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
  const wrap=document.querySelector('.mapwrap');
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
      <button type="button" class="clc-pager-btn" id="clcListPrev" ${clcListPage<=1?'disabled':''} aria-label="Previous CLCs">&lt;</button>
      <span class="clc-pager-info">${start+1}–${Math.min(start+CLC_LIST_PAGE_SIZE,list.length)} of ${list.length}</span>
      <button type="button" class="clc-pager-btn" id="clcListNext" ${clcListPage>=totalPages?'disabled':''} aria-label="Next CLCs">&gt;</button>
    </div>`:'';
  container.innerHTML=rows+pager;
  document.getElementById('clcListPrev')?.addEventListener('click',()=>{clcListPage--;renderClcList(id)});
  document.getElementById('clcListNext')?.addEventListener('click',()=>{clcListPage++;renderClcList(id)});
}
function selectMunicipality(id){const d=municipalityData[id]||emptyBucket(id);map.querySelectorAll('.municipality').forEach(x=>x.classList.remove('selected'));const el=map.querySelector('#'+CSS.escape(id));if(el){el.classList.add('selected');el.parentNode.appendChild(el)}
  document.getElementById('name').innerHTML=`<span class="risk-dot" style="background:${riskColor(d)}"></span>${d.name}`;
  document.getElementById('empty').hidden=true;document.getElementById('panel').hidden=false;
  document.getElementById('clcListSection').hidden=false;
  document.getElementById('municipalitySelect').value=id;
  ['total','clcs','high','moderate'].forEach(k=>document.getElementById(k).textContent=d[k]);
  document.getElementById('lowSummary').textContent=d.low;
  document.getElementById('scopeMeta').textContent=`Municipality view · ${d.clcs} CLC${d.clcs===1?'':'s'} represented`;
  const pct=k=>d.total?Math.round(d[k]/d.total*100):0;
  [['high','highBar','highPct','highCountText'],['moderate','modBar','modPct','modCountText'],['low','lowBar','lowPct','lowCountText']].forEach(([k,b,p,c])=>{document.getElementById(b).style.width=pct(k)+'%';document.getElementById(p).textContent=pct(k)+'%';document.getElementById(c).textContent=`${d[k]} learner${d[k]===1?'':'s'}`});
  const max=Math.max(1,...Object.values(d.levels),...Object.values(levelAverages));
  document.getElementById('levels').innerHTML=levelKeys.map(label=>{const val=d.levels[label];const avgPct=Math.min(100,levelAverages[label]/max*100);return `<div class="levelbar"><span class="levelbar-label"><strong>${levelLabels[label]}</strong><small>${val} learner${val===1?'':'s'}</small></span><div class="track level-track"><div class="fill" style="width:${val/max*100}%"></div><div class="avg-mark" style="left:${avgPct}%" title="Division average: ${levelAverages[label].toFixed(1)} learners"></div></div><b>${val}</b></div>`}).join('');
  clcListPage=1;
  renderClcList(id);
  currentRiskCounts={high:d.high,moderate:d.moderate,low:d.low};
  currentLevelCounts={...d.levels};
  renderRiskChart();
  renderLevelChart();
}
function selectAllMunicipalities(){
  map.querySelectorAll('.municipality').forEach(x=>x.classList.remove('selected'));
  document.getElementById('name').innerHTML='Pangasinan II — All Municipalities';
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
  document.getElementById('total').textContent=t.total;
  document.getElementById('clcs').textContent=t.clcs;
  document.getElementById('high').textContent=t.high;
  document.getElementById('moderate').textContent=t.moderate;
  document.getElementById('lowSummary').textContent=t.low;
  document.getElementById('scopeMeta').textContent=`Division-wide snapshot · ${Object.keys(municipalityData).length} municipalities`;
  const pct=k=>t.total?Math.round(t[k]/t.total*100):0;
  [['high','highBar','highPct','highCountText'],['moderate','modBar','modPct','modCountText'],['low','lowBar','lowPct','lowCountText']].forEach(([k,b,p,c])=>{document.getElementById(b).style.width=pct(k)+'%';document.getElementById(p).textContent=pct(k)+'%';document.getElementById(c).textContent=`${t[k]} learner${t[k]===1?'':'s'}`});
  const max=Math.max(1,...Object.values(lv));
  document.getElementById('levels').innerHTML=levelKeys.map(label=>{const val=lv[label];return `<div class="levelbar"><span class="levelbar-label"><strong>${levelLabels[label]}</strong><small>${val} learner${val===1?'':'s'}</small></span><div class="track level-track"><div class="fill" style="width:${val/max*100}%"></div></div><b>${val}</b></div>`}).join('');
  currentRiskCounts={high:t.high,moderate:t.moderate,low:t.low};
  currentLevelCounts={...lv};
  renderRiskChart();
  renderLevelChart();
}

// ── Chart type toggles: Risk Distribution (Bar/Pie/Trend), Learning Level
// (Bar/Pie), Risk by Gender (Bar/Compare/Pie) -- all rendered with Chart.js,
// loaded from cdnjs in dashboard.html. ───────────────────────────────────────
function renderGenderRisk(){
  if(!genderRiskData) return;
  const {male,female,higherRiskGender}=genderRiskData;
  const pct=(bucket)=>bucket.total?Math.round(bucket.high/bucket.total*100):0;
  document.getElementById('maleBar').style.width=pct(male)+'%';
  document.getElementById('malePct').textContent=pct(male)+'%';
  document.getElementById('maleCountText').textContent=`${male.high} of ${male.total} learner${male.total===1?'':'s'}`;
  document.getElementById('femaleBar').style.width=pct(female)+'%';
  document.getElementById('femalePct').textContent=pct(female)+'%';
  document.getElementById('femaleCountText').textContent=`${female.high} of ${female.total} learner${female.total===1?'':'s'}`;
  const callout=document.getElementById('genderRiskCallout');
  if(callout){
    let text;
    if(higherRiskGender==='male') text=`Male learners currently show a higher High-Risk rate (${male.highRiskRate}% vs ${female.highRiskRate}% for female learners).`;
    else if(higherRiskGender==='female') text=`Female learners currently show a higher High-Risk rate (${female.highRiskRate}% vs ${male.highRiskRate}% for male learners).`;
    else if(higherRiskGender==='tie') text=`Male and female learners currently show the same High-Risk rate (${male.highRiskRate}%).`;
    else text='Not enough assessed learners yet to compare risk by gender.';
    callout.innerHTML=`<span class="material-symbols-outlined">insights</span>${text}`;
  }
  renderGenderChart();
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
    riskChartInstance=new Chart(canvas.getContext('2d'),{
      type:'doughnut',
      data:{
        labels:['High Risk','Moderate Risk','Low Risk'],
        datasets:[{data:[currentRiskCounts.high,currentRiskCounts.moderate,currentRiskCounts.low],backgroundColor:['#D64545','#F39422','#6BBF59'],borderColor:'#fff',borderWidth:2}],
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom'},tooltip:{enabled:true}}},
    });
    return;
  }

  if(riskChartType==='line'){
    if(!riskTrendData.length){
      note.textContent='No prediction runs recorded in the last 6 months yet.';
      return;
    }
    note.textContent='Division-wide monthly trend of assessed risk levels (last 6 months) -- not filtered by the selected area.';
    riskChartInstance=new Chart(canvas.getContext('2d'),{
      type:'line',
      data:{
        labels:riskTrendData.map(m=>m.month),
        datasets:[
          {label:'High',data:riskTrendData.map(m=>m.high),borderColor:'#D64545',backgroundColor:'#D6454522',tension:.3},
          {label:'Moderate',data:riskTrendData.map(m=>m.moderate),borderColor:'#F39422',backgroundColor:'#F3942222',tension:.3},
          {label:'Low',data:riskTrendData.map(m=>m.low),borderColor:'#6BBF59',backgroundColor:'#6BBF5922',tension:.3},
        ],
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}},
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
  levelChartInstance=new Chart(canvas.getContext('2d'),{
    type:'doughnut',
    data:{
      labels:levelKeys.map(k=>levelLabels[k]),
      datasets:[{data:levelKeys.map(k=>currentLevelCounts[k]||0),backgroundColor:['#3B7DDD','#6BBF59','#F39422','#8E5BD6'],borderColor:'#fff',borderWidth:2}],
    },
    options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom'},tooltip:{enabled:true}}},
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
          {label:'Male',data:[male.high,male.moderate,male.low],backgroundColor:'#3B7DDD'},
          {label:'Female',data:[female.high,female.moderate,female.low],backgroundColor:'#D6459A'},
        ],
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}},
    });
    return;
  }

  if(genderChartType==='pie'){
    note.textContent='Share of all currently High-Risk learners, by gender.';
    genderChartInstance=new Chart(canvas.getContext('2d'),{
      type:'doughnut',
      data:{
        labels:['Male (High Risk)','Female (High Risk)'],
        datasets:[{data:[male.high,female.high],backgroundColor:['#3B7DDD','#D6459A'],borderColor:'#fff',borderWidth:2}],
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom'},tooltip:{enabled:true}}},
    });
  }
}

function bindChartToggle(toggleId,onChange){
  document.querySelectorAll(`#${toggleId} .chart-type-btn`).forEach(btn=>{
    if(btn.dataset.chartType==='pie')btn.textContent='Donut';
    btn.addEventListener('click',()=>{
      document.querySelectorAll(`#${toggleId} .chart-type-btn`).forEach(b=>b.classList.toggle('is-active',b===btn));
      onChange(btn.dataset.chartType);
    });
  });
}

bindChartToggle('riskChartToggle',(type)=>{riskChartType=type;renderRiskChart();});
bindChartToggle('levelChartToggle',(type)=>{levelChartType=type;renderLevelChart();});
bindChartToggle('genderChartToggle',(type)=>{genderChartType=type;renderGenderChart();});
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
    genderRiskData=dashboardData?.genderRisk||null;
    riskTrendData=dashboardData?.riskTrend||[];
    clcsByMunicipality={};
    (clcResponse?.data||[]).forEach(clc=>{
      const slug=slugifyMunicipality(clc.municipality);
      if(!DIVISION_II_IDS.has(slug)) return;
      (clcsByMunicipality[slug]=clcsByMunicipality[slug]||[]).push(clc);
    });
  }catch(error){
    console.error('[AdminDashboard] Unable to load dashboard data',error);
    showToast('Unable to load division risk data.');
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

function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('show')}));
function showToast(msg){
  const t=document.getElementById('toast');
  t.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>${msg}`;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}

document.querySelectorAll('.search-box select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.search-box').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.search-box').classList.remove('open'));});
