// Must run first, before anything else on this page executes.
Guards.admin();
const municipalityData={"alcala": {"name": "Alcala", "total": 172, "high": 5, "moderate": 9, "low": 158, "levels": {"BLP": 14, "Elementary": 44, "JHS": 65, "SHS": 21}, "clcs": 2}, "asingan": {"name": "Asingan", "total": 89, "high": 4, "moderate": 14, "low": 71, "levels": {"BLP": 11, "Elementary": 67, "JHS": 51, "SHS": 14}, "clcs": 7}, "balungao": {"name": "Balungao", "total": 186, "high": 40, "moderate": 52, "low": 94, "levels": {"BLP": 25, "Elementary": 41, "JHS": 21, "SHS": 17}, "clcs": 7}, "bautista": {"name": "Bautista", "total": 182, "high": 30, "moderate": 32, "low": 120, "levels": {"BLP": 21, "Elementary": 20, "JHS": 63, "SHS": 15}, "clcs": 4}, "binalonan": {"name": "Binalonan", "total": 89, "high": 14, "moderate": 24, "low": 51, "levels": {"BLP": 18, "Elementary": 53, "JHS": 95, "SHS": 19}, "clcs": 4}, "dagupan-city": {"name": "Dagupan City", "total": 159, "high": 23, "moderate": 19, "low": 117, "levels": {"BLP": 30, "Elementary": 62, "JHS": 85, "SHS": 16}, "clcs": 1}, "laoac": {"name": "Laoac", "total": 129, "high": 4, "moderate": 40, "low": 85, "levels": {"BLP": 25, "Elementary": 59, "JHS": 91, "SHS": 24}, "clcs": 4}, "manaoag": {"name": "Manaoag", "total": 138, "high": 10, "moderate": 20, "low": 108, "levels": {"BLP": 5, "Elementary": 67, "JHS": 42, "SHS": 10}, "clcs": 4}, "mangaldan": {"name": "Mangaldan", "total": 203, "high": 15, "moderate": 63, "low": 125, "levels": {"BLP": 12, "Elementary": 48, "JHS": 22, "SHS": 13}, "clcs": 5}, "natividad": {"name": "Natividad", "total": 97, "high": 16, "moderate": 21, "low": 60, "levels": {"BLP": 27, "Elementary": 69, "JHS": 46, "SHS": 13}, "clcs": 7}, "pozorrubio": {"name": "Pozorrubio", "total": 173, "high": 17, "moderate": 11, "low": 145, "levels": {"BLP": 6, "Elementary": 52, "JHS": 92, "SHS": 2}, "clcs": 7}, "rosales": {"name": "Rosales", "total": 102, "high": 13, "moderate": 30, "low": 59, "levels": {"BLP": 29, "Elementary": 45, "JHS": 54, "SHS": 16}, "clcs": 7}, "san-fabian": {"name": "San Fabian", "total": 211, "high": 32, "moderate": 56, "low": 123, "levels": {"BLP": 25, "Elementary": 41, "JHS": 79, "SHS": 1}, "clcs": 5}, "san-jacinto": {"name": "San Jacinto", "total": 198, "high": 34, "moderate": 30, "low": 134, "levels": {"BLP": 6, "Elementary": 67, "JHS": 31, "SHS": 14}, "clcs": 5}, "san-manuel": {"name": "San Manuel", "total": 232, "high": 4, "moderate": 55, "low": 173, "levels": {"BLP": 21, "Elementary": 64, "JHS": 75, "SHS": 9}, "clcs": 8}, "san-nicolas": {"name": "San Nicolas", "total": 160, "high": 10, "moderate": 19, "low": 131, "levels": {"BLP": 21, "Elementary": 16, "JHS": 66, "SHS": 0}, "clcs": 5}, "san-quintin": {"name": "San Quintin", "total": 85, "high": 5, "moderate": 25, "low": 55, "levels": {"BLP": 17, "Elementary": 34, "JHS": 79, "SHS": 11}, "clcs": 4}, "santa-maria": {"name": "Santa Maria", "total": 206, "high": 45, "moderate": 8, "low": 153, "levels": {"BLP": 24, "Elementary": 53, "JHS": 87, "SHS": 18}, "clcs": 3}, "santo-tomas": {"name": "Santo Tomas", "total": 156, "high": 9, "moderate": 51, "low": 96, "levels": {"BLP": 7, "Elementary": 28, "JHS": 81, "SHS": 18}, "clcs": 2}, "sison": {"name": "Sison", "total": 225, "high": 23, "moderate": 73, "low": 129, "levels": {"BLP": 4, "Elementary": 43, "JHS": 26, "SHS": 5}, "clcs": 7}, "tayug": {"name": "Tayug", "total": 225, "high": 18, "moderate": 10, "low": 197, "levels": {"BLP": 16, "Elementary": 46, "JHS": 98, "SHS": 7}, "clcs": 8}, "umingan": {"name": "Umingan", "total": 167, "high": 5, "moderate": 21, "low": 141, "levels": {"BLP": 14, "Elementary": 40, "JHS": 68, "SHS": 0}, "clcs": 8}, "urdaneta-city": {"name": "Urdaneta City", "total": 105, "high": 5, "moderate": 30, "low": 70, "levels": {"BLP": 21, "Elementary": 20, "JHS": 59, "SHS": 20}, "clcs": 3}, "villasis": {"name": "Villasis", "total": 114, "high": 7, "moderate": 12, "low": 95, "levels": {"BLP": 24, "Elementary": 70, "JHS": 20, "SHS": 6}, "clcs": 4}};
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

