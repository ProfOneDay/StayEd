const allTeachers=[
{name:"Maria Santos",clc:"Alcala CLC 1"},{name:"Juan Dela Cruz",clc:"Asingan CLC A"},
{name:"Angelica Reyes",clc:"Binalonan CLC 2"},{name:"Ferdinand Lopez",clc:"Pozorrubio CLC 1"},
{name:"Ronaldo Mendoza",clc:"San Fabian CLC 1"},{name:"Cristina Ramos",clc:"Santa Maria CLC 2"},
{name:"Paolo Fernandez",clc:"Umingan CLC 3"},{name:"Noel Ramirez",clc:"Villasis CLC 2"},
{name:"Kristine Ocampo",clc:"Unassigned"},{name:"Allan Domingo",clc:"Unassigned"}
];

let clcs=[
{id:1,name:"Alcala I Central School CLC",muni:"Alcala",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Alcala",teachers:["Maria Santos","Juan Dela Cruz"],learners:20,status:"active"},
{id:2,name:"Buenlag Barangay Hall CLC",muni:"Alcala",barangay:"Buenlag",clcType:"Type 1A",street:"",address:"Brgy. Buenlag, Alcala",teachers:["Angelica Reyes","Mark Anthony Garcia","Rosemarie Bautista"],learners:27,status:"active"},
{id:3,name:"San Jose Elementary School CLC",muni:"Alcala",barangay:"San Jose",clcType:"Type 3B",street:"",address:"Brgy. San Jose, Alcala",teachers:["Ferdinand Lopez","Jasmine Torres","Ronaldo Mendoza","Cristina Ramos"],learners:34,status:"active"},
{id:4,name:"Asingan Central School CLC",muni:"Asingan",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Asingan",teachers:["Bryan Cruz","Kimberly Aquino","Paolo Fernandez"],learners:41,status:"active"},
{id:5,name:"Macalong Barangay Hall CLC",muni:"Asingan",barangay:"Macalong",clcType:"Type 1A",street:"",address:"Brgy. Macalong, Asingan",teachers:["Grace Villanueva","Noel Ramirez"],learners:48,status:"active"},
{id:6,name:"San Vicente Multipurpose Hall CLC",muni:"Asingan",barangay:"San Vicente",clcType:"Type 1B",street:"",address:"Brgy. San Vicente, Asingan",teachers:["Liza Fernandez","Carlo Mendez","Divina Ocampo","Renato Salazar"],learners:55,status:"active"},
{id:7,name:"Coldit National High School CLC",muni:"Asingan",barangay:"Coldit",clcType:"Type 4",street:"",address:"Brgy. Coldit, Asingan",teachers:["Emily Navarro","Arnel Castro","Josefina Del Rosario"],learners:62,status:"active"},
{id:8,name:"Binalonan I Central School CLC",muni:"Binalonan",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Binalonan",teachers:["Michael Aquino","Teresa Bautista"],learners:69,status:"active"},
{id:9,name:"Balangobong Covered Court CLC",muni:"Binalonan",barangay:"Balangobong",clcType:"Type 1B",street:"",address:"Brgy. Balangobong, Binalonan",teachers:["Vincent Domingo","Rowena Santos","Edgar Pascual"],learners:0,status:"archived",archivedDate:"Jun 18, 2026",archivedBy:"ALS Coordinator"},
{id:10,name:"Linmansangan Elementary School CLC",muni:"Binalonan",barangay:"Linmansangan",clcType:"Type 3A",street:"",address:"Brgy. Linmansangan, Binalonan",teachers:["Luzviminda Cruz","Alfredo Ramos","Corazon Villar","Danilo Ferrer"],learners:23,status:"active"},
{id:11,name:"Bonuan Gede Elementary School CLC",muni:"Dagupan City",barangay:"Bonuan Gede",clcType:"Type 3A",street:"",address:"Brgy. Bonuan Gede, Dagupan City",teachers:["Marites Gonzales","Reynaldo Tolentino","Aida Manalo"],learners:30,status:"active"},
{id:12,name:"Lucao Barangay Hall CLC",muni:"Dagupan City",barangay:"Lucao",clcType:"Type 1A",street:"",address:"Brgy. Lucao, Dagupan City",teachers:["Benjamin Soriano","Maria Santos"],learners:37,status:"active"},
{id:13,name:"Pantal Multipurpose Hall CLC",muni:"Dagupan City",barangay:"Pantal",clcType:"Type 1B",street:"",address:"Brgy. Pantal, Dagupan City",teachers:["Juan Dela Cruz","Angelica Reyes","Mark Anthony Garcia","Rosemarie Bautista"],learners:44,status:"active"},
{id:14,name:"Bonuan Boquig National High School CLC",muni:"Dagupan City",barangay:"Bonuan Boquig",clcType:"Type 4",street:"",address:"Brgy. Bonuan Boquig, Dagupan City",teachers:["Ferdinand Lopez","Jasmine Torres","Ronaldo Mendoza"],learners:51,status:"active"},
{id:15,name:"Mangaldan Central School CLC",muni:"Mangaldan",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Mangaldan",teachers:["Cristina Ramos","Bryan Cruz"],learners:58,status:"active"},
{id:16,name:"Guiguilonen Basketball Court CLC",muni:"Mangaldan",barangay:"Guiguilonen",clcType:"Type 1B",street:"",address:"Brgy. Guiguilonen, Mangaldan",teachers:["Kimberly Aquino","Paolo Fernandez","Grace Villanueva"],learners:65,status:"active"},
{id:17,name:"Embarcadero Chapel CLC",muni:"Mangaldan",barangay:"Embarcadero",clcType:"Type 1B",street:"",address:"Brgy. Embarcadero, Mangaldan",teachers:["Noel Ramirez","Liza Fernandez","Carlo Mendez","Divina Ocampo"],learners:0,status:"archived",archivedDate:"May 02, 2026",archivedBy:"ALS Coordinator"},
{id:18,name:"Pozorrubio I Central School CLC",muni:"Pozorrubio",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Pozorrubio",teachers:["Renato Salazar","Emily Navarro","Arnel Castro"],learners:79,status:"active"},
{id:19,name:"Cabaruan Barangay Hall CLC",muni:"Pozorrubio",barangay:"Cabaruan",clcType:"Type 1A",street:"",address:"Brgy. Cabaruan, Pozorrubio",teachers:["Josefina Del Rosario","Michael Aquino"],learners:26,status:"active"},
{id:20,name:"Nancamaliran East Elementary School CLC",muni:"Pozorrubio",barangay:"Nancamaliran East",clcType:"Type 3B",street:"",address:"Brgy. Nancamaliran East, Pozorrubio",teachers:["Teresa Bautista","Vincent Domingo","Rowena Santos","Edgar Pascual"],learners:33,status:"active"},
{id:21,name:"San Nicolas Multipurpose Hall CLC",muni:"Pozorrubio",barangay:"San Nicolas",clcType:"Type 1B",street:"",address:"Brgy. San Nicolas, Pozorrubio",teachers:["Luzviminda Cruz","Alfredo Ramos","Corazon Villar"],learners:40,status:"active"},
{id:22,name:"Rosales Central School CLC",muni:"Rosales",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Rosales",teachers:["Danilo Ferrer","Marites Gonzales"],learners:47,status:"active"},
{id:23,name:"Carmen East Barangay Hall CLC",muni:"Rosales",barangay:"Carmen East",clcType:"Type 1A",street:"",address:"Brgy. Carmen East, Rosales",teachers:["Reynaldo Tolentino","Aida Manalo","Benjamin Soriano"],learners:54,status:"active"},
{id:24,name:"San Bartolome Basketball Court CLC",muni:"Rosales",barangay:"San Bartolome",clcType:"Type 1B",street:"",address:"Brgy. San Bartolome, Rosales",teachers:["Maria Santos","Juan Dela Cruz","Angelica Reyes","Mark Anthony Garcia"],learners:61,status:"active"},
{id:25,name:"San Fabian I Central School CLC",muni:"San Fabian",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, San Fabian",teachers:["Rosemarie Bautista","Ferdinand Lopez","Jasmine Torres"],learners:68,status:"active"},
{id:26,name:"Alacan Elementary School CLC",muni:"San Fabian",barangay:"Alacan",clcType:"Type 3A",street:"",address:"Brgy. Alacan, San Fabian",teachers:["Ronaldo Mendoza","Cristina Ramos"],learners:75,status:"active"},
{id:27,name:"Longos Covered Court CLC",muni:"San Fabian",barangay:"Longos",clcType:"Type 1B",street:"",address:"Brgy. Longos, San Fabian",teachers:["Bryan Cruz","Kimberly Aquino","Paolo Fernandez","Grace Villanueva"],learners:22,status:"active"},
{id:28,name:"Santa Maria Central School CLC",muni:"Santa Maria",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Santa Maria",teachers:["Noel Ramirez","Liza Fernandez","Carlo Mendez"],learners:29,status:"active"},
{id:29,name:"Bantog Barangay Hall CLC",muni:"Santa Maria",barangay:"Bantog",clcType:"Type 1A",street:"",address:"Brgy. Bantog, Santa Maria",teachers:["Divina Ocampo","Renato Salazar"],learners:36,status:"active"},
{id:30,name:"Turac Multipurpose Hall CLC",muni:"Santa Maria",barangay:"Turac",clcType:"Type 1B",street:"",address:"Brgy. Turac, Santa Maria",teachers:["Emily Navarro","Arnel Castro","Josefina Del Rosario"],learners:43,status:"active"},
{id:31,name:"Sison I Central School CLC",muni:"Sison",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Sison",teachers:["Michael Aquino","Teresa Bautista","Vincent Domingo","Rowena Santos"],learners:50,status:"active"},
{id:32,name:"Cariay Basketball Court CLC",muni:"Sison",barangay:"Cariay",clcType:"Type 1B",street:"",address:"Brgy. Cariay, Sison",teachers:["Edgar Pascual","Luzviminda Cruz","Alfredo Ramos"],learners:0,status:"archived",archivedDate:"Mar 27, 2026",archivedBy:"ALS Coordinator"},
{id:33,name:"Immalog Elementary School CLC",muni:"Sison",barangay:"Immalog",clcType:"Type 3B",street:"",address:"Brgy. Immalog, Sison",teachers:["Corazon Villar","Danilo Ferrer"],learners:64,status:"active"},
{id:34,name:"Tayug Central School CLC",muni:"Tayug",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Tayug",teachers:["Marites Gonzales","Reynaldo Tolentino","Aida Manalo","Benjamin Soriano"],learners:71,status:"active"},
{id:35,name:"Bantog Barangay Hall CLC",muni:"Tayug",barangay:"Bantog",clcType:"Type 1A",street:"",address:"Brgy. Bantog, Tayug",teachers:["Maria Santos","Juan Dela Cruz","Angelica Reyes"],learners:78,status:"active"},
{id:36,name:"Carriedo Multipurpose Hall CLC",muni:"Tayug",barangay:"Carriedo",clcType:"Type 1B",street:"",address:"Brgy. Carriedo, Tayug",teachers:["Mark Anthony Garcia","Rosemarie Bautista"],learners:25,status:"active"},
{id:37,name:"Umingan I Central School CLC",muni:"Umingan",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Umingan",teachers:["Ferdinand Lopez","Jasmine Torres","Ronaldo Mendoza"],learners:32,status:"active"},
{id:38,name:"Cablong Barangay Hall CLC",muni:"Umingan",barangay:"Cablong",clcType:"Type 1A",street:"",address:"Brgy. Cablong, Umingan",teachers:["Cristina Ramos","Bryan Cruz","Kimberly Aquino","Paolo Fernandez"],learners:39,status:"active"},
{id:39,name:"Cayanga Elementary School CLC",muni:"Umingan",barangay:"Cayanga",clcType:"Type 3A",street:"",address:"Brgy. Cayanga, Umingan",teachers:["Grace Villanueva","Noel Ramirez","Liza Fernandez"],learners:46,status:"active"},
{id:40,name:"Urdaneta City Central School CLC",muni:"Urdaneta City",barangay:"Poblacion",clcType:"Type 5",street:"",address:"Brgy. Poblacion, Urdaneta City",teachers:["Carlo Mendez","Divina Ocampo"],learners:53,status:"active"},
{id:41,name:"Nancayasan National High School CLC",muni:"Urdaneta City",barangay:"Nancayasan",clcType:"Type 4",street:"",address:"Brgy. Nancayasan, Urdaneta City",teachers:["Renato Salazar","Emily Navarro","Arnel Castro","Josefina Del Rosario"],learners:60,status:"active"},
{id:42,name:"Bactad East Barangay Hall CLC",muni:"Urdaneta City",barangay:"Bactad East",clcType:"Type 1A",street:"",address:"Brgy. Bactad East, Urdaneta City",teachers:["Michael Aquino","Teresa Bautista","Vincent Domingo"],learners:67,status:"active"},
{id:43,name:"Villasis I Central School CLC",muni:"Villasis",barangay:"Poblacion",clcType:"Type 4",street:"",address:"Brgy. Poblacion, Villasis",teachers:["Rowena Santos","Edgar Pascual"],learners:74,status:"active"},
{id:44,name:"Basketball Court Sitio Dos CLC",muni:"Villasis",barangay:"Bacnono",clcType:"Type 1B",street:"",address:"Brgy. Bacnono, Villasis",teachers:["Luzviminda Cruz","Alfredo Ramos","Corazon Villar"],learners:21,status:"active"},
{id:45,name:"Tocok Multipurpose Hall CLC",muni:"Villasis",barangay:"Tocok",clcType:"Type 1B",street:"",address:"Brgy. Tocok, Villasis",teachers:["Danilo Ferrer","Marites Gonzales","Reynaldo Tolentino","Aida Manalo"],learners:0,status:"archived",archivedDate:"Apr 14, 2026",archivedBy:"ALS Coordinator"}
];

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
muniFilterSelect.innerHTML='<option value="">All Municipalities</option>'+[...new Set(clcs.map(c=>c.muni))].sort().map(m=>`<option>${m}</option>`).join('');
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

// Add / Edit CLC — Municipality -> Barangay cascading selects
const barangaysByMuni={
  "Alcala":["Poblacion","San Jose","Macayo","Buenlag"],
  "Asingan":["Macalong","Poblacion","Coldit","San Vicente"],
  "Binalonan":["Poblacion","Balangobong","Linmansangan","Pasibi"],
  "Dagupan City":["Bonuan Gede","Bonuan Boquig","Lucao","Pantal"],
  "Mangaldan":["Guiguilonen","Poblacion","Embarcadero","Talogtog"],
  "Pozorrubio":["Cabaruan","Poblacion","Nancamaliran East","San Nicolas"],
  "Rosales":["Carmen East","Carmen West","Poblacion","San Bartolome"],
  "San Fabian":["Poblacion","Alacan","Longos","Sagud Bahley"],
  "Santa Maria":["Bantog","Poblacion","Nalsian Norte","Turac"],
  "Sison":["Nancamaliran","Poblacion","Cariay","Immalog"],
  "Tayug":["Poblacion","Bantog","Baracbac Este","Carriedo"],
  "Umingan":["Cablong","Poblacion","Bantog","Cayanga"],
  "Urdaneta City":["Nancayasan","Poblacion","Bactad East","Cabaruan"],
  "Villasis":["Bacnono","Poblacion","Bautista Norte","Tocok"]
};
const muniSelect=document.getElementById('new-clc-muni');
const brgySelect=document.getElementById('new-clc-brgy');
let editingClcId=null;

function populateBarangays(muni,selected){
  const list=barangaysByMuni[muni]||["Poblacion"];
  brgySelect.innerHTML='<option value="">Select Barangay</option>'+list.map(b=>`<option ${b===selected?'selected':''}>${b}</option>`).join('');
}
muniSelect.addEventListener('change',()=>populateBarangays(muniSelect.value));

function openAddClcModal(){
  editingClcId=null;
  document.getElementById('clc-modal-title').textContent='Add New CLC';
  document.getElementById('clc-modal-sub').textContent="Register a new Community Learning Center to the system.";
  document.getElementById('addClcSaveBtn').textContent='Add CLC';
  document.getElementById('new-clc-name').value='';
  document.getElementById('new-clc-street').value='';
  const munis=[...new Set(clcs.map(c=>c.muni))].sort();
  muniSelect.innerHTML='<option value="">Select Municipality</option>'+munis.map(m=>`<option>${m}</option>`).join('');
  brgySelect.innerHTML='<option value="">Select Barangay</option>';
  document.getElementById('new-clc-type').value='Type 1A';
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
  document.getElementById('new-clc-street').value=c.street||'';
  const munis=[...new Set(clcs.map(x=>x.muni))].sort();
  muniSelect.innerHTML=munis.map(m=>`<option ${m===c.muni?'selected':''}>${m}</option>`).join('');
  populateBarangays(c.muni,c.barangay);
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
  document.getElementById('new-clc-type').value=c.clcType||'Type 1A';
  openModal('modal-add-clc');
}
document.getElementById('addClcBtn').addEventListener('click',openAddClcModal);
document.getElementById('qa-assign-btn').addEventListener('click',()=>{
  if(!editingClcId) return;
  closeModal('modal-add-clc');
  openAssign(editingClcId);
});
document.getElementById('addClcSaveBtn').addEventListener('click',()=>{
  const name=document.getElementById('new-clc-name').value.trim();
  const muni=muniSelect.value;
  const barangay=brgySelect.value;
  const street=document.getElementById('new-clc-street').value.trim();
  const clcType=document.getElementById('new-clc-type').value;
  if(!name||!muni||!barangay){ showToast('Please fill in CLC name, municipality, and barangay'); return; }
  const address=`${street?street+', ':''}Brgy. ${barangay}, ${muni}`;
  if(editingClcId){
    const c=clcs.find(x=>x.id===editingClcId);
    Object.assign(c,{name,muni,barangay,street,clcType,address});
    closeModal('modal-add-clc'); renderKPIs(); renderTable();
    showToast(`${name} updated`);
  }else{
    const newId=Math.max(...clcs.map(c=>c.id))+1;
    clcs.push({id:newId,name,muni,barangay,street,clcType,address,teachers:[],learners:0,status:'active'});
    closeModal('modal-add-clc'); renderKPIs(); renderTable();
    showToast(`${name} added`);
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
document.getElementById('as-save-btn').addEventListener('click',()=>{
  const c=clcs.find(x=>x.id===activeClcId);
  c.teachers=[...assignDraft];
  closeModal('modal-assign'); renderKPIs(); renderTable(); showToast('Teacher assignments updated');
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
document.getElementById('ar-confirm-btn').addEventListener('click',()=>{
  const c=clcs.find(x=>x.id===activeClcId);
  c.status='archived';
  c.archivedDate=new Date().toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'});
  c.archivedBy='ALS Coordinator';
  closeModal('modal-archive'); renderKPIs(); renderTable(); showToast(`${c.name} archived`);
});

function openRestore(id){
  activeClcId=id; const c=clcs.find(x=>x.id===id);
  document.getElementById('rs-name').textContent=c.name;
  document.getElementById('rs-info-name').textContent=c.name;
  document.getElementById('rs-info-muni').textContent=c.muni;
  document.getElementById('rs-info-date').textContent=c.archivedDate||'—';
  openModal('modal-restore');
}
document.getElementById('rs-confirm-btn').addEventListener('click',()=>{
  const c=clcs.find(x=>x.id===activeClcId); c.status='active';
  closeModal('modal-restore'); renderKPIs(); renderTable(); showToast(`${c.name} restored`);
});

const menuBtn=document.getElementById('menuBtn');
const asideEl=document.querySelector('aside');
menuBtn.addEventListener('click',()=>{const open=asideEl.classList.toggle('open');menuBtn.setAttribute('aria-expanded',open?'true':'false')});
document.addEventListener('click',e=>{if(asideEl.classList.contains('open')&&!asideEl.contains(e.target)&&e.target!==menuBtn){asideEl.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')}});

renderKPIs(); renderTable();

document.getElementById('sidebarLogoutBtn').addEventListener('click',e=>{e.preventDefault();openModal('modal-logout')});
document.getElementById('logout-confirm-btn').addEventListener('click',()=>{closeModal('modal-logout');showToast('Signed out — redirecting to login…')});

document.querySelectorAll('.select-wrap select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.select-wrap').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.select-wrap').classList.remove('open'));});
