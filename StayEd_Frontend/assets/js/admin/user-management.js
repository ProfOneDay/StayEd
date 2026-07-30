const clcOptions=["Alcala I Central School CLC","Buenlag Barangay Hall CLC","San Jose Elementary School CLC","Asingan Central School CLC","Macalong Barangay Hall CLC","San Vicente Multipurpose Hall CLC","Coldit National High School CLC","Binalonan I Central School CLC","Balangobong Covered Court CLC","Linmansangan Elementary School CLC","Bonuan Gede Elementary School CLC","Lucao Barangay Hall CLC","Pantal Multipurpose Hall CLC","Bonuan Boquig National High School CLC","Mangaldan Central School CLC","Guiguilonen Basketball Court CLC","Embarcadero Chapel CLC","Pozorrubio I Central School CLC","Cabaruan Barangay Hall CLC","Nancamaliran East Elementary School CLC","San Nicolas Multipurpose Hall CLC","Rosales Central School CLC","Carmen East Barangay Hall CLC","San Bartolome Basketball Court CLC","San Fabian I Central School CLC","Alacan Elementary School CLC","Longos Covered Court CLC","Santa Maria Central School CLC","Bantog Barangay Hall CLC","Turac Multipurpose Hall CLC","Sison I Central School CLC","Cariay Basketball Court CLC","Immalog Elementary School CLC","Tayug Central School CLC","Bantog Barangay Hall CLC","Carriedo Multipurpose Hall CLC","Umingan I Central School CLC","Cablong Barangay Hall CLC","Cayanga Elementary School CLC","Urdaneta City Central School CLC","Nancayasan National High School CLC","Bactad East Barangay Hall CLC","Villasis I Central School CLC","Basketball Court Sitio Dos CLC","Tocok Multipurpose Hall CLC"];
const clcMunicipality={"Alcala I Central School CLC":"Alcala","Buenlag Barangay Hall CLC":"Alcala","San Jose Elementary School CLC":"Alcala","Asingan Central School CLC":"Asingan","Macalong Barangay Hall CLC":"Asingan","San Vicente Multipurpose Hall CLC":"Asingan","Coldit National High School CLC":"Asingan","Binalonan I Central School CLC":"Binalonan","Balangobong Covered Court CLC":"Binalonan","Linmansangan Elementary School CLC":"Binalonan","Bonuan Gede Elementary School CLC":"Dagupan City","Lucao Barangay Hall CLC":"Dagupan City","Pantal Multipurpose Hall CLC":"Dagupan City","Bonuan Boquig National High School CLC":"Dagupan City","Mangaldan Central School CLC":"Mangaldan","Guiguilonen Basketball Court CLC":"Mangaldan","Embarcadero Chapel CLC":"Mangaldan","Pozorrubio I Central School CLC":"Pozorrubio","Cabaruan Barangay Hall CLC":"Pozorrubio","Nancamaliran East Elementary School CLC":"Pozorrubio","San Nicolas Multipurpose Hall CLC":"Pozorrubio","Rosales Central School CLC":"Rosales","Carmen East Barangay Hall CLC":"Rosales","San Bartolome Basketball Court CLC":"Rosales","San Fabian I Central School CLC":"San Fabian","Alacan Elementary School CLC":"San Fabian","Longos Covered Court CLC":"San Fabian","Santa Maria Central School CLC":"Santa Maria","Bantog Barangay Hall CLC":"Tayug","Turac Multipurpose Hall CLC":"Santa Maria","Sison I Central School CLC":"Sison","Cariay Basketball Court CLC":"Sison","Immalog Elementary School CLC":"Sison","Tayug Central School CLC":"Tayug","Carriedo Multipurpose Hall CLC":"Tayug","Umingan I Central School CLC":"Umingan","Cablong Barangay Hall CLC":"Umingan","Cayanga Elementary School CLC":"Umingan","Urdaneta City Central School CLC":"Urdaneta City","Nancayasan National High School CLC":"Urdaneta City","Bactad East Barangay Hall CLC":"Urdaneta City","Villasis I Central School CLC":"Villasis","Basketball Court Sitio Dos CLC":"Villasis","Tocok Multipurpose Hall CLC":"Villasis"};
const clcsByMuni={"Alcala":["Alcala I Central School CLC","Buenlag Barangay Hall CLC","San Jose Elementary School CLC"],"Asingan":["Asingan Central School CLC","Macalong Barangay Hall CLC","San Vicente Multipurpose Hall CLC","Coldit National High School CLC"],"Binalonan":["Binalonan I Central School CLC","Balangobong Covered Court CLC","Linmansangan Elementary School CLC"],"Dagupan City":["Bonuan Gede Elementary School CLC","Lucao Barangay Hall CLC","Pantal Multipurpose Hall CLC","Bonuan Boquig National High School CLC"],"Mangaldan":["Mangaldan Central School CLC","Guiguilonen Basketball Court CLC","Embarcadero Chapel CLC"],"Pozorrubio":["Pozorrubio I Central School CLC","Cabaruan Barangay Hall CLC","Nancamaliran East Elementary School CLC","San Nicolas Multipurpose Hall CLC"],"Rosales":["Rosales Central School CLC","Carmen East Barangay Hall CLC","San Bartolome Basketball Court CLC"],"San Fabian":["San Fabian I Central School CLC","Alacan Elementary School CLC","Longos Covered Court CLC"],"Santa Maria":["Santa Maria Central School CLC","Bantog Barangay Hall CLC","Turac Multipurpose Hall CLC"],"Sison":["Sison I Central School CLC","Cariay Basketball Court CLC","Immalog Elementary School CLC"],"Tayug":["Tayug Central School CLC","Bantog Barangay Hall CLC","Carriedo Multipurpose Hall CLC"],"Umingan":["Umingan I Central School CLC","Cablong Barangay Hall CLC","Cayanga Elementary School CLC"],"Urdaneta City":["Urdaneta City Central School CLC","Nancayasan National High School CLC","Bactad East Barangay Hall CLC"],"Villasis":["Villasis I Central School CLC","Basketball Court Sitio Dos CLC","Tocok Multipurpose Hall CLC"]};

