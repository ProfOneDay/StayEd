// Must run first, before anything else on this page executes.
Guards.admin();

function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){document.getElementById(id).classList.remove('show')}
document.querySelectorAll('.overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('show')}));

// Collapsible sections (Account information / Security), same pattern as
// the teacher Profile Settings page.
document.querySelectorAll('[data-settings-toggle]').forEach(header=>{
  header.addEventListener('click',()=>{
    header.closest('.st-settings-section')?.classList.toggle('is-open');
  });
});

// Cards/sections settle in once on load, staggered via each element's own
// --i (see admin-account-pages.css / profile-settings.css). Always above
// the fold, so this fires directly rather than watching scroll position.
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

function formatJoinDate(value){
  if(!value) return '—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
}

function loadOwnProfile(){
  const user=Auth.user()||{};
  const fullName=user.full_name||user.first_name||'Admin';
  document.getElementById('profileDisplayName').textContent=fullName;
  applyAvatar(document.getElementById('profileAvatarInitials'),initialsOf(fullName),currentAvatar);
  document.getElementById('profileEmailDisplay').textContent=user.email||'';
  document.getElementById('profilePhoneDisplay').textContent=user.phone||'—';
  document.getElementById('profileEmpIdDisplay').textContent=user.employee_id||'—';
  const joinDate=formatJoinDate(user.join_date);
  document.querySelectorAll('[data-profile-joindate],[data-profile-joindate-echo]').forEach(el=>{el.textContent=joinDate;});
  document.querySelectorAll('[data-profile-empid-echo]').forEach(el=>{el.textContent=user.employee_id||'—';});
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
    console.error('[AdminProfileSettings] Unable to load settings',error);
  }
}
loadOwnSettings();

// Change Password modal
function setReq(id,met){
  document.getElementById(id)?.classList.toggle('is-met',met);
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
document.getElementById('openChangePasswordBtn2').addEventListener('click',openChangePasswordModal);
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
    console.error('[AdminProfileSettings] Forgot password request failed',error);
  }
  showPasswordView('sent');
});
document.getElementById('cp-update-btn').addEventListener('click',async()=>{
  const cur=document.getElementById('cp-current').value;
  const nw=document.getElementById('cp-new').value;
  const cf=document.getElementById('cp-confirm').value;
  if(!cur||!nw||!cf){ Utils.toast('Please fill in all password fields','error'); return; }
  if(nw!==cf){ Utils.toast("New passwords don't match",'error'); return; }
  if(nw.length<8||!/[A-Z]/.test(nw)||!/[a-z]/.test(nw)||!/[0-9]/.test(nw)){ Utils.toast('Password does not meet all requirements','error'); return; }
  try{
    await Auth.changePassword({current_password:cur, password:nw});
    closeModal('modal-password');
    Utils.toast('Password updated','success');
  }catch(error){
    console.error('[AdminProfileSettings] Change password failed',error);
    Utils.toast(error?.data?.message||error?.message||'Unable to update password.','error');
  }
});

// Two-factor toggle
document.getElementById('twoFactorToggle').addEventListener('change',async e=>{
  const checked=e.target.checked;
  try{
    await API.updateSettings({twoFactorEnabled:checked});
    Utils.toast(checked?'Two-factor authentication preference saved':'Two-factor authentication preference disabled','success');
  }catch(error){
    console.error('[AdminProfileSettings] Unable to save 2FA preference',error);
    Utils.toast('Unable to save this preference.','error');
    e.target.checked=!checked;
  }
});

