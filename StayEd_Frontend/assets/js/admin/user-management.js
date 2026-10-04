// Must run first, before anything else on this page executes.
Guards.admin();
let clcsByMuni={};
let allClcs=[];
async function loadClcOptions(){
  try{
    const response=await API.getAdminClcs();
    const allowedMunicipalities=new Set(DIVISION_II_MUNICIPALITIES.map(m=>m.name.toLowerCase()));
    const list=(response.data||[]).filter(c=>allowedMunicipalities.has(String(c.municipality||'').toLowerCase()));
    const grouped={};
    allClcs=list.map(c=>({name:c.name,municipality:c.municipality,status:c.status}));
    allClcs.forEach(c=>{
      if(!grouped[c.municipality]) grouped[c.municipality]=[];
      grouped[c.municipality].push(c.name);
    });
    clcsByMuni=grouped;
  }catch(error){
    console.error('[UserManagement] Failed to load CLC list',error);
    clcsByMuni={};
  }
  populateCreateMuniOptions();
}

let teachers=[];

async function loadTeachers(){
  try{
    const response=await API.get('/admin/users');
    teachers=response.data||[];
  }catch(error){
    console.error('[UserManagement] Failed to load teachers',error);
    showToast('Unable to load teacher accounts.','error');
    teachers=[];
  }
  renderKPIs();
  renderTable();
}

let activeFilter="all",searchTerm="",currentPage=1;
const PAGE_SIZE=10;
let activeTeacherId=null,realPassword="",passwordVisible=false;

