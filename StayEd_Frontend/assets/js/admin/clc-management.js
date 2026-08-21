// Must run first, before anything else on this page executes.
Guards.admin();

let allTeachers=[];
let clcs=[];

function fromApiShape(c){
  return {
    id:c.id, name:c.name, muni:c.municipality, barangay:c.barangay,
    address:c.address, teachers:c.teachers||[], learners:c.learners,
    status:c.status, archivedDate:c.archivedAt, archivedBy:c.archivedBy,
  };
}

async function loadClcs(){
  try{
    const response=await API.getAdminClcs();
    clcs=(response.data||[]).map(fromApiShape);
  }catch(error){
    console.error('[AdminClcManagement] Unable to load CLCs',error);
    showToast('Unable to load Community Learning Centers.');
    clcs=[];
  }
}

async function loadTeachers(){
  try{
    const response=await API.get('/admin/users');
    allTeachers=(response.data||[])
      .filter(t=>t.status==='active')
      .map(t=>({id:t.id, name:t.name, clc:(t.clcs&&t.clcs[0])||t.clc||'Unassigned'}));
  }catch(error){
    console.error('[AdminClcManagement] Unable to load teachers',error);
    allTeachers=[];
  }
}

let activeFilter="all",searchTerm="",muniFilter="",activeClcId=null,currentPage=1;
const PAGE_SIZE=10;

function statusBadge(s){return `<span class="badge ${s}">${s==='active'?'Active':'Inactive'}</span>`}
function clcCode(c){return `CLC-2026-${String(c.id).padStart(3,'0')}`}
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

function renderKPIs(){
  document.getElementById('kpiTotal').textContent=clcs.length;
  document.getElementById('kpiActive').textContent=clcs.filter(c=>c.status==='active').length;
  document.getElementById('kpiArchived').textContent=clcs.filter(c=>c.status==='archived').length;
}