// Edit Profile modal
function openEditProfileModal(){
  document.getElementById('ep-name').value=document.getElementById('profileDisplayName').textContent;
  document.getElementById('ep-empid').value=document.getElementById('profileEmpIdDisplay').textContent;
  document.getElementById('ep-phone').value=document.getElementById('profilePhoneDisplay').textContent;
  document.getElementById('ep-email').value=document.getElementById('profileEmailDisplay').textContent;
  pendingAvatar=undefined;
  const name=document.getElementById('profileDisplayName').textContent;
  applyAvatar(document.getElementById('editAvatarInitials'),name?initialsOf(name):'',currentAvatar);
  openModal('modal-edit-profile');
}
document.getElementById('openEditProfileBtn').addEventListener('click',openEditProfileModal);
document.querySelector('[data-open-edit-profile]')?.addEventListener('click',openEditProfileModal);
document.getElementById('cam-upload-btn').addEventListener('click',()=>{
  document.getElementById('avatar-file-input').click();
});
document.getElementById('avatar-file-input').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  if(file.size>2*1024*1024){ Utils.toast('Photo must be 2MB or smaller.','error'); return; }
  const reader=new FileReader();
  reader.onload=ev=>{
    pendingAvatar=ev.target.result;
    applyAvatar(document.getElementById('editAvatarInitials'),'',pendingAvatar);
  };
  reader.readAsDataURL(file);
  Utils.toast('Photo selected — save changes to apply','info');
});
document.getElementById('ep-save-btn').addEventListener('click',async()=>{
  const name=document.getElementById('ep-name').value.trim();
  const phone=document.getElementById('ep-phone').value.trim();
  const email=document.getElementById('ep-email').value.trim();
  if(!name){ Utils.toast('Please enter your full name','error'); return; }
  try{
    const response=await API.put('/admin/profile',{fullName:name, phone, email});
    Auth.updateUser({full_name:response.data.fullName, email:response.data.email, phone:response.data.phone});
    if(pendingAvatar!==undefined){
      const avatarResponse=await API.updateAvatar(pendingAvatar);
      currentAvatar=avatarResponse.avatar||null;
      pendingAvatar=undefined;
    }
    loadOwnProfile();
    Layout?.restoreUser?.();
    closeModal('modal-edit-profile');
    Utils.toast('Profile updated','success');
  }catch(error){
    console.error('[AdminProfileSettings] Update profile failed',error);
    Utils.toast(error?.data?.message||'Unable to update profile.','error');
  }
});

// Danger zone: logout / deactivate, via the shared confirm modal.
function confirmLogout(){
  const icon=document.getElementById('confirm-icon');
  icon.className='icon-circle warn';
  icon.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';
  document.getElementById('confirm-title').textContent='Log out of StayEd?';
  document.getElementById('confirm-sub').textContent="You'll need to sign in again to access the admin dashboard.";
  const btn=document.getElementById('confirm-btn');
  btn.className='st-btn st-btn-primary'; btn.textContent='Log out';
  btn.onclick=()=>{closeModal('modal-confirm');Auth.logout()};
  openModal('modal-confirm');
}
document.getElementById('logoutBtn').addEventListener('click',confirmLogout);

function confirmDangerous(title,sub,label,onConfirm){
  const icon=document.getElementById('confirm-icon');
  icon.className='icon-circle danger';
  icon.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3.14l-8.18-14a2 2 0 0 0-3.42 0Z"/></svg>';
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-sub').textContent=sub;
  const btn=document.getElementById('confirm-btn');
  btn.className='st-btn st-btn-danger'; btn.textContent=label;
  btn.onclick=()=>{closeModal('modal-confirm'); if(onConfirm){ onConfirm(); } else { Utils.toast(label+' complete','success'); }};
  openModal('modal-confirm');
}
document.getElementById('deactivateSelfBtn').addEventListener('click',()=>{
  confirmDangerous('Deactivate your account?',"You'll immediately lose access to administrative tools. Contact another division admin to reactivate.",'Deactivate',async()=>{
    try{
      await API.post('/admin/self/deactivate',{});
      Utils.toast('Account deactivated. Signing you out…','success');
      setTimeout(()=>Auth.logout(),1200);
    }catch(error){
      console.error('[AdminProfileSettings] Deactivate self failed',error);
      Utils.toast(error?.data?.message||'Unable to deactivate your account.','error');
    }
  });
});