const ST_REDUCE_MOTION=matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts a [data-countup] element up from its previous value to `value`
// over ~800ms (ease-out-cubic), mirroring the dashboard/registry pattern.
function countTo(el,value){
  if(!el) return;
  const end=Number(value);
  if(ST_REDUCE_MOTION||!Number.isFinite(end)){ el.textContent=value; return; }
  const start=Number(el.dataset.final??0)||0;
  el.dataset.final=end;
  const t0=performance.now();
  const dur=800;
  const tick=(t)=>{
    const k=Math.min(1,(t-t0)/dur);
    const eased=1-Math.pow(1-k,3);
    el.textContent=Math.round(start+(end-start)*eased);
    if(k<1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function replay(el){
  if(!el) return;
  el.classList.remove('is-inview');
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('is-inview')));
}

function initials(name){return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
function statusBadge(s){const label={active:"Active",pending:"Pending",deactivated:"Deactivated"}[s];return `<span class="st-pill st-pill--status st-pill--${s}">${label}</span>`}
function renderPagination(containerId,totalItems,page,pageSize,onPageChange){
  const container=document.getElementById(containerId);
  const totalPages=Math.max(1,Math.ceil(totalItems/pageSize));
  const startItem=totalItems===0?0:(page-1)*pageSize+1;
  const endItem=Math.min(page*pageSize,totalItems);
  const addBtn=p=>`<button class="st-page-btn ${p===page?'is-active':''}" data-page="${p}">${p}</button>`;
  let pageBtns='';
  if(totalPages<=7){
    for(let p=1;p<=totalPages;p++) pageBtns+=addBtn(p);
  }else{
    pageBtns+=addBtn(1);
    if(page>3) pageBtns+='<span class="st-page-ellipsis">…</span>';
    const start=Math.max(2,page-1), end=Math.min(totalPages-1,page+1);
    for(let p=start;p<=end;p++) pageBtns+=addBtn(p);
    if(page<totalPages-2) pageBtns+='<span class="st-page-ellipsis">…</span>';
    pageBtns+=addBtn(totalPages);
  }
  container.innerHTML=`
    <span class="st-pagination-info">Showing ${startItem}–${endItem} of ${totalItems} entries</span>
    <div class="st-pagination-controls">
      <button class="st-page-btn" id="${containerId}-prev" ${page<=1?'disabled':''} aria-label="Previous page"><span class="material-symbols-outlined">chevron_left</span></button>
      ${pageBtns}
      <button class="st-page-btn" id="${containerId}-next" ${page>=totalPages?'disabled':''} aria-label="Next page"><span class="material-symbols-outlined">chevron_right</span></button>
    </div>`;
  container.querySelectorAll('.st-page-btn[data-page]').forEach(btn=>btn.addEventListener('click',()=>onPageChange(+btn.dataset.page)));
  const prevBtn=document.getElementById(`${containerId}-prev`);
  const nextBtn=document.getElementById(`${containerId}-next`);
  if(prevBtn) prevBtn.addEventListener('click',()=>{if(page>1)onPageChange(page-1)});
  if(nextBtn) nextBtn.addEventListener('click',()=>{if(page<totalPages)onPageChange(page+1)});
}
function clcChips(list){
  if(!list||!list.length) return '<span class="more-chip">Unassigned</span>';
  const shown=list.slice(0,2).map(c=>`<span class="teacher-chip">${c}</span>`).join('');
  const extra=list.length>2?`<span class="more-chip">+${list.length-2} more</span>`:'';
  return shown+extra;
}

function pct(part,total){ return total?Math.round((part/total)*100):0; }

function renderKPIs(){
  const total=teachers.length;
  const pendingCount=teachers.filter(t=>t.status==='pending').length;
  const activeCount=teachers.filter(t=>t.status==='active').length;
  const deactivatedCount=teachers.filter(t=>t.status==='deactivated').length;

  document.getElementById('kpiTotal').dataset.final=total;
  countTo(document.getElementById('kpiTotal'),total);
  countTo(document.getElementById('kpiPending'),pendingCount);
  countTo(document.getElementById('kpiActive'),activeCount);
  countTo(document.getElementById('kpiDeactivated'),deactivatedCount);
  document.getElementById('pendingKpiDot').style.display=pendingCount>0?'block':'none';

  document.getElementById('kpiPendingPct').textContent=total?`${pct(pendingCount,total)}%${pendingCount>0?' · needs review':''}`:'';
  document.getElementById('kpiActivePct').textContent=total?`${pct(activeCount,total)}%`:'';
  document.getElementById('kpiDeactivatedPct').textContent=total?`${pct(deactivatedCount,total)}%`:'';

  document.getElementById('stripPending').style.flexGrow=Math.max(pendingCount,total?0:1);
  document.getElementById('stripActive').style.flexGrow=Math.max(activeCount,total?0:1);
  document.getElementById('stripOff').style.flexGrow=Math.max(deactivatedCount,total?0:1);
  document.getElementById('admStrip').setAttribute('aria-label',`${pendingCount} pending, ${activeCount} active, ${deactivatedCount} deactivated`);

  replay(document.querySelector('.st-panel[data-animate]'));
}


function renderTable(){
  const tbody=document.getElementById('tbody');
  let rows=teachers.filter(t=>activeFilter==='all'||t.status===activeFilter);
  if(searchTerm) rows=rows.filter(t=>t.name.toLowerCase().includes(searchTerm)||(t.clcs&&t.clcs.some(c=>c.toLowerCase().includes(searchTerm))));
  const totalFiltered=rows.length;
  const totalPages=Math.max(1,Math.ceil(totalFiltered/PAGE_SIZE));
  if(currentPage>totalPages) currentPage=totalPages;
  const pageRows=rows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const countEl=document.querySelector('[data-um-count]');
  if(countEl) countEl.textContent=`${teachers.length} teacher${teachers.length===1?'':'s'}`;
  if(!totalFiltered){
    const filtered=searchTerm||activeFilter!=='all';
    tbody.innerHTML=`<tr><td colspan="4"><div class="empty-state">
      <div class="empty-icon"><span class="material-symbols-outlined">search_off</span></div>
      <div class="empty-title">No teachers found</div>
      <div class="empty-desc">${filtered?"We couldn't find any teachers matching your current filters. Try adjusting your search.":'No teachers have been added yet.'}</div>
      ${filtered?'<button class="st-btn st-btn-primary" onclick="clearTeacherFilters()">Clear filters</button>':''}
    </div></td></tr>`;
    renderPagination('umPagination',0,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
    return;
  }
  tbody.innerHTML=pageRows.map((t,i)=>{
    let actions='';
    if(t.status==='pending'){
      actions=`<button class="st-btn st-btn-primary st-btn-xs" onclick="openReview(${t.id})"><span class="material-symbols-outlined">fact_check</span>Review</button>`;
    }else{
      actions=`<button class="st-btn st-btn-outline st-btn-xs" onclick="openEdit(${t.id})">Edit</button>`;
    }
    return `<tr style="--i:${i}">
      <td data-col="learner"><div class="st-learner-cell"><span class="st-avatar-initials${t.status==='pending'?' st-avatar-initials--moderate':''}">${initials(t.name)}</span><div style="min-width:0"><span class="st-learner-name" style="cursor:default">${t.name}</span><p class="st-learner-sub">${t.email}</p></div></div></td>
      <td data-col="level"><div class="st-clc-chips">${clcChips(t.clcs)}</div></td>
      <td data-col="status">${statusBadge(t.status)}</td>
      <td data-col="actions" class="is-right"><div class="st-row-actions">${actions}</div></td>
    </tr>`;
  }).join('');
  renderPagination('umPagination',totalFiltered,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
  replay(tbody);
}
function clearTeacherFilters(){
  searchTerm=''; document.getElementById('searchInput').value='';
  currentPage=1;
  setFilter('all');
}

function setFilter(f){
  activeFilter=f;
  currentPage=1;
  document.querySelectorAll('.kpi').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));
  renderTable();
}
document.querySelectorAll('.kpi').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
document.getElementById('searchInput').addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();currentPage=1;renderTable()});

