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
    const allowedMunicipalities=new Set(DIVISION_II_MUNICIPALITIES.map(m=>m.name.toLowerCase()));
    clcs=(response.data||[])
      .filter(c=>allowedMunicipalities.has(String(c.municipality||'').toLowerCase()))
      .map(fromApiShape);
  }catch(error){
    console.error('[AdminClcManagement] Unable to load CLCs',error);
    showToast('Unable to load Community Learning Centers.','error');
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

const ST_REDUCE_MOTION=matchMedia('(prefers-reduced-motion: reduce)').matches;

// Counts a [data-countup] element up from its previous value to `value`
// over ~800ms (ease-out-cubic), mirroring the dashboard/registry pattern.
function countTo(el,value){
  Utils.countTo(el, value);
}

function replay(el){
  if(!el) return;
  el.classList.remove('is-inview');
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('is-inview')));
}

function statusBadge(s){return `<span class="st-pill st-pill--status st-pill--${s}">${s==='active'?'Active':'Inactive'}</span>`}
function clcCode(c){return `CLC-2026-${String(c.id).padStart(3,'0')}`}
const renderPagination=(...args)=>Utils.renderPagination(...args);

function pct(part,total){ return total?Math.round((part/total)*100):0; }

function renderKPIs(){
  const total=clcs.length;
  const activeCount=clcs.filter(c=>c.status==='active').length;
  const archivedCount=clcs.filter(c=>c.status==='archived').length;

  countTo(document.getElementById('kpiTotal'),total);
  countTo(document.getElementById('kpiActive'),activeCount);
  countTo(document.getElementById('kpiArchived'),archivedCount);

  document.getElementById('kpiActivePct').textContent=total?`${pct(activeCount,total)}% of CLCs`:'';
  document.getElementById('kpiArchivedPct').textContent=total?`${pct(archivedCount,total)}% of CLCs`:'';

  document.getElementById('stripActive').style.flexGrow=Math.max(activeCount,total?0:1);
  document.getElementById('stripOff').style.flexGrow=Math.max(archivedCount,total?0:1);
  document.getElementById('admStrip').setAttribute('aria-label',`${activeCount} active, ${archivedCount} inactive`);

  // Keeps the header toggle's "(N)" archived count in sync with every KPI
  // refresh (load, archive, restore), not just explicit view switches.
  renderViewChrome();

  replay(document.querySelector('.st-panel[data-animate]'));
}

// Updates the parts of the page that depend on whether the archived view
// (toggled via clcViewToggleBtn, or by clicking the "Inactive" KPI chip --
// both drive the same `activeFilter` state) is showing: the table title and
// the toggle button's own icon/label -- same pattern as Manage Modules'/
// Student Registry's view-toggle chrome.
function renderViewChrome(){
  const isArchivedView=activeFilter==='archived';
  const archivedCount=clcs.filter(c=>c.status==='archived').length;

  const title=document.getElementById('clcTableTitle');
  if(title) title.textContent=isArchivedView?'Archived Community Learning Centers':'Community Learning Centers';

  const icon=document.getElementById('clcViewToggleIcon');
  if(icon) icon.textContent=isArchivedView?'unarchive':'archive';

  const label=document.getElementById('clcViewToggleLabel');
  if(label) label.textContent=isArchivedView?'View active':`View archived${archivedCount?` (${archivedCount})`:''}`;
}
document.getElementById('clcViewToggleBtn').addEventListener('click',()=>{
  setFilter(activeFilter==='archived'?'active':'archived');
});

