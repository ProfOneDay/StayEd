// Must run first, before anything else on this page executes.
Guards.admin();
let municipalityData={};
let levelAverages={BLP:0,Elementary:0,JHS:0,SHS:0};
const map=document.querySelector('.mapwrap svg');
const zoomGroup=document.getElementById('zoomGroup');
const wrap=document.querySelector('.mapwrap');
const VB_CENTER={x:400,y:266.5};
const MIN_SCALE=1,MAX_SCALE=5,DEFAULT_SCALE=1;
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
function recolorMap(){
  Object.entries(municipalityData).forEach(([id,d])=>{const el=map.querySelector('#'+CSS.escape(id));if(el)el.style.fill=riskColor(d)});
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
function selectMunicipality(id){const d=municipalityData[id];if(!d)return;map.querySelectorAll('.municipality').forEach(x=>x.classList.remove('selected'));const el=map.querySelector('#'+CSS.escape(id));el.classList.add('selected');el.parentNode.appendChild(el);
  document.getElementById('name').innerHTML=`<span class="risk-dot" style="background:${riskColor(d)}"></span>${d.name}`;
  document.getElementById('empty').hidden=true;document.getElementById('panel').hidden=false;
  document.getElementById('municipalitySelect').value=id;
  ['total','clcs','high','moderate'].forEach(k=>document.getElementById(k).textContent=d[k]);
  const pct=k=>Math.round(d[k]/d.total*100);
  [['high','highBar','highPct'],['moderate','modBar','modPct'],['low','lowBar','lowPct']].forEach(([k,b,p])=>{document.getElementById(b).style.width=pct(k)+'%';document.getElementById(p).textContent=pct(k)+'%'});
  const max=Math.max(...Object.values(d.levels),...Object.values(levelAverages));
  document.getElementById('levels').innerHTML=levelKeys.map(label=>{const val=d.levels[label];const avgPct=Math.min(100,levelAverages[label]/max*100);return `<div class="levelbar"><span>${label}</span><div class="track level-track"><div class="fill" style="width:${val/max*100}%"></div><div class="avg-mark" style="left:${avgPct}%" title="Division average: ${levelAverages[label].toFixed(1)}"></div></div><b>${val}</b></div>`}).join('')
}
function selectAllMunicipalities(){
  map.querySelectorAll('.municipality').forEach(x=>x.classList.remove('selected'));
  document.getElementById('name').innerHTML='Pangasinan II — All Municipalities';
  document.getElementById('empty').hidden=true;document.getElementById('panel').hidden=false;
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
  const pct=k=>Math.round(t[k]/t.total*100);
  [['high','highBar','highPct'],['moderate','modBar','modPct'],['low','lowBar','lowPct']].forEach(([k,b,p])=>{document.getElementById(b).style.width=pct(k)+'%';document.getElementById(p).textContent=pct(k)+'%'});
  const max=Math.max(...Object.values(lv));
  document.getElementById('levels').innerHTML=levelKeys.map(label=>{const val=lv[label];return `<div class="levelbar"><span>${label}</span><div class="track level-track"><div class="fill" style="width:${val/max*100}%"></div></div><b>${val}</b></div>`}).join('');
}
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
    municipalityData=await API.getAdminDashboard();
  }catch(error){
    console.error('[AdminDashboard] Unable to load dashboard data',error);
    showToast('Unable to load division risk data.');
    municipalityData={};
  }
  recolorMap();
  populateMunicipalitySelect();
  selectAllMunicipalities();
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