function showToast(msg,type='success'){
  Utils.toast(msg,type);
}
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('show')}));

function openReview(id){
  const t=teachers.find(x=>x.id===id); activeTeacherId=id;
  document.getElementById('rv-avatar').textContent=initials(t.name);
  document.getElementById('rv-name').textContent=t.name;
  document.getElementById('rv-email').textContent=t.email;
  const verifiedBadge=document.getElementById('rv-verified-badge');
  verifiedBadge.classList.toggle('is-unverified',!t.isDepedVerified);
  verifiedBadge.textContent=t.isDepedVerified?'DepEd email verified':'Not a DepEd email — verify manually';
  const rosterBadge=document.getElementById('rv-roster-badge');
  rosterBadge.classList.toggle('is-unverified',!t.isOnRoster);
  rosterBadge.textContent=t.isOnRoster?'On official ALS teachers roster':'Not found on roster — verify manually';
  document.getElementById('rv-empid').textContent=t.employeeId;
  document.getElementById('rv-phone').textContent=t.phone;
  document.getElementById('rv-date').textContent=t.date;
  initReviewAssignment(t);
  openModal('modal-review');
}

// Municipality + CLC on the review screen: prefilled from the teacher's record
// (what registration saved), else from the ALS roster, else left blank for the
// admin to pick. Whatever is selected here is what approval saves.
let reviewDraft={municipality:'',clc:'',source:{municipality:'',clc:''}};
const isUnassigned=v=>!v||String(v).trim().toLowerCase()==='unassigned';
function initReviewAssignment(t){
  let municipality='',clc='',muniSource='',clcSource='';
  if(!isUnassigned(t.municipality)){municipality=t.municipality;muniSource='record';}
  else if(t.rosterMunicipality){municipality=t.rosterMunicipality;muniSource='roster';}
  if(t.clc){clc=t.clc;clcSource='record';}
  else if(t.rosterClc&&municipality===t.rosterMunicipality){clc=t.rosterClc;clcSource='roster';}
  reviewDraft={municipality,clc,source:{municipality:muniSource,clc:clcSource}};
  const muniSel=document.getElementById('rv-muni');
  const muniOptions=DIVISION_II_MUNICIPALITIES.map(m=>m.name);
  if(municipality&&!muniOptions.includes(municipality)) muniOptions.unshift(municipality);
  muniSel.innerHTML='<option value="" disabled hidden>Select municipality…</option>'+muniOptions.map(m=>`<option value="${m}">${m}</option>`).join('');
  muniSel.value=municipality;
  renderReviewClcOptions();
}
function renderReviewClcOptions(){
  const {municipality,clc}=reviewDraft;
  const clcSel=document.getElementById('rv-clc');
  const names=allClcs.filter(c=>c.municipality===municipality&&c.status==='active').map(c=>c.name).sort((a,b)=>a.localeCompare(b));
  if(clc&&!names.includes(clc)) names.unshift(clc);
  const placeholder=!municipality?'Select a municipality first':names.length?'Select CLC…':'No CLCs in this municipality';
  clcSel.innerHTML=`<option value="" disabled hidden>${placeholder}</option>`+names.map(n=>`<option value="${n}">${n}</option>`).join('');
  clcSel.disabled=!municipality||!names.length;
  clcSel.value=clc;
  renderReviewAssignmentNote();
}
function renderReviewAssignmentNote(){
  const note=document.getElementById('rv-assign-note');
  const {municipality,clc,source}=reviewDraft;
  const missing=!municipality||!clc;
  let text;
  if(!municipality) text='No municipality or CLC on record for this teacher — select both.';
  else if(!clc) text=source.municipality==='edited'?'Select a CLC in this municipality before approving.':'No CLC on record for this teacher — select one before approving.';
  else if(source.municipality==='roster'||source.clc==='roster') text='Filled in from the ALS teachers roster. Change it if needed.';
  else if(source.municipality==='record'&&source.clc==='record') text="Taken from the teacher's record. Change it if needed.";
  else text='Changes are saved when you approve the account.';
  note.textContent=text;
  note.classList.toggle('is-missing',missing);
}
document.getElementById('rv-muni').addEventListener('change',e=>{
  reviewDraft.municipality=e.target.value;
  reviewDraft.source.municipality='edited';
  // Keep the CLC only if it belongs to the newly picked municipality
  if(!allClcs.some(c=>c.name===reviewDraft.clc&&c.municipality===reviewDraft.municipality)){reviewDraft.clc='';reviewDraft.source.clc='';}
  renderReviewClcOptions();
});
document.getElementById('rv-clc').addEventListener('change',e=>{
  reviewDraft.clc=e.target.value;
  reviewDraft.source.clc='edited';
  renderReviewAssignmentNote();
});
document.getElementById('rv-approve-btn').addEventListener('click',()=>{
  if(!reviewDraft.municipality||!reviewDraft.clc){
    showToast('Please select a municipality and assign a CLC','warning');
    return;
  }
  closeModal('modal-review');openApprove(activeTeacherId);
});
document.getElementById('rv-reject-btn').addEventListener('click',()=>{closeModal('modal-review');openReject(activeTeacherId)});

