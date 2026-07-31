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
document.getElementById('sendResetLinkBtn').addEventListener('click',()=>{
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
document.getElementById('sidebarLogoutBtn').addEventListener('click',e=>{e.preventDefault();confirmLogout()});
document.getElementById('deactivateSelfBtn').addEventListener('click',()=>{
  confirmDangerous('Deactivate your account?',"You'll immediately lose access to administrative tools. Contact another division admin to reactivate.",'Deactivate');
});
document.getElementById('openChangePasswordBtn2').addEventListener('click',openChangePasswordModal);
document.getElementById('cp-update-btn').addEventListener('click',()=>{
  const cur=document.getElementById('cp-current').value;
  const nw=document.getElementById('cp-new').value;
  const cf=document.getElementById('cp-confirm').value;
  if(!cur||!nw||!cf){ showToast('Please fill in all password fields'); return; }
  if(nw!==cf){ showToast("New passwords don't match"); return; }
  if(nw.length<8||!/[A-Z]/.test(nw)||!/[a-z]/.test(nw)||!/[0-9]/.test(nw)){ showToast('Password does not meet all requirements'); return; }
  closeModal('modal-password');
  showToast('Password updated');
});

// Two-factor toggle
document.getElementById('twoFactorToggle').addEventListener('change',e=>{
  showToast(e.target.checked?'Two-factor authentication enabled':'Two-factor authentication disabled');
});

// Edit Profile modal
document.getElementById('openEditProfileBtn').addEventListener('click',()=>{
  document.getElementById('ep-name').value=document.getElementById('profileDisplayName').textContent;
  document.getElementById('ep-empid').value=document.getElementById('profileEmpIdDisplay').textContent;
  document.getElementById('ep-phone').value=document.getElementById('profilePhoneDisplay').textContent;
  document.getElementById('ep-email').value=document.getElementById('profileEmailDisplay').textContent;
  document.getElementById('editAvatarInitials').textContent=document.getElementById('profileAvatarInitials').textContent;
  openModal('modal-edit-profile');
});
document.getElementById('cam-upload-btn').addEventListener('click',()=>{
  document.getElementById('avatar-file-input').click();
});
document.getElementById('avatar-file-input').addEventListener('change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const preview=document.getElementById('editAvatarInitials');
    preview.textContent='';
    preview.parentElement.style.backgroundImage=`url(${ev.target.result})`;
    preview.parentElement.style.backgroundSize='cover';
    preview.parentElement.style.backgroundPosition='center';
  };
  reader.readAsDataURL(file);
  showToast('Photo selected — save changes to apply');
});
document.getElementById('ep-save-btn').addEventListener('click',()=>{
  const name=document.getElementById('ep-name').value.trim();
  const empid=document.getElementById('ep-empid').value.trim();
  const phone=document.getElementById('ep-phone').value.trim();
  const email=document.getElementById('ep-email').value.trim();
  if(!name){ showToast('Please enter your full name'); return; }
  document.getElementById('profileDisplayName').textContent=name;
  document.getElementById('profileAvatarInitials').textContent=initialsOf(name);
  if(empid) document.getElementById('profileEmpIdDisplay').textContent=empid;
  if(phone) document.getElementById('profilePhoneDisplay').textContent=phone;
  if(email) document.getElementById('profileEmailDisplay').textContent=email;
  closeModal('modal-edit-profile');
  showToast('Profile updated');
});

function confirmDangerous(title,sub,label){
  document.getElementById('confirm-icon').className='icon-circle warn';
  document.getElementById('confirm-icon').innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14A2 2 0 0 0 3.82 21h16.36a2 2 0 0 0 1.71-3.14l-8.18-14a2 2 0 0 0-3.42 0Z"/></svg>';
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-sub').textContent=sub;
  const btn=document.getElementById('confirm-btn');
  btn.className='btn danger'; btn.textContent=label;
  btn.onclick=()=>{closeModal('modal-confirm');showToast(label+' complete')};
  openModal('modal-confirm');
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>${msg}`;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}

const menuBtn=document.getElementById('menuBtn');
const asideEl=document.querySelector('aside');
menuBtn.addEventListener('click',()=>{const open=asideEl.classList.toggle('open');menuBtn.setAttribute('aria-expanded',open?'true':'false')});
document.addEventListener('click',e=>{if(asideEl.classList.contains('open')&&!asideEl.contains(e.target)&&e.target!==menuBtn){asideEl.classList.remove('open');menuBtn.setAttribute('aria-expanded','false')}});

document.querySelectorAll('.select-wrap select').forEach(sel=>{sel.addEventListener('focus',()=>sel.closest('.select-wrap').classList.add('open'));sel.addEventListener('blur',()=>sel.closest('.select-wrap').classList.remove('open'));});