let teachers=[
{id:1,firstName:"Maria",middleName:"",lastName:"Santos",name:"Maria Santos",email:"maria.santos@deped.gov.ph",phone:"0917 200 1121",employeeId:"T-2025-1001",clc:"Alcala I Central School CLC",clcs:["Alcala I Central School CLC","Asingan Central School CLC"],municipality:"Alcala",status:"active",date:"Jan 12, 2026"},
{id:2,firstName:"Juan",middleName:"",lastName:"Dela Cruz",name:"Juan Dela Cruz",email:"juan.delacruz@deped.gov.ph",phone:"0918 334 5566",employeeId:"T-2025-1002",clc:"Asingan Central School CLC",clcs:["Asingan Central School CLC"],municipality:"Asingan",status:"pending",date:"Jul 20, 2026"},
{id:3,firstName:"Angelica",middleName:"",lastName:"Reyes",name:"Angelica Reyes",email:"angelica.reyes@deped.gov.ph",phone:"0920 112 8890",employeeId:"T-2025-1003",clc:"Binalonan I Central School CLC",clcs:["Binalonan I Central School CLC"],municipality:"Binalonan",status:"active",date:"Feb 3, 2026"},
{id:4,firstName:"Mark",middleName:"Anthony",lastName:"Garcia",name:"Mark Anthony Garcia",email:"mark.garcia@deped.gov.ph",phone:"0917 456 7812",employeeId:"T-2025-1004",clc:"Bonuan Gede Elementary School CLC",clcs:["Bonuan Gede Elementary School CLC"],municipality:"Dagupan City",status:"pending",date:"Jul 24, 2026"},
{id:5,firstName:"Rosemarie",middleName:"",lastName:"Bautista",name:"Rosemarie Bautista",email:"rosemarie.bautista@deped.gov.ph",phone:"0919 887 4432",employeeId:"T-2025-1005",clc:"Mangaldan Central School CLC",clcs:["Mangaldan Central School CLC"],municipality:"Mangaldan",status:"deactivated",date:"Nov 8, 2025"},
{id:6,firstName:"Ferdinand",middleName:"",lastName:"Lopez",name:"Ferdinand Lopez",email:"ferdinand.lopez@deped.gov.ph",phone:"0921 300 9981",employeeId:"T-2025-1006",clc:"Pozorrubio I Central School CLC",clcs:["Pozorrubio I Central School CLC"],municipality:"Pozorrubio",status:"active",date:"Mar 19, 2026"},
{id:7,firstName:"Jasmine",middleName:"",lastName:"Torres",name:"Jasmine Torres",email:"jasmine.torres@deped.gov.ph",phone:"0917 654 3210",employeeId:"T-2025-1007",clc:"Rosales Central School CLC",clcs:["Rosales Central School CLC"],municipality:"Rosales",status:"pending",date:"Jul 22, 2026"},
{id:8,firstName:"Ronaldo",middleName:"",lastName:"Mendoza",name:"Ronaldo Mendoza",email:"ronaldo.mendoza@deped.gov.ph",phone:"0918 220 6674",employeeId:"T-2025-1008",clc:"San Fabian I Central School CLC",clcs:["San Fabian I Central School CLC"],municipality:"San Fabian",status:"active",date:"Jan 29, 2026"},
{id:9,firstName:"Cristina",middleName:"",lastName:"Ramos",name:"Cristina Ramos",email:"cristina.ramos@deped.gov.ph",phone:"0920 774 1183",employeeId:"T-2025-1009",clc:"Santa Maria Central School CLC",clcs:["Santa Maria Central School CLC"],municipality:"Santa Maria",status:"active",date:"Apr 2, 2026"},
{id:10,firstName:"Bryan",middleName:"",lastName:"Cruz",name:"Bryan Cruz",email:"bryan.cruz@deped.gov.ph",phone:"0917 990 2245",employeeId:"T-2025-1010",clc:"Sison I Central School CLC",clcs:["Sison I Central School CLC"],municipality:"Sison",status:"pending",date:"Jul 25, 2026"},
{id:11,firstName:"Kimberly",middleName:"",lastName:"Aquino",name:"Kimberly Aquino",email:"kimberly.aquino@deped.gov.ph",phone:"0919 112 6630",employeeId:"T-2025-1011",clc:"Tayug Central School CLC",clcs:["Tayug Central School CLC"],municipality:"Tayug",status:"deactivated",date:"Sep 14, 2025"},
{id:12,firstName:"Paolo",middleName:"",lastName:"Fernandez",name:"Paolo Fernandez",email:"paolo.fernandez@deped.gov.ph",phone:"0921 556 8809",employeeId:"T-2025-1012",clc:"Umingan I Central School CLC",clcs:["Umingan I Central School CLC"],municipality:"Umingan",status:"active",date:"May 11, 2026"},
{id:13,firstName:"Grace",middleName:"",lastName:"Villanueva",name:"Grace Villanueva",email:"grace.villanueva@deped.gov.ph",phone:"0918 774 3321",employeeId:"T-2025-1013",clc:"Urdaneta City Central School CLC",clcs:["Urdaneta City Central School CLC"],municipality:"Urdaneta City",status:"pending",date:"Jul 26, 2026"},
{id:14,firstName:"Noel",middleName:"",lastName:"Ramirez",name:"Noel Ramirez",email:"noel.ramirez@deped.gov.ph",phone:"0917 330 1198",employeeId:"T-2025-1014",clc:"Villasis I Central School CLC",clcs:["Villasis I Central School CLC"],municipality:"Villasis",status:"active",date:"Feb 27, 2026"}
];

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
document.getElementById('ap-confirm-btn').addEventListener('click',()=>{
  const t=teachers.find(x=>x.id===activeTeacherId); t.status='active'; t.date='Today';
  closeModal('modal-approve'); renderKPIs(); renderTable(); showToast(`${t.name} approved`);
});