function openApprove(id){
  activeTeacherId=id; const t=teachers.find(x=>x.id===id);
  document.getElementById('ap-name').textContent=t.name;
  document.getElementById('ap-email').textContent=t.email;
  document.getElementById('ap-muni').value=reviewDraft.municipality;
  document.getElementById('ap-clc').value=reviewDraft.clc;
  openModal('modal-approve');
}
document.getElementById('ap-confirm-btn').addEventListener('click',async()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  const name=t.name;
  try{
    await API.post(`/admin/users/${activeTeacherId}/approve`,{municipality:reviewDraft.municipality,clc:reviewDraft.clc});
    closeModal('modal-approve');
    await loadTeachers();
    showToast(`${name} approved`);
  }catch(error){
    console.error('[UserManagement] Approve failed',error);
    showToast(error?.data?.message||'Unable to approve this account.','error');
  }
});

function openReject(id){
  activeTeacherId=id; const t=teachers.find(x=>x.id===id);
  document.getElementById('rj-name').textContent=t.name;
  document.getElementById('rj-email').textContent=t.email;
  document.querySelectorAll('input[name="reject-reason"]').forEach(r=>r.checked=false);
  document.getElementById('reject-remarks').value='';
  openModal('modal-reject');
}
document.getElementById('rj-confirm-btn').addEventListener('click',async()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  const name=t.name;
  const reasonInput=document.querySelector('input[name="reject-reason"]:checked');
  const reason=reasonInput?reasonInput.value:'';
  const remarks=document.getElementById('reject-remarks').value.trim();
  try{
    await API.post(`/admin/users/${activeTeacherId}/reject`,{reason,remarks});
    closeModal('modal-reject');
    await loadTeachers();
    showToast(`${name}'s registration rejected`);
  }catch(error){
    console.error('[UserManagement] Reject failed',error);
    showToast('Unable to reject this registration.','error');
  }
});