function renderTable(){
  const tbody=document.getElementById('tbody');
  let rows=clcs.filter(c=>activeFilter==='all'||c.status===activeFilter);
  if(muniFilter) rows=rows.filter(c=>c.muni===muniFilter);
  if(searchTerm) rows=rows.filter(c=>c.name.toLowerCase().includes(searchTerm)||c.muni.toLowerCase().includes(searchTerm));
  const totalFiltered=rows.length;
  const totalPages=Math.max(1,Math.ceil(totalFiltered/PAGE_SIZE));
  if(currentPage>totalPages) currentPage=totalPages;
  const pageRows=rows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  if(!totalFiltered){
    const filtered=searchTerm||muniFilter||activeFilter!=='all';
    tbody.innerHTML=`<tr class="empty-row"><td colspan="5"><div class="empty-state">
      <div class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></div>
      <div class="empty-title">No CLCs found</div>
      <div class="empty-desc">${filtered?"We couldn't find any CLCs matching your current filters. Try adjusting your search.":'No Community Learning Centers have been added yet.'}</div>
      ${filtered?'<button class="btn primary" onclick="clearClcFilters()">Clear filters</button>':'<button class="btn primary" onclick="openAddClcModal()">+ Add new CLC</button>'}
    </div></td></tr>`;
    renderPagination('clcPagination',0,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
    return;
  }
  tbody.innerHTML=pageRows.map(c=>{
    let actions=c.status==='active'
      ? `<button class="btn" onclick="openEditClc(${c.id})">Edit</button><button class="btn danger" onclick="openArchive(${c.id})">Archive</button>`
      : `<button class="btn" onclick="openEditClc(${c.id})">Edit</button><button class="btn primary" onclick="openRestore(${c.id})">Restore</button>`;
    const archivedMeta=c.status==='archived'&&c.archivedDate?`<div class="archived-meta">Archived ${c.archivedDate}${c.archivedBy?' · '+c.archivedBy:''}</div>`:'';
    return `<tr>
      <td><div class="clcname">${c.name}</div><div class="addr">ID: ${clcCode(c)}</div></td>
      <td>${c.muni}</td>
      <td>${c.teachers.length}</td>
      <td>${statusBadge(c.status)}${archivedMeta}</td>
      <td><div class="rowActions">${actions}</div></td>
    </tr>`;
  }).join('');
  renderPagination('clcPagination',totalFiltered,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
}
function clearClcFilters(){
  searchTerm=''; muniFilter=''; document.getElementById('searchInput').value=''; muniFilterSelect.value='';
  currentPage=1;
  setFilter('all');
}

function setFilter(f){
  activeFilter=f;
  currentPage=1;
  document.querySelectorAll('.kpi[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));
  renderTable();
}
document.querySelectorAll('.kpi[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
document.getElementById('searchInput').addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();currentPage=1;renderTable()});

const muniFilterSelect=document.getElementById('muniFilterSelect');
function refreshMuniFilterOptions(){
  const current=muniFilterSelect.value;
  muniFilterSelect.innerHTML='<option value="">All Municipalities</option>'+[...new Set(clcs.map(c=>c.muni))].sort().map(m=>`<option ${m===current?'selected':''}>${m}</option>`).join('');
}
muniFilterSelect.addEventListener('change',()=>{muniFilter=muniFilterSelect.value;currentPage=1;renderTable()});


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

const muniSelect=document.getElementById('new-clc-muni');
const brgyInput=document.getElementById('new-clc-brgy');
let editingClcId=null;

// Every Division II municipality is offered up front, not just the ones
// that already have a CLC on record -- otherwise the first CLC in a
// municipality could only ever be added via a manual "new municipality" entry.
const DIVISION_II_MUNI_NAMES=DIVISION_II_MUNICIPALITIES.map(m=>m.name).sort();

function openAddClcModal(){
  editingClcId=null;
  document.getElementById('clc-modal-title').textContent='Add New CLC';
  document.getElementById('clc-modal-sub').textContent="Register a new Community Learning Center to the system.";
  document.getElementById('addClcSaveBtn').textContent='Add CLC';
  document.getElementById('new-clc-name').value='';
  document.getElementById('new-clc-street').value='';
  muniSelect.innerHTML='<option value="">Select Municipality</option>'+DIVISION_II_MUNI_NAMES.map(m=>`<option>${m}</option>`).join('');
  brgyInput.value='';
  document.getElementById('clc-quick-actions').style.display='none';
  openModal('modal-add-clc');
}
function openEditClc(id){
  editingClcId=id;
  const c=clcs.find(x=>x.id===id);
  document.getElementById('clc-modal-title').textContent='Edit CLC';
  document.getElementById('clc-modal-sub').textContent="Update this Community Learning Center's details.";
  document.getElementById('addClcSaveBtn').textContent='Save changes';
  document.getElementById('new-clc-name').value=c.name;
  document.getElementById('new-clc-street').value='';
  // Union with the CLC's current municipality in case it's a legacy record
  // registered outside Division II, so editing it doesn't silently drop it.
  const munis=[...new Set([...DIVISION_II_MUNI_NAMES,c.muni])].sort();
  muniSelect.innerHTML=munis.map(m=>`<option ${m===c.muni?'selected':''}>${m}</option>`).join('');
  brgyInput.value=c.barangay||'';
  const qaBtn=document.getElementById('qa-assign-btn');
  const qaCount=document.getElementById('qa-teacher-count');
  document.getElementById('clc-quick-actions').style.display='flex';
  if(c.status==='archived'){
    qaCount.textContent=`${c.teachers.length} ${c.teachers.length===1?'teacher':'teachers'} assigned · restore this CLC to make changes`;
    qaBtn.disabled=true;
  }else{
    qaCount.textContent=`${c.teachers.length} ${c.teachers.length===1?'teacher':'teachers'} assigned`;
    qaBtn.disabled=false;
  }
  openModal('modal-add-clc');
}
document.getElementById('addClcBtn').addEventListener('click',openAddClcModal);
document.getElementById('qa-assign-btn').addEventListener('click',()=>{
  if(!editingClcId) return;
  closeModal('modal-add-clc');
  openAssign(editingClcId);
});
document.getElementById('addClcSaveBtn').addEventListener('click',async()=>{
  const name=document.getElementById('new-clc-name').value.trim();
  const muni=muniSelect.value;
  const barangay=brgyInput.value.trim();
  const street=document.getElementById('new-clc-street').value.trim();
  if(!name||!muni||!barangay){ showToast('Please fill in CLC name, municipality, and barangay'); return; }
  const address=`${street?street+', ':''}Brgy. ${barangay}, ${muni}`;
  const btn=document.getElementById('addClcSaveBtn');
  const originalText=btn.textContent;
  btn.disabled=true; btn.textContent='Saving…';
  try{
    if(editingClcId){
      await API.updateAdminClc(editingClcId,{name,municipality:muni,barangay,address});
      showToast(`${name} updated`);
    }else{
      await API.createAdminClc({name,municipality:muni,barangay,address});
      showToast(`${name} added`);
    }
    await loadClcs();
    refreshMuniFilterOptions();
    closeModal('modal-add-clc'); renderKPIs(); renderTable();
  }catch(error){
    console.error('[AdminClcManagement] Save CLC failed',error);
    showToast(error?.data?.message||'Unable to save this CLC.');
  }finally{
    btn.disabled=false; btn.textContent=originalText;
  }
});

let assignDraft=[];
function renderAssignUI(){
  const select=document.getElementById('as-teacher-select');
  const available=allTeachers.filter(t=>!assignDraft.includes(t.name));
  select.innerHTML='<option value="">Choose an active teacher…</option>'+available.map(t=>`<option>${t.name}</option>`).join('');
  const list=document.getElementById('assign-current');
  if(!assignDraft.length){ list.innerHTML='<div class="empty-note">No teachers assigned yet.</div>'; return; }
  list.innerHTML=assignDraft.map(name=>`<div class="arow"><span class="an">${name}<span class="astatus">Active</span></span><button class="remove-link" data-name="${name}">Remove</button></div>`).join('');
  list.querySelectorAll('.remove-link').forEach(btn=>btn.addEventListener('click',()=>{
    assignDraft=assignDraft.filter(n=>n!==btn.dataset.name); renderAssignUI();
  }));
}
document.getElementById('as-add-btn').addEventListener('click',()=>{
  const sel=document.getElementById('as-teacher-select');
  if(sel.value){ assignDraft.push(sel.value); renderAssignUI(); }
});
function openAssign(id){
  activeClcId=id; const c=clcs.find(x=>x.id===id);
  document.getElementById('as-clc-name').innerHTML=`<b>${c.name}</b> · ${c.muni} Municipality · ${c.teachers.length} currently assigned`;
  assignDraft=[...c.teachers];
  renderAssignUI();
  openModal('modal-assign');
}
document.getElementById('as-save-btn').addEventListener('click',async()=>{
  const c=clcs.find(x=>x.id===activeClcId);
  const teacherIds=assignDraft
    .map(name=>{
      const match=allTeachers.find(t=>t.name===name);
      return match?match.id:null;
    })
    .filter(id=>id!=null);
  const btn=document.getElementById('as-save-btn');
  const originalText=btn.textContent;
  btn.disabled=true; btn.textContent='Saving…';
  try{
    await API.assignClcTeachers(activeClcId,teacherIds);
    await loadClcs();
    closeModal('modal-assign'); renderKPIs(); renderTable(); showToast('Teacher assignments updated');
  }catch(error){
    console.error('[AdminClcManagement] Assign teachers failed',error);
    showToast(error?.data?.message||'Unable to update teacher assignments.');
  }finally{
    btn.disabled=false; btn.textContent=originalText;
  }
});

function openArchive(id){
  activeClcId=id; const c=clcs.find(x=>x.id===id);
  document.getElementById('ar-name').textContent=c.name;
  document.getElementById('ar-info-name').textContent=c.name;
  document.getElementById('ar-info-muni').textContent=c.muni;
  document.getElementById('ar-info-teachers').textContent=c.teachers.length+(c.teachers.length===1?' teacher':' teachers');
  document.getElementById('ar-info-learners').textContent=c.learners+' learners';
  let msg="This Community Learning Center will become inactive and can no longer be assigned to teachers. Existing learner records will remain in the system.";
  if(c.teachers.length>0) msg+=" This CLC still has assigned teachers. Review the assignments before archiving.";
  document.getElementById('ar-warning').textContent=msg;
  openModal('modal-archive');
}
document.getElementById('ar-confirm-btn').addEventListener('click',async()=>{
  const c=clcs.find(x=>x.id===activeClcId);
  const btn=document.getElementById('ar-confirm-btn');
  const originalText=btn.textContent;
  btn.disabled=true; btn.textContent='Archiving…';
  try{
    await API.archiveAdminClc(activeClcId);
    await loadClcs();
    closeModal('modal-archive'); renderKPIs(); renderTable(); showToast(`${c.name} archived`);
  }catch(error){
    console.error('[AdminClcManagement] Archive failed',error);
    showToast(error?.data?.message||'Unable to archive this CLC.');
  }finally{
    btn.disabled=false; btn.textContent=originalText;
  }
});

function openRestore(id){
  activeClcId=id; const c=clcs.find(x=>x.id===id);
  document.getElementById('rs-name').textContent=c.name;
  document.getElementById('rs-info-name').textContent=c.name;
  document.getElementById('rs-info-muni').textContent=c.muni;
  document.getElementById('rs-info-date').textContent=c.archivedDate||'—';
  openModal('modal-restore');
}
document.getElementById('rs-confirm-btn').addEventListener('click',async()=>{
  const c=clcs.find(x=>x.id===activeClcId);
  const btn=document.getElementById('rs-confirm-btn');
  const originalText=btn.textContent;
  btn.disabled=true; btn.textContent='Restoring…';
  try{
    await API.restoreAdminClc(activeClcId);
    await loadClcs();
    closeModal('modal-restore'); renderKPIs(); renderTable(); showToast(`${c.name} restored`);
  }catch(error){
    console.error('[AdminClcManagement] Restore failed',error);
    showToast(error?.data?.message||'Unable to restore this CLC.');
  }finally{
    btn.disabled=false; btn.textContent=originalText;
  }
});

(async function init(){
  await Promise.all([loadClcs(),loadTeachers()]);
  refreshMuniFilterOptions();
  renderKPIs(); renderTable();
})();


document.querySelectorAll('.select-wrap select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.select-wrap').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.select-wrap').classList.remove('open'));});
