'use strict';
const tg=window.Telegram?.WebApp;
const $=id=>document.getElementById(id);
let kind='expense',accounts=[],busy=false;
try {
  const raw=new URLSearchParams(location.hash.slice(1)).get('accounts');
  if(raw){const bytes=Uint8Array.from(atob(raw.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));accounts=JSON.parse(new TextDecoder().decode(bytes));}
  if(!Array.isArray(accounts)||accounts.some(a=>!Number.isSafeInteger(a.id)||typeof a.name!=='string'||typeof a.currency!=='string'))throw Error();
} catch {accounts=[];}
function haptic(type='selection',style='light') {
  if(!$('haptic').checked||!tg?.isVersionAtLeast?.('6.1'))return;
  try {if(type==='selection')tg.HapticFeedback.selectionChanged();else if(type==='error')tg.HapticFeedback.notificationOccurred('error');else tg.HapticFeedback.impactOccurred(style);} catch { /* Unsupported client: keep the form usable. */ }
}
try {$('haptic').checked=localStorage.getItem('rubl-haptic')!=='off';}catch{}
$('haptic').addEventListener('change',()=>{try{localStorage.setItem('rubl-haptic',$('haptic').checked?'on':'off');}catch{} if($('haptic').checked)haptic('impact');});
function applyTheme(){document.documentElement.classList.toggle('dark',tg?.colorScheme==='dark'||(!tg&&matchMedia('(prefers-color-scheme:dark)').matches));}
applyTheme();tg?.onEvent('themeChanged',applyTheme);tg?.ready();tg?.expand();
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
$('day').value=day;$('day').max=day;$('day').min='1900-01-01';
function fill(select,values){const old=select.value;select.replaceChildren(...values.map(a=>{const option=document.createElement('option');option.value=String(a.id);option.textContent=a.name+' · '+a.currency;return option;}));if(values.some(a=>String(a.id)===old))select.value=old;}
fill($('account'),accounts);
function refresh(){
  const source=accounts.find(a=>String(a.id)===$('account').value);
  $('currency').textContent=source?.currency||'RUB';
  fill($('destination'),accounts.filter(a=>a.id!==source?.id));
  const dest=accounts.find(a=>String(a.id)===$('destination').value);
  $('destination-field').hidden=kind!=='transfer';
  $('received-field').hidden=kind!=='transfer'||source?.currency===dest?.currency;
  $('received').placeholder=dest?'0,00 '+dest.currency:'0,00';
  $('category-field').hidden=kind==='transfer';
  $('custom-category').hidden=$('category').value!=='custom';
}
refresh();
for(const button of document.querySelectorAll('[data-kind]'))button.addEventListener('click',()=>{if(kind===button.dataset.kind)return;kind=button.dataset.kind;haptic();document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));refresh();});
for(const id of ['account','destination','category','day'])$(id).addEventListener('change',()=>{haptic();refresh();});
const fromTelegram=Boolean(tg&&tg.platform!=='unknown'&&tg.platform!==undefined);
if(!accounts.length||!fromTelegram){$('notice').hidden=false;$('notice').textContent=!accounts.length?'Сначала добавьте счёт в боте и откройте форму его кнопкой «Открыть приложение».':'Откройте эту форму кнопкой «Открыть приложение» в чате с ботом.';$('submit').disabled=true;}
function validAmount(value){return /^\d+(?:[.,]\d{1,2})?$/.test(value.trim())&&Number(value.replace(',','.'))>0&&Number(value.replace(',','.'))<=90000000000;}
$('form').addEventListener('submit',event=>{
  event.preventDefault();if(busy)return;$('error').textContent='';
  const source=accounts.find(a=>String(a.id)===$('account').value),dest=accounts.find(a=>String(a.id)===$('destination').value);
  let error='';
  if(!validAmount($('amount').value))error='Введите сумму больше нуля, до двух знаков после запятой.';
  else if(!source)error='Выберите счёт.';
  else if(kind==='transfer'&&(!dest||source.id===dest.id))error='Для перевода нужны два разных счёта.';
  else if(kind==='transfer'&&source.currency!==dest.currency&&!validAmount($('received').value))error='Укажите фактическую сумму зачисления.';
  else if(!$('day').value||!$('day').checkValidity())error='Проверьте дату операции.';
  else if(kind!=='transfer'&&$('category').value==='custom'&&!$('custom-category').value.trim())error='Введите название категории.';
  if(error){$('error').textContent=error;haptic('error');return;}
  const entry={version:1,kind,account_id:source.id,destination_id:kind==='transfer'?dest.id:null,amount:$('amount').value.trim(),received:kind==='transfer'?(source.currency===dest.currency?$('amount').value.trim():$('received').value.trim()):null,category:kind==='transfer'?'':$('category').value==='custom'?$('custom-category').value.trim():$('category').value,day:$('day').value,note:$('note').value.trim(),tags:$('tags').value.trim()};
  const payload=JSON.stringify(entry);
  if(new TextEncoder().encode(payload).length>4096){$('error').textContent='Сократите заметку и метки.';haptic('error');return;}
  if(!fromTelegram){$('error').textContent='Откройте форму из бота.';return;}
  busy=true;$('submit').disabled=true;haptic('impact','medium');
  // sendData closes keyboard-button Mini Apps. This is submission, not saved success.
  try{tg.sendData(payload);}catch{busy=false;$('submit').disabled=false;$('error').textContent='Не получилось отправить. Вернитесь в бот и откройте форму заново.';haptic('error');}
});