let editClcDraft=[];
function availableClcOptions(includeAssigned=false){
  const assigned=new Set(editClcDraft);
  const muni=document.getElementById('edit-muni').value;
  return allClcs
    .filter(c=>c.municipality===muni)
    .filter(c=>c.status==='active'||(includeAssigned&&assigned.has(c.name)))
    .sort((a,b)=>a.name.localeCompare(b.name));
}
function renderEditClcList(){
  const select=document.getElementById('edit-clc-select');
  const available=availableClcOptions(true).filter(c=>!editClcDraft.includes(c.name));
  select.innerHTML='<option value="" disabled selected hidden>Select CLC…</option>'+available.map(c=>`<option value="${c.name}">${c.name} — ${c.municipality}</option>`).join('');
  const list=document.getElementById('edit-clc-list');
  if(!editClcDraft.length){
    list.innerHTML='<div class="empty-note">No CLCs assigned yet.</div>';
  }else{
    list.innerHTML=editClcDraft.map(c=>`<div class="arow"><span class="an">${c}</span><button class="remove-link" data-clc="${c}">Remove</button></div>`).join('');
    list.querySelectorAll('.remove-link').forEach(btn=>btn.addEventListener('click',()=>{
      editClcDraft=editClcDraft.filter(c=>c!==btn.dataset.clc); renderEditClcList();
    }));
  }
  document.getElementById('edit-clc-count').textContent=editClcDraft.length?`${editClcDraft.length} CLC${editClcDraft.length>1?'s':''}`:'Unassigned';
}
document.getElementById('edit-muni').addEventListener('change',renderEditClcList);
document.getElementById('edit-clc-add-btn').addEventListener('click',()=>{
  const sel=document.getElementById('edit-clc-select');
  if(sel.value){ editClcDraft.push(sel.value); renderEditClcList(); }
});

function openEdit(id){
  activeTeacherId=id; const t=teachers.find(x=>x.id===id);
  document.getElementById('edit-first').value=t.firstName;
  document.getElementById('edit-middle').value=t.middleName;
  document.getElementById('edit-last').value=t.lastName;
  const empidInput=document.getElementById('edit-empid');
  const isPendingEmpId=/^pending-\d+$/i.test(t.employeeId||'');
  empidInput.value=isPendingEmpId?'':t.employeeId;
  empidInput.placeholder=isPendingEmpId?'Not yet assigned — enter Employee ID':'e.g. 1234567';
  document.getElementById('edit-phone').value=t.phone;
  document.getElementById('edit-email').value=t.email;
  const muniSel=document.getElementById('edit-muni');
  const muniOptions=DIVISION_II_MUNICIPALITIES.map(m=>m.name);
  // A teacher's current municipality might not have any registered CLC yet
  // (e.g. it was left as "Unassigned" at creation) -- if we only render
  // options from clcsByMuni, the browser silently selects whatever's first
  // alphabetically instead of the teacher's real value, and a Save with no
  // other changes would then silently overwrite it.
  if(t.municipality && !muniOptions.includes(t.municipality)){
    muniOptions.unshift(t.municipality);
  }
  muniSel.innerHTML=muniOptions.map(m=>`<option ${m===t.municipality?'selected':''}>${m}</option>`).join('');
  editClcDraft=[...(t.clcs||[])];
  renderEditClcList();
  document.getElementById('edit-status-val').innerHTML=statusBadge(t.status);
  const qaTitle=document.getElementById('edit-quick-title');
  const qaSub=document.getElementById('edit-quick-sub');
  const qaBtn=document.getElementById('edit-quick-btn');
  const removeBtn=document.getElementById('edit-remove-btn');
  if(t.status==='deactivated'){
    qaTitle.textContent='Remove account';
    qaSub.textContent='Permanently delete this deactivated teacher account.';
    qaBtn.textContent='Remove';
    removeBtn.hidden=false;
  }else{
    qaTitle.textContent='Deactivate account';
    qaSub.textContent="Revoke this teacher's sign-in access.";
    qaBtn.textContent='Deactivate';
    removeBtn.hidden=true;
  }
  openModal('modal-edit');
}
document.getElementById('edit-save-btn').addEventListener('click',async()=>{
  const payload={
    firstName:document.getElementById('edit-first').value.trim(),
    middleName:document.getElementById('edit-middle').value.trim(),
    lastName:document.getElementById('edit-last').value.trim(),
    employeeId:document.getElementById('edit-empid').value.trim(),
    phone:document.getElementById('edit-phone').value.trim(),
    email:document.getElementById('edit-email').value.trim(),
    municipality:document.getElementById('edit-muni').value,
    clcs:[...editClcDraft],
  };
  try{
    await API.put(`/admin/users/${activeTeacherId}`,payload);
    closeModal('modal-edit');
    await loadTeachers();
    showToast('Teacher account updated');
  }catch(error){
    console.error('[UserManagement] Update failed',error);
    showToast(error?.data?.message||'Unable to update this account.','error');
  }
});
document.getElementById('edit-remove-btn').addEventListener('click',()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  if(t?.status==='deactivated'){
    closeModal('modal-edit');
    openRemove(t.id);
  }
});
document.getElementById('edit-quick-btn').addEventListener('click',()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  closeModal('modal-edit');
  if(t.status==='deactivated'){ openRemove(t.id); } else { openDeactivate(t.id); }
});
document.getElementById('edit-reset-btn').addEventListener('click',()=>{
  closeModal('modal-edit');
  openReset(activeTeacherId);
});

