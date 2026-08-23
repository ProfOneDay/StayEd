// Must run first, before anything else on this page executes.
Guards.admin();
document.querySelectorAll('#settingsTabs button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#settingsTabs button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('section-'+b.dataset.section).classList.add('active');
}));

function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('show')}));

function initialsOf(name){return name.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase()}

let currentAvatar=null;
let pendingAvatar=undefined;

function applyAvatar(el,initials,dataUrl){
  if(dataUrl){
    el.textContent='';
    el.style.backgroundImage=`url(${dataUrl})`;
    el.style.backgroundSize='cover';
    el.style.backgroundPosition='center';
  }else{
    el.textContent=initials;
    el.style.backgroundImage='';
  }
}

function loadOwnProfile(){
  const user=Auth.user()||{};
  const fullName=user.full_name||user.first_name||'Admin';
  document.getElementById('profileDisplayName').textContent=fullName;
  applyAvatar(document.getElementById('profileAvatarInitials'),initialsOf(fullName),currentAvatar);
  document.getElementById('profileEmailDisplay').textContent=user.email||'';
  document.getElementById('profilePhoneDisplay').textContent=user.phone||'—';
}
loadOwnProfile();

async function loadOwnSettings(){
  try{
    const settings=await API.getSettings();
    currentAvatar=settings.avatar||null;
    loadOwnProfile();
    const twoFactor=document.getElementById('twoFactorToggle');
    if(twoFactor) twoFactor.checked=Boolean(settings.preferences?.twoFactorEnabled);
  }catch(error){
    console.error('[AdminSettings] Unable to load settings',error);
  }
}
loadOwnSettings();

async function loadActiveSchoolYear(){
  try{
    const result=await API.getActiveSchoolYear();
    document.getElementById('activeSchoolYearDisplay').textContent=result.schoolYear||'—';
  }catch(error){
    console.error('[AdminSettings] Unable to load active school year',error);
  }
}
loadActiveSchoolYear();

document.getElementById('openEditSchoolYearBtn').addEventListener('click',()=>{
  document.getElementById('ay-school-year').value=document.getElementById('activeSchoolYearDisplay').textContent;
  openModal('modal-academic-year');
});
document.getElementById('ay-save-btn').addEventListener('click',async()=>{
  const value=document.getElementById('ay-school-year').value.trim();
  if(!/^\d{4}-\d{4}$/.test(value)){ showToast('School year must be in the format YYYY-YYYY'); return; }
  try{
    await API.updateActiveSchoolYear(value);
    document.getElementById('activeSchoolYearDisplay').textContent=value;
    closeModal('modal-academic-year');
    showToast('Active school year updated');
  }catch(error){
    console.error('[AdminSettings] Unable to update active school year',error);
    showToast(error?.data?.message||'Unable to update the active school year.');
  }
});

async function loadModuleDuration(){
  try{
    const result=await API.getModuleDurationSetting();
    document.getElementById('moduleDurationDisplay').textContent=(result.defaultDurationDays||'—')+' days';
  }catch(error){
    console.error('[AdminSettings] Unable to load module duration setting',error);
  }
}
loadModuleDuration();

document.getElementById('openEditModuleDurationBtn').addEventListener('click',()=>{
  document.getElementById('md-duration-days').value=parseInt(document.getElementById('moduleDurationDisplay').textContent,10)||'';
  openModal('modal-module-duration');
});
document.getElementById('md-save-btn').addEventListener('click',async()=>{
  const value=parseInt(document.getElementById('md-duration-days').value,10);
  if(!value||value<1||value>180){ showToast('Enter a number of days between 1 and 180'); return; }
  try{
    await API.updateModuleDurationSetting(value);
    document.getElementById('moduleDurationDisplay').textContent=value+' days';
    closeModal('modal-module-duration');
    showToast('Module return default updated');
  }catch(error){
    console.error('[AdminSettings] Unable to update module duration setting',error);
    showToast(error?.data?.message||'Unable to update the module return default.');
  }
});

