// Must run first, before anything else on this page executes.
Guards.admin();

function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('show')}));

// Notifications toggle + Accessibility font-size slider: shared with the
// teacher System Settings page (see assets/js/core/settings-prefs.js).
SettingsPrefs.bind();
SettingsPrefs.load();

(function playEntrance(){
  const REDUCE=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start=()=>{
    document.querySelectorAll('[data-animate-cards]').forEach(group=>{
      if(REDUCE){ group.classList.add('is-inview'); return; }
      requestAnimationFrame(()=>requestAnimationFrame(()=>group.classList.add('is-inview')));
    });
  };
  document.addEventListener('components:loaded',start);
  document.addEventListener('DOMContentLoaded',()=>setTimeout(start,400));
})();

async function loadActiveSchoolYear(){
  try{
    const result=await API.getActiveSchoolYear();
    document.getElementById('activeSchoolYearDisplay').textContent=result.schoolYear||'—';
  }catch(error){
    console.error('[AdminSystemSettings] Unable to load active school year',error);
  }
}
loadActiveSchoolYear();

document.getElementById('openEditSchoolYearBtn').addEventListener('click',()=>{
  document.getElementById('ay-school-year').value=document.getElementById('activeSchoolYearDisplay').textContent;
  openModal('modal-academic-year');
});
document.getElementById('ay-save-btn').addEventListener('click',async()=>{
  const value=document.getElementById('ay-school-year').value.trim();
  if(!/^\d{4}-\d{4}$/.test(value)){ Utils.toast('School year must be in the format YYYY-YYYY','error'); return; }
  try{
    await API.updateActiveSchoolYear(value);
    document.getElementById('activeSchoolYearDisplay').textContent=value;
    closeModal('modal-academic-year');
    Utils.toast('Active school year updated','success');
  }catch(error){
    console.error('[AdminSystemSettings] Unable to update active school year',error);
    Utils.toast(error?.data?.message||'Unable to update the active school year.','error');
  }
});

async function loadModuleDuration(){
  try{
    const result=await API.getModuleDurationSetting();
    document.getElementById('moduleDurationDisplay').textContent=(result.defaultDurationDays||'—')+' days';
  }catch(error){
    console.error('[AdminSystemSettings] Unable to load module duration setting',error);
  }
}
loadModuleDuration();

document.getElementById('openEditModuleDurationBtn').addEventListener('click',()=>{
  document.getElementById('md-duration-days').value=parseInt(document.getElementById('moduleDurationDisplay').textContent,10)||'';
  openModal('modal-module-duration');
});
document.getElementById('md-save-btn').addEventListener('click',async()=>{
  const value=parseInt(document.getElementById('md-duration-days').value,10);
  if(!value||value<1||value>180){ Utils.toast('Enter a number of days between 1 and 180','error'); return; }
  try{
    await API.updateModuleDurationSetting(value);
    document.getElementById('moduleDurationDisplay').textContent=value+' days';
    closeModal('modal-module-duration');
    Utils.toast('Module return default updated','success');
  }catch(error){
    console.error('[AdminSystemSettings] Unable to update module duration setting',error);
    Utils.toast(error?.data?.message||'Unable to update the module return default.','error');
  }
});