function openReset(id){
  activeTeacherId=id; const t=teachers.find(x=>x.id===id);
  document.getElementById('rs-name').textContent=t.name;
  document.getElementById('rs-email').textContent=t.email;
  openModal('modal-reset');
}
document.getElementById('rs-confirm-btn').addEventListener('click',async()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  try{
    const response=await API.post(`/admin/users/${activeTeacherId}/reset-password`,{});
    closeModal('modal-reset');
    realPassword=response.temp_password; passwordVisible=false;
    document.getElementById('ps-name').textContent=t.name;
    document.getElementById('temp-pass-val').textContent='••••••••••••';
    openModal('modal-reset-success');
  }catch(error){
    console.error('[UserManagement] Reset password failed',error);
    showToast('Unable to reset this password.','error');
  }
});
document.getElementById('toggle-pass-btn').addEventListener('click',()=>{
  passwordVisible=!passwordVisible;
  document.getElementById('temp-pass-val').textContent=passwordVisible?realPassword:'••••••••••••';
});
document.getElementById('copy-pass-btn').addEventListener('click',()=>{
  navigator.clipboard?.writeText(realPassword).catch(()=>{});
  showToast('Password copied');
});

function openDeactivate(id){
  activeTeacherId=id; const t=teachers.find(x=>x.id===id);
  document.getElementById('dc-name').textContent=t.name;
  document.getElementById('dc-status').innerHTML=statusBadge(t.status);
  document.getElementById('dc-clc-count').textContent=(t.clcs&&t.clcs.length)?`${t.clcs.length} CLC${t.clcs.length>1?'s':''}`:'Unassigned';
  document.getElementById('dc-warning').hidden=!(t.clcs&&t.clcs.length);
  openModal('modal-deactivate');
}
document.getElementById('dc-confirm-btn').addEventListener('click',async()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  const name=t.name;
  try{
    await API.post(`/admin/users/${activeTeacherId}/suspend`,{});
    closeModal('modal-deactivate');
    await loadTeachers();
    showToast(`${name} deactivated`);
  }catch(error){
    console.error('[UserManagement] Deactivate failed',error);
    showToast('Unable to deactivate this account.','error');
  }
});