function riskLevel(d){const rate=d.high/d.total; return rate>=.20?'high':rate>=.10?'moderate':'low'}
function riskColor(d){return {high:'#D64545',moderate:'#F39422',low:'#6BBF59'}[riskLevel(d)]}
Object.entries(municipalityData).forEach(([id,d])=>{const el=map.querySelector('#'+CSS.escape(id));if(el)el.style.fill=riskColor(d)});
const riskCounts={low:0,moderate:0,high:0};
Object.values(municipalityData).forEach(d=>{riskCounts[riskLevel(d)]++});
document.getElementById('countLow').textContent=riskCounts.low;
document.getElementById('countModerate').textContent=riskCounts.moderate;
document.getElementById('countHigh').textContent=riskCounts.high;
const levelKeys=['BLP','Elementary','JHS','SHS'];
const levelAverages=Object.fromEntries(levelKeys.map(k=>[k,Object.values(municipalityData).reduce((s,d)=>s+d.levels[k],0)/Object.keys(municipalityData).length]));
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
Object.entries(municipalityData).sort((a,b)=>a[1].name.localeCompare(b[1].name)).forEach(([id,d])=>{
  const opt=document.createElement('option');opt.value=id;opt.textContent=d.name;select.appendChild(opt);
});
select.addEventListener('change',()=>{if(select.value==='all')selectAllMunicipalities();else if(select.value)selectMunicipality(select.value)});
selectAllMunicipalities();

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
document.getElementById('sidebarLogoutBtn').addEventListener('click',e=>{e.preventDefault();openModal('modal-logout')});
document.getElementById('logout-confirm-btn').addEventListener('click',()=>{closeModal('modal-logout');Auth.logout()});

// Mobile hamburger menu
const menuBtn=document.getElementById('menuBtn');
const asideEl=document.querySelector('aside');
menuBtn.addEventListener('click',()=>{
  const open=asideEl.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded',open?'true':'false');
});
document.addEventListener('click',e=>{
  if(asideEl.classList.contains('open')&&!asideEl.contains(e.target)&&e.target!==menuBtn){
    asideEl.classList.remove('open');menuBtn.setAttribute('aria-expanded','false');
  }
});

document.querySelectorAll('.search-box select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.search-box').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.search-box').classList.remove('open'));});
