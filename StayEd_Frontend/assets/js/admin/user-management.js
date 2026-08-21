// Must run first, before anything else on this page executes.
Guards.admin();
let clcsByMuni={};
async function loadClcOptions(){
  try{
    const response=await API.get('/clcs');
    const list=response.data||[];
    const grouped={};
    list.forEach(c=>{
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
    showToast('Unable to load teacher accounts.');
    teachers=[];
  }
  renderKPIs();
  renderTable();
}

let activeFilter="all",searchTerm="",currentPage=1;
const PAGE_SIZE=10;
let activeTeacherId=null,realPassword="",passwordVisible=false;

function initials(name){return name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
function statusBadge(s){const label={active:"Active",pending:"Pending",deactivated:"Deactivated"}[s];return `<span class="badge ${s}">${label}</span>`}
function renderPagination(containerId,totalItems,page,pageSize,onPageChange){
  const container=document.getElementById(containerId);
  const totalPages=Math.max(1,Math.ceil(totalItems/pageSize));
  const startItem=totalItems===0?0:(page-1)*pageSize+1;
  const endItem=Math.min(page*pageSize,totalItems);
  const addBtn=p=>`<button class="page-btn ${p===page?'active':''}" data-page="${p}">${p}</button>`;
  let pageBtns='';
  if(totalPages<=7){
    for(let p=1;p<=totalPages;p++) pageBtns+=addBtn(p);
  }else{
    pageBtns+=addBtn(1);
    if(page>3) pageBtns+='<span class="page-ellipsis">…</span>';
    const start=Math.max(2,page-1), end=Math.min(totalPages-1,page+1);
    for(let p=start;p<=end;p++) pageBtns+=addBtn(p);
    if(page<totalPages-2) pageBtns+='<span class="page-ellipsis">…</span>';
    pageBtns+=addBtn(totalPages);
  }
  container.innerHTML=`
    <div class="pagination-info">Showing ${startItem} to ${endItem} of ${totalItems} entries</div>
    <div class="pagination-controls">
      <button class="page-nav" id="${containerId}-prev" ${page<=1?'disabled':''} aria-label="Previous page">&lt;</button>
      ${pageBtns}
      <button class="page-nav" id="${containerId}-next" ${page>=totalPages?'disabled':''} aria-label="Next page">&gt;</button>
    </div>`;
  container.querySelectorAll('.page-btn').forEach(btn=>btn.addEventListener('click',()=>onPageChange(+btn.dataset.page)));
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

function renderKPIs(){
  document.getElementById('kpiTotal').textContent=teachers.length;
  const pendingCount=teachers.filter(t=>t.status==='pending').length;
  document.getElementById('kpiPending').textContent=pendingCount;
  document.getElementById('kpiActive').textContent=teachers.filter(t=>t.status==='active').length;
  document.getElementById('kpiDeactivated').textContent=teachers.filter(t=>t.status==='deactivated').length;
  document.getElementById('pendingKpiDot').style.display=pendingCount>0?'block':'none';
}


function renderTable(){
  const tbody=document.getElementById('tbody');
  let rows=teachers.filter(t=>activeFilter==='all'||t.status===activeFilter);
  if(searchTerm) rows=rows.filter(t=>t.name.toLowerCase().includes(searchTerm)||(t.clcs&&t.clcs.some(c=>c.toLowerCase().includes(searchTerm))));
  const totalFiltered=rows.length;
  const totalPages=Math.max(1,Math.ceil(totalFiltered/PAGE_SIZE));
  if(currentPage>totalPages) currentPage=totalPages;
  const pageRows=rows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  if(!totalFiltered){
    const filtered=searchTerm||activeFilter!=='all';
    tbody.innerHTML=`<tr class="empty-row"><td colspan="4"><div class="empty-state">
      <div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></div>
      <div class="empty-title">No teachers found</div>
      <div class="empty-desc">${filtered?"We couldn't find any teachers matching your current filters. Try adjusting your search.":'No teachers have been added yet.'}</div>
      ${filtered?'<button class="btn primary" onclick="clearTeacherFilters()">Clear filters</button>':''}
    </div></td></tr>`;
    renderPagination('umPagination',0,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
    return;
  }
  tbody.innerHTML=pageRows.map(t=>{
    let actions='';
    if(t.status==='pending'){
      actions=`<button class="btn primary" onclick="openReview(${t.id})">Review</button>`;
    }else{
      actions=`<button class="btn" onclick="openEdit(${t.id})">Edit</button>`;
    }
    return `<tr>
      <td><div class="person"><div class="avatar">${initials(t.name)}</div><div><div class="name">${t.name}</div><div class="email">${t.email}</div></div></div></td>
      <td>${clcChips(t.clcs)}</td>
      <td>${statusBadge(t.status)}</td>
      <td><div class="rowActions">${actions}</div></td>
    </tr>`;
  }).join('');
  renderPagination('umPagination',totalFiltered,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
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

function showToast(msg){
  const t=document.getElementById('toast');
  t.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>${msg}`;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('show')}));

function openReview(id){
  const t=teachers.find(x=>x.id===id); activeTeacherId=id;
  document.getElementById('rv-avatar').textContent=initials(t.name);
  document.getElementById('rv-name').textContent=t.name;
  document.getElementById('rv-email').textContent=t.email;
  document.getElementById('rv-empid').textContent=t.employeeId;
  document.getElementById('rv-phone').textContent=t.phone;
  document.getElementById('rv-date').textContent=t.date;
  document.getElementById('rv-muni').textContent=t.municipality;
  document.getElementById('rv-clc').textContent=t.clc||'Unassigned';
  openModal('modal-review');
}
document.getElementById('rv-approve-btn').addEventListener('click',()=>{closeModal('modal-review');openApprove(activeTeacherId)});
document.getElementById('rv-reject-btn').addEventListener('click',()=>{closeModal('modal-review');openReject(activeTeacherId)});

function openApprove(id){
  activeTeacherId=id; const t=teachers.find(x=>x.id===id);
  document.getElementById('ap-name').textContent=t.name;
  document.getElementById('ap-email').textContent=t.email;
  document.getElementById('ap-muni').value=t.municipality;
  document.getElementById('ap-clc').value=t.clc||'Unassigned';
  openModal('modal-approve');
}
document.getElementById('ap-confirm-btn').addEventListener('click',async()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  const name=t.name;
  try{
    await API.post(`/admin/users/${activeTeacherId}/approve`,{});
    closeModal('modal-approve');
    await loadTeachers();
    showToast(`${name} approved`);
  }catch(error){
    console.error('[UserManagement] Approve failed',error);
    showToast('Unable to approve this account.');
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
  try{
    await API.post(`/admin/users/${activeTeacherId}/reject`,{});
    closeModal('modal-reject');
    await loadTeachers();
    showToast(`${name}'s registration rejected`);
  }catch(error){
    console.error('[UserManagement] Reject failed',error);
    showToast('Unable to reject this registration.');
  }
});

let editClcDraft=[];
function renderEditClcList(){
  const muni=document.getElementById('edit-muni').value;
  const select=document.getElementById('edit-clc-select');
  const pool=clcsByMuni[muni]||[];
  const available=pool.filter(c=>!editClcDraft.includes(c));
  select.innerHTML='<option value="" disabled selected hidden>Select CLC…</option>'+available.map(c=>`<option>${c}</option>`).join('');
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
  document.getElementById('edit-empid').value=t.employeeId;
  document.getElementById('edit-phone').value=t.phone;
  document.getElementById('edit-email').value=t.email;
  const muniSel=document.getElementById('edit-muni');
  muniSel.innerHTML=Object.keys(clcsByMuni).sort().map(m=>`<option ${m===t.municipality?'selected':''}>${m}</option>`).join('');
  editClcDraft=[...(t.clcs||[])];
  renderEditClcList();
  document.getElementById('edit-status-val').innerHTML=statusBadge(t.status);
  const qaTitle=document.getElementById('edit-quick-title');
  const qaSub=document.getElementById('edit-quick-sub');
  const qaBtn=document.getElementById('edit-quick-btn');
  if(t.status==='deactivated'){
    qaTitle.textContent='Reactivate account';
    qaSub.textContent="Restore this teacher's sign-in access.";
    qaBtn.textContent='Reactivate';
    qaBtn.className='btn primary';
  }else{
    qaTitle.textContent='Deactivate account';
    qaSub.textContent="Revoke this teacher's sign-in access.";
    qaBtn.textContent='Deactivate';
    qaBtn.className='btn danger';
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
    showToast(error?.data?.message||'Unable to update this account.');
  }
});
document.getElementById('edit-quick-btn').addEventListener('click',()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  closeModal('modal-edit');
  if(t.status==='deactivated'){ reactivate(t.id); } else { openDeactivate(t.id); }
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
    showToast('Unable to reset this password.');
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
  document.getElementById('dc-warning').style.display=(t.clcs&&t.clcs.length)?'block':'none';
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
    showToast('Unable to deactivate this account.');
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
    showToast('Unable to reactivate this account.');
  }
}

// Create Teacher Account
const createClcSelect=document.getElementById('cr-clc');
const createMuniSelect=document.getElementById('cr-muni');
function populateCreateMuniOptions(){
  createMuniSelect.innerHTML='<option value="" disabled selected hidden>Select Municipality…</option>'+Object.keys(clcsByMuni).sort().map(m=>`<option>${m}</option>`).join('');
}
function populateCreateClc(muni){
  const list=clcsByMuni[muni]||[];
  createClcSelect.innerHTML='<option value="" disabled selected hidden>Select CLC…</option>'+list.map(c=>`<option>${c}</option>`).join('');
}
createMuniSelect.addEventListener('change',()=>populateCreateClc(createMuniSelect.value));
document.getElementById('createTeacherBtn').addEventListener('click',()=>{
  ['cr-first','cr-middle','cr-last','cr-email','cr-phone','cr-empid'].forEach(id=>document.getElementById(id).value='');
  createMuniSelect.selectedIndex=0;
  createClcSelect.innerHTML='<option value="" disabled selected hidden>Select CLC…</option>';
  openModal('modal-create');
});
document.getElementById('cr-save-btn').addEventListener('click',async()=>{
  const first=document.getElementById('cr-first').value.trim();
  const last=document.getElementById('cr-last').value.trim();
  const email=document.getElementById('cr-email').value.trim();
  if(!first||!last||!email){ showToast('Please fill in first name, last name, and email'); return; }
  const payload={
    firstName:first,
    middleName:document.getElementById('cr-middle').value.trim(),
    lastName:last,
    email,
    phone:document.getElementById('cr-phone').value.trim(),
    employeeId:document.getElementById('cr-empid').value.trim(),
    municipality:createMuniSelect.value,
    clc:createClcSelect.value,
  };
  try{
    const response=await API.post('/admin/users',payload);
    closeModal('modal-create');
    await loadTeachers();
    realPassword=response.temp_password; passwordVisible=false;
    document.getElementById('ps-name').textContent=response.data.name;
    document.getElementById('temp-pass-val').textContent='••••••••••••';
    openModal('modal-reset-success');
  }catch(error){
    console.error('[UserManagement] Create failed',error);
    showToast(error?.data?.message||'Unable to create this account.');
  }
});

loadTeachers();
loadClcOptions();

document.querySelectorAll('.select-wrap select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.select-wrap').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.select-wrap').classList.remove('open'));});