// Change Password modal
function setReq(id,met){
  const el=document.getElementById(id);
  el.classList.toggle('met',met);
  el.querySelector('.req-dot').innerHTML=met?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>':'';
}
function checkPasswordStrength(){
  const val=document.getElementById('cp-new').value;
  setReq('req-length',val.length>=8);
  setReq('req-upper',/[A-Z]/.test(val));
  setReq('req-lower',/[a-z]/.test(val));
  setReq('req-number',/[0-9]/.test(val));
}
document.querySelectorAll('.toggle-eye').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const input=document.getElementById(btn.dataset.target);
    input.type=input.type==='password'?'text':'password';
  });
});
function showPasswordView(view){
  document.getElementById('cp-main-view').style.display=view==='main'?'block':'none';
  document.getElementById('cp-forgot-view').style.display=view==='forgot'?'block':'none';
  document.getElementById('cp-forgot-sent-view').style.display=view==='sent'?'block':'none';
}
function openChangePasswordModal(){
  ['cp-current','cp-new','cp-confirm'].forEach(id=>{document.getElementById(id).value='';document.getElementById(id).type='password'});
  checkPasswordStrength();
  showPasswordView('main');
  openModal('modal-password');
}
document.getElementById('forgotPasswordLink').addEventListener('click',e=>{
  e.preventDefault();
  document.getElementById('forgot-email-display').textContent=document.getElementById('profileEmailDisplay').textContent;
  showPasswordView('forgot');
});
document.getElementById('forgotBackBtn').addEventListener('click',()=>showPasswordView('main'));
document.getElementById('sendResetLinkBtn').addEventListener('click',async()=>{
  try{
    await Auth.forgotPassword(document.getElementById('forgot-email-display').textContent);
  }catch(error){
    console.error('[AdminSettings] Forgot password request failed',error);
  }
  showPasswordView('sent');
});
function confirmLogout(){
  document.getElementById('confirm-icon').className='icon-circle warn';
  document.getElementById('confirm-icon').innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
  document.getElementById('confirm-title').textContent='Log out of StayEd?';
  document.getElementById('confirm-sub').textContent="You'll need to sign in again to access the admin dashboard.";
  const btn=document.getElementById('confirm-btn');
  btn.className='btn primary'; btn.textContent='Log Out';
  btn.onclick=()=>{closeModal('modal-confirm');Auth.logout()};
  openModal('modal-confirm');
}
document.getElementById('logoutBtn').addEventListener('click',confirmLogout);
document.getElementById('deactivateSelfBtn').addEventListener('click',()=>{
  confirmDangerous('Deactivate your account?',"You'll immediately lose access to administrative tools. Contact another division admin to reactivate.",'Deactivate',async()=>{
    try{
      await API.post('/admin/self/deactivate',{});
      showToast('Account deactivated. Signing you out…');
      setTimeout(()=>Auth.logout(),1200);
    }catch(error){
      console.error('[AdminSettings] Deactivate self failed',error);
      showToast(error?.data?.message||'Unable to deactivate your account.');
    }
  });
});
document.getElementById('openChangePasswordBtn2').addEventListener('click',openChangePasswordModal);
document.getElementById('cp-update-btn').addEventListener('click',async()=>{
  const cur=document.getElementById('cp-current').value;
  const nw=document.getElementById('cp-new').value;
  const cf=document.getElementById('cp-confirm').value;
  if(!cur||!nw||!cf){ showToast('Please fill in all password fields'); return; }
  if(nw!==cf){ showToast("New passwords don't match"); return; }
  if(nw.length<8||!/[A-Z]/.test(nw)||!/[a-z]/.test(nw)||!/[0-9]/.test(nw)){ showToast('Password does not meet all requirements'); return; }
  try{
    await Auth.changePassword({current_password:cur, password:nw});
    closeModal('modal-password');
    showToast('Password updated');
  }catch(error){
    console.error('[AdminSettings] Change password failed',error);
    showToast(error?.data?.message||error?.message||'Unable to update password.');
  }
});

// Two-factor toggle
document.getElementById('twoFactorToggle').addEventListener('change',async e=>{
  const checked=e.target.checked;
  try{
    await API.updateSettings({twoFactorEnabled:checked});
    showToast(checked?'Two-factor authentication preference saved':'Two-factor authentication preference disabled');
  }catch(error){
    console.error('[AdminSettings] Unable to save 2FA preference',error);
    showToast('Unable to save this preference.');
    e.target.checked=!checked;
  }
});

// Edit Profile modal
document.getElementById('openEditProfileBtn').addEventListener('click',()=>{
  document.getElementById('ep-name').value=document.getElementById('profileDisplayName').textContent;
  document.getElementById('ep-empid').value=document.getElementById('profileEmpIdDisplay').textContent;
  document.getElementById('ep-phone').value=document.getElementById('profilePhoneDisplay').textContent;
  document.getElementById('ep-email').value=document.getElementById('profileEmailDisplay').textContent;
  pendingAvatar=undefined;
  applyAvatar(document.getElementById('editAvatarInitials'),document.getElementById('profileDisplayName').textContent?initialsOf(document.getElementById('profileDisplayName').textContent):'',currentAvatar);
  openModal('modal-edit-profile');
});
document.getElementById('cam-upload-btn').addEventListener('click',()=>{
  document.getElementById('avatar-file-input').click();
});
document.getElementById('avatar-file-input').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  if(file.size>2*1024*1024){ showToast('Photo must be 2MB or smaller.'); return; }
  const reader=new FileReader();
  reader.onload=ev=>{
    pendingAvatar=ev.target.result;
    const preview=document.getElementById('editAvatarInitials');
    applyAvatar(preview,'',pendingAvatar);
  };
  reader.readAsDataURL(file);
  showToast('Photo selected — save changes to apply');
});
document.getElementById('ep-save-btn').addEventListener('click',async()=>{
  const name=document.getElementById('ep-name').value.trim();
  const phone=document.getElementById('ep-phone').value.trim();
  const email=document.getElementById('ep-email').value.trim();
  if(!name){ showToast('Please enter your full name'); return; }
  try{
    const response=await API.put('/admin/profile',{fullName:name, phone, email});
    Auth.updateUser({full_name:response.data.fullName, email:response.data.email, phone:response.data.phone});
    if(pendingAvatar!==undefined){
      const avatarResponse=await API.updateAvatar(pendingAvatar);
      currentAvatar=avatarResponse.avatar||null;
      pendingAvatar=undefined;
    }
    loadOwnProfile();
    closeModal('modal-edit-profile');
    showToast('Profile updated');
  }catch(error){
    console.error('[AdminSettings] Update profile failed',error);
    showToast(error?.data?.message||'Unable to update profile.');
  }
});

function confirmDangerous(title,sub,label,onConfirm){
  document.getElementById('confirm-icon').className='icon-circle warn';
  document.getElementById('confirm-icon').innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3.14l-8.18-14a2 2 0 0 0-3.42 0Z"/></svg>';
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-sub').textContent=sub;
  const btn=document.getElementById('confirm-btn');
  btn.className='btn danger'; btn.textContent=label;
  btn.onclick=()=>{closeModal('modal-confirm'); if(onConfirm){ onConfirm(); } else { showToast(label+' complete'); }};
  openModal('modal-confirm');
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>${msg}`;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}

document.querySelectorAll('.select-wrap select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.select-wrap').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.select-wrap').classList.remove('open'));});