function openReject(id){
  activeTeacherId=id; const t=teachers.find(x=>x.id===id);
  document.getElementById('rj-name').textContent=t.name;
  document.getElementById('rj-email').textContent=t.email;
  document.querySelectorAll('input[name="reject-reason"]').forEach(r=>r.checked=false);
  document.getElementById('reject-remarks').value='';
  openModal('modal-reject');
}
document.getElementById('rj-confirm-btn').addEventListener('click',()=>{
  const t=teachers.find(x=>x.id===activeTeacherId); const name=t.name;
  teachers=teachers.filter(x=>x.id!==activeTeacherId);
  closeModal('modal-reject'); renderKPIs(); renderTable(); showToast(`${name}'s registration rejected`);
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
document.getElementById('edit-save-btn').addEventListener('click',()=>{
  const t=teachers.find(x=>x.id===activeTeacherId);
  t.firstName=document.getElementById('edit-first').value.trim()||t.firstName;
  t.middleName=document.getElementById('edit-middle').value.trim();
  t.lastName=document.getElementById('edit-last').value.trim()||t.lastName;
  t.name=[t.firstName,t.middleName,t.lastName].filter(Boolean).join(' ');
  t.employeeId=document.getElementById('edit-empid').value.trim()||t.employeeId;
  t.phone=document.getElementById('edit-phone').value.trim()||t.phone;
  t.email=document.getElementById('edit-email').value.trim()||t.email;
  t.clcs=[...editClcDraft];
  t.clc=t.clcs[0]||'';
  t.municipality=document.getElementById('edit-muni').value||t.municipality;
  closeModal('modal-edit'); renderKPIs(); renderTable(); showToast('Teacher account updated');
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
document.getElementById('rs-confirm-btn').addEventListener('click',()=>{
  closeModal('modal-reset');
  const t=teachers.find(x=>x.id===activeTeacherId);
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix=''; for(let i=0;i<4;i++)suffix+=chars[Math.floor(Math.random()*chars.length)];
  realPassword=`STAY-ED-2026-${suffix}`; passwordVisible=false;
  document.getElementById('ps-name').textContent=t.name;
  document.getElementById('temp-pass-val').textContent='••••••••••••';
  openModal('modal-reset-success');
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
document.getElementById('dc-confirm-btn').addEventListener('click',()=>{
  const t=teachers.find(x=>x.id===activeTeacherId); t.status='deactivated';
  closeModal('modal-deactivate'); renderKPIs(); renderTable(); showToast(`${t.name} deactivated`);
});
function reactivate(id){
  const t=teachers.find(x=>x.id===id); t.status='active';
  renderKPIs(); renderTable(); showToast(`${t.name} reactivated`);
}

// Create Teacher Account
const createClcSelect=document.getElementById('cr-clc');
const createMuniSelect=document.getElementById('cr-muni');
createMuniSelect.innerHTML='<option value="" disabled selected hidden>Select Municipality…</option>'+Object.keys(clcsByMuni).sort().map(m=>`<option>${m}</option>`).join('');
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
document.getElementById('cr-save-btn').addEventListener('click',()=>{
  const first=document.getElementById('cr-first').value.trim();
  const last=document.getElementById('cr-last').value.trim();
  const email=document.getElementById('cr-email').value.trim();
  if(!first||!last||!email){ showToast('Please fill in first name, last name, and email'); return; }
  const middle=document.getElementById('cr-middle').value.trim();
  const phone=document.getElementById('cr-phone').value.trim()||'—';
  const muni=createMuniSelect.value;
  const clc=createClcSelect.value;
  const newId=Math.max(...teachers.map(t=>t.id))+1;
  const employeeId=document.getElementById('cr-empid').value.trim()||`T-2026-${String(1000+newId)}`;
  teachers.push({
    id:newId, firstName:first, middleName:middle, lastName:last,
    name:[first,middle,last].filter(Boolean).join(' '),
    email, phone, employeeId, clc, clcs:clc?[clc]:[], municipality:muni||'—',
    status:'active', date:'Today'
  });
  closeModal('modal-create'); renderKPIs(); renderTable();
  showToast('Teacher account created');
});

const menuBtn=document.getElementById('menuBtn');
const asideEl=document.querySelector('aside');
menuBtn.addEventListener('click',()=>{const open=asideEl.classList.toggle('open');menuBtn.setAttribute('aria-expanded',open?'true':'false')});
document.addEventListener('click',e=>{if(asideEl.classList.contains('open')&&!asideEl.contains(e.target)&&e.target!==menuBtn){asideEl.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')}});

renderKPIs(); renderTable();

document.getElementById('sidebarLogoutBtn').addEventListener('click',e=>{e.preventDefault();openModal('modal-logout')});
document.getElementById('logout-confirm-btn').addEventListener('click',()=>{closeModal('modal-logout');showToast('Signed out — redirecting to login…')});

document.querySelectorAll('.select-wrap select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.select-wrap').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.select-wrap').classList.remove('open'));});