function renderTable(){
  const tbody=document.getElementById('tbody');
  let rows=clcs.filter(c=>activeFilter==='all'||c.status===activeFilter);
  if(muniFilter) rows=rows.filter(c=>c.muni===muniFilter);
  if(searchTerm) rows=rows.filter(c=>c.name.toLowerCase().includes(searchTerm)||c.muni.toLowerCase().includes(searchTerm));
  const totalFiltered=rows.length;
  const totalPages=Math.max(1,Math.ceil(totalFiltered/PAGE_SIZE));
  if(currentPage>totalPages) currentPage=totalPages;
  const pageRows=rows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const countEl=document.querySelector('[data-clc-count]');
  if(countEl) countEl.textContent=`${clcs.length} CLC${clcs.length===1?'':'s'}`;
  if(!totalFiltered){
    const isArchivedView=activeFilter==='archived';
    const filtered=searchTerm||muniFilter||(!isArchivedView&&activeFilter!=='all');
    const icon=isArchivedView?'inventory_2':'search_off';
    const title=isArchivedView?'No archived CLCs':'No CLCs found';
    const desc=isArchivedView
      ?(filtered?"We couldn't find any archived CLCs matching your current filters. Try adjusting your search.":'No Community Learning Centers have been archived yet.')
      :(filtered?"We couldn't find any CLCs matching your current filters. Try adjusting your search.":'No Community Learning Centers have been added yet.');
    const action=filtered
      ?'<button class="st-btn st-btn-primary" onclick="clearClcFilters()">Clear filters</button>'
      :(isArchivedView?'':'<button class="st-btn st-btn-primary" onclick="openAddClcModal()"><span class="material-symbols-outlined">add_business</span>Add new CLC</button>');
    tbody.innerHTML=`<tr><td colspan="5"><div class="empty-state">
      <div class="empty-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <div class="empty-title">${title}</div>
      <div class="empty-desc">${desc}</div>
      ${action}
    </div></td></tr>`;
    renderPagination('clcPagination',0,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
    return;
  }
  tbody.innerHTML=pageRows.map((c,i)=>{
    let actions=c.status==='active'
      ? `<button class="st-btn st-btn-outline st-btn-xs" onclick="openEditClc(${c.id})">Edit</button><button class="st-btn st-btn-danger-outline st-btn-xs" onclick="openArchive(${c.id})">Archive</button>`
      : `<button class="st-btn st-btn-outline st-btn-xs" onclick="openEditClc(${c.id})">Edit</button><button class="st-btn st-btn-primary st-btn-xs" onclick="openRestore(${c.id})">Restore</button><button class="st-btn st-btn-danger-outline st-btn-xs" onclick="openDeleteClc(${c.id})">Delete</button>`;
    const archivedMeta=c.status==='archived'&&c.archivedDate?`<span class="archived-meta">Archived ${c.archivedDate}${c.archivedBy?' · '+c.archivedBy:''}</span>`:'';
    return `<tr style="--i:${i}">
      <td data-col="learner"><div class="st-clc-cell${c.status==='archived'?' is-archived':''}"><span class="st-clc-tile"><span class="material-symbols-outlined">hub</span></span><div><div class="clcname">${c.name}</div><div class="addr">ID: ${clcCode(c)}</div></div></div></td>
      <td data-col="level">${c.muni}</td>
      <td data-col="meta"><span class="st-teacher-count${c.teachers.length?'':' is-zero'}"><span class="material-symbols-outlined">person</span>${c.teachers.length?c.teachers.length+' teacher'+(c.teachers.length===1?'':'s'):'Unassigned'}</span></td>
      <td data-col="status">${statusBadge(c.status)}${archivedMeta}</td>
      <td data-col="actions" class="is-right"><div class="st-row-actions">${actions}</div></td>
    </tr>`;
  }).join('');
  renderPagination('clcPagination',totalFiltered,currentPage,PAGE_SIZE,p=>{currentPage=p;renderTable()});
  replay(tbody);
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
  renderViewChrome();
  renderTable();
}
document.querySelectorAll('.kpi[data-filter]').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
document.getElementById('searchInput').addEventListener('input',e=>{searchTerm=e.target.value.trim().toLowerCase();currentPage=1;renderTable()});

const muniFilterSelect=document.getElementById('muniFilterSelect');
function refreshMuniFilterOptions(){
  const current=muniFilterSelect.value;
  muniFilterSelect.innerHTML='<option value="">All municipalities</option>'+[...new Set(clcs.map(c=>c.muni))].sort().map(m=>`<option ${m===current?'selected':''}>${m}</option>`).join('');
}
muniFilterSelect.addEventListener('change',()=>{muniFilter=muniFilterSelect.value;currentPage=1;renderTable()});


function showToast(msg,type='success'){
  Utils.toast(msg,type);
}
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('show')}));