function openRemove(id){
  activeTeacherId=id;
  const t=teachers.find(x=>x.id===id);
  if (!t) return;
  document.getElementById('rm-name').textContent=t.name;
  document.getElementById('rm-email').textContent=t.email;
  document.getElementById('rm-status').innerHTML=statusBadge(t.status);
  openModal('modal-remove');
}
document.getElementById('rm-confirm-btn').addEventListener('click',async()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  const name=t?.name || 'This account';
  try{
    await API.delete(`/admin/users/${activeTeacherId}`);
    closeModal('modal-remove');
    await loadTeachers();
    showToast(`${name} removed`);
  }catch(error){
    console.error('[UserManagement] Remove failed',error);
    showToast(error?.data?.message || 'Unable to remove this account.','error');
  }
});
async function reactivate(id){
  const t=teachers.find(x=>x.id===id);
  const name=t.name;
  try{
    await API.post(`/admin/users/${id}/approve`,{});
    await loadTeachers();
    showToast(`${name} reactivated`);
  }catch(error){
    console.error('[UserManagement] Reactivate failed',error);
    showToast('Unable to reactivate this account.','error');
  }
}

// Create Account (Teacher or Admin)
const createClcSelect=document.getElementById('cr-clc');
const createMuniSelect=document.getElementById('cr-muni');
let createRole='teacher';
function populateCreateMuniOptions(){
  createMuniSelect.innerHTML='<option value="" disabled selected hidden>Select Municipality…</option>'+DIVISION_II_MUNICIPALITIES.map(m=>`<option>${m.name}</option>`).join('');
}
function populateCreateClc(muni){
  const list=allClcs.filter(c=>c.status==='active'&&c.municipality===muni).sort((a,b)=>a.name.localeCompare(b.name));
  createClcSelect.innerHTML='<option value="" disabled selected hidden>Select CLC…</option>'+list.map(c=>`<option value="${c.name}">${c.name} — ${c.municipality}</option>`).join('');
}
createMuniSelect.addEventListener('change',()=>populateCreateClc(createMuniSelect.value));

function setCreateRole(role){
  createRole=role;
  document.querySelectorAll('#cr-role-toggle .role-toggle-btn').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
  const isTeacher=role==='teacher';
  document.getElementById('cr-empid-field').style.display=isTeacher?'':'none';
  document.getElementById('cr-clc-fields').style.display=isTeacher?'':'none';
}
document.querySelectorAll('#cr-role-toggle .role-toggle-btn').forEach(btn=>{
  btn.addEventListener('click',()=>setCreateRole(btn.dataset.role));
});

document.getElementById('createTeacherBtn').addEventListener('click',()=>{
  ['cr-first','cr-middle','cr-last','cr-email','cr-phone','cr-empid'].forEach(id=>document.getElementById(id).value='');
  createMuniSelect.selectedIndex=0;
  populateCreateClc('');
  setCreateRole('teacher');
  openModal('modal-create');
});
document.getElementById('cr-save-btn').addEventListener('click',async()=>{
  const first=document.getElementById('cr-first').value.trim();
  const last=document.getElementById('cr-last').value.trim();
  const email=document.getElementById('cr-email').value.trim();
  if(!first||!last||!email){ showToast('Please fill in first name, last name, and email','warning'); return; }
  const payload={
    role:createRole,
    firstName:first,
    middleName:document.getElementById('cr-middle').value.trim(),
    lastName:last,
    email,
    phone:document.getElementById('cr-phone').value.trim(),
  };
  if(createRole==='teacher'){
    payload.employeeId=document.getElementById('cr-empid').value.trim();
    payload.municipality=createMuniSelect.value;
    payload.clc=createClcSelect.value;
    if(!payload.municipality||!payload.clc){
      showToast('Please select a municipality and assign a CLC','warning');
      return;
    }
  }
  try{
    const response=await API.post('/admin/users',payload);
    closeModal('modal-create');
    if(createRole==='teacher') await loadTeachers();
    realPassword=response.temp_password; passwordVisible=false;
    document.getElementById('ps-name').textContent=response.data.name;
    document.getElementById('temp-pass-val').textContent='••••••••••••';
    openModal('modal-reset-success');
    showToast(createRole==='admin'?'Admin account created':'Teacher account created');
  }catch(error){
    console.error('[UserManagement] Create failed',error);
    showToast(error?.data?.message||'Unable to create this account.','error');
  }
});

loadTeachers();
loadClcOptions();