const muniSelect=document.getElementById('new-clc-muni');
const brgySelect=document.getElementById('new-clc-brgy');
let editingClcId=null;

// Fill the Barangay dropdown with the selected municipality's barangays.
// `current` is kept as an option even when it isn't in the list (legacy
// free-text records), so editing such a CLC doesn't silently drop it.
function populateBarangays(muni,current=''){
  if(!muni){
    brgySelect.innerHTML='<option value="">Select Municipality first</option>';
    brgySelect.disabled=true;
    return;
  }
  const list=getDivisionIIBarangays(muni);
  const names=current&&!list.includes(current)?[...list,current].sort():list;
  brgySelect.innerHTML='<option value="">Select Barangay</option>'+names.map(b=>`<option ${b===current?'selected':''}>${b}</option>`).join('');
  brgySelect.disabled=false;
}
muniSelect.addEventListener('change',()=>populateBarangays(muniSelect.value));

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
  populateBarangays('');
  document.getElementById('clc-quick-actions').hidden=true;
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
  populateBarangays(c.muni,c.barangay||'');
  const qaBtn=document.getElementById('qa-assign-btn');
  const qaCount=document.getElementById('qa-teacher-count');
  document.getElementById('clc-quick-actions').hidden=false;
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
  const barangay=brgySelect.value;
  const street=document.getElementById('new-clc-street').value.trim();
  if(!name||!muni||!barangay){ showToast('Please fill in CLC name, municipality, and barangay','warning'); return; }
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
    showToast(error?.data?.message||'Unable to save this CLC.','error');
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
    showToast(error?.data?.message||'Unable to update teacher assignments.','error');
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
    showToast(error?.data?.message||'Unable to archive this CLC.','error');
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
    showToast(error?.data?.message||'Unable to restore this CLC.','error');
  }finally{
    btn.disabled=false; btn.textContent=originalText;
  }
});

// Permanent delete -- archived CLCs only. The server refuses (and explains
// why) if any class with learner records was ever created under the CLC.
function openDeleteClc(id){
  activeClcId=id; const c=clcs.find(x=>x.id===id);
  document.getElementById('dl-name').textContent=c.name;
  document.getElementById('dl-info-name').textContent=c.name;
  document.getElementById('dl-info-muni').textContent=c.muni;
  document.getElementById('dl-info-date').textContent=c.archivedDate||'—';
  openModal('modal-delete-clc');
}
document.getElementById('dl-confirm-btn').addEventListener('click',async()=>{
  const c=clcs.find(x=>x.id===activeClcId);
  const btn=document.getElementById('dl-confirm-btn');
  const originalText=btn.textContent;
  btn.disabled=true; btn.textContent='Deleting…';
  try{
    await API.deleteAdminClc(activeClcId);
    await loadClcs();
    closeModal('modal-delete-clc'); renderKPIs(); renderTable(); showToast(`${c.name} was deleted`);
  }catch(error){
    console.error('[AdminClcManagement] Delete failed',error);
    closeModal('modal-delete-clc');
    showToast(error?.data?.message||'We could not delete this CLC. Please try again.','error');
  }finally{
    btn.disabled=false; btn.textContent=originalText;
  }
});

(async function init(){
  await Promise.all([loadClcs(),loadTeachers()]);
  refreshMuniFilterOptions();
  renderKPIs(); renderTable();
})();
