const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const game = $('#game');
const levelEl = $('#level');
const chapterEl = $('#chapter');
const streakEl = $('#streak');
const hintCountEl = $('#hintCount');
const toastEl = $('#toast');
const imagePuzzleBtn = $('#imagePuzzleBtn');

const ENERGY_BREAK_ENABLED = true;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CHAPTERS = [
  ['🏥', 'Hospital', 'Observation & clean patterns'],
  ['🚇', 'Transit', 'Sequences & arithmetic'],
  ['🏛️', 'Archive', 'Contradictions & ciphers'],
  ['🕰️', 'Clockwork House', 'Choices & deduction'],
  ['🗝️', 'Mansion', 'Cipher rooms'],
  ['🧪', 'Underground Lab', 'Memory protocols'],
  ['⛓️', 'Prison', 'Multi-step systems'],
  ['🌌', 'Deep Station', 'Harder memory & code'],
  ['🕳️', 'Black Site', 'Lateral traps'],
  ['🌀', 'The Core', 'Compound mind games']
];

let levels = [];
let current = Number(localStorage.getItem('brain_current') || 1);
let hints = Number(localStorage.getItem('brain_hints') || 3);
let streak = Number(localStorage.getItem('brain_streak') || 0);
let bestStreak = Number(localStorage.getItem('brain_best_streak') || 0);
let sessionLevels = Number(sessionStorage.getItem('brain_session_levels') || 0);
let lang = localStorage.getItem('brain_lang') || 'en';
let vibrateOn = localStorage.getItem('brain_vibrate') !== '0';
let keys = Number(localStorage.getItem('brain_keys') || 0);
let stars = JSON.parse(localStorage.getItem('brain_stars') || '{}');
let achievements = JSON.parse(localStorage.getItem('brain_ach') || '[]');
let doorSkin = localStorage.getItem('brain_skin') || 'wood';
let dailyMode = false;
let hintUsedThis = false;
let hintTier = 0;
let hintLog = [];
const MAX_HINTS = 9;
const HINT_COST = [0, 1, 1]; // tier 1 free, tier 2 and 3 cost one hint each
const I18N = {
  en: { hint:'Hint', reset:'Reset', unlock:'UNLOCK DOOR', answer:'YOUR ANSWER', noHints:'No hints left.', map:'Door map', daily:'Daily door', settings:'Settings', keys:'Keys buy a hint or a door skin.', story:'A locked room. One rule. No second chance to look twice.' },
  bn: { hint:'হিন্ট', reset:'রিসেট', unlock:'দরজা খোলো', answer:'তোমার উত্তর', noHints:'হিন্ট শেষ।', map:'দরজার ম্যাপ', daily:'দৈনিক দরজা', settings:'সেটিংস', keys:'কি দিয়ে হিন্ট বা দরজার স্কিন কেনা যায়।', story:'একটা বন্ধ ঘর। একটা নিয়ম। দুবার না তাকিয়ে উত্তর দিও না।' }
};
const t = k => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
function buzz(ms=18){ if (vibrateOn && navigator.vibrate) navigator.vibrate(ms); }
function totalStars(){ return Object.values(stars).reduce((a,b)=>a+Number(b||0),0); }
function persistMeta(){
  localStorage.setItem('brain_lang', lang);
  localStorage.setItem('brain_vibrate', vibrateOn ? '1' : '0');
  localStorage.setItem('brain_keys', keys);
  localStorage.setItem('brain_stars', JSON.stringify(stars));
  localStorage.setItem('brain_ach', JSON.stringify(achievements));
  localStorage.setItem('brain_skin', doorSkin);
  const kh = document.getElementById('keyCount'); if (kh) kh.textContent = keys;
  const sh = document.getElementById('starsHud'); if (sh) sh.textContent = '★ ' + totalStars();
  updateHintButton();
  const rl = document.getElementById('resetLabel'); if (rl) rl.textContent = t('reset');
  const ip = document.getElementById('imagePuzzleLabel'); if (ip) ip.textContent = `Image ${Object.keys(imageSolved).length}/100`;
}
function updateHintButton(){
  const hl = document.getElementById('hintLabel'); if (!hl) return;
  const free = lang === 'bn' ? 'ফ্রি' : 'free';
  const tag = hintTier >= 3 ? 'max' : (HINT_COST[hintTier] === 0 ? free : '−' + HINT_COST[hintTier]);
  hl.textContent = t('hint') + ' · ' + tag;
}
function grant(id){
  if (achievements.includes(id)) return;
  achievements.push(id);
  keys += 1;
  persistMeta();
  toast('🏅 ' + id.replaceAll('_',' ') + '  +1 key', 'hint');
}
let levelStarted = Date.now();
let levelLimit = 45;
function timeBudget(level){
  if (level.time) return level.time;
  const base = {memory:55, cipher:50, multistep:60, lateral:48, cipherMath:52, logic:40, sequence:35, math:35, observation:28, choice:30}[level.type] || 40;
  return base + Math.floor((chapterNumber()-1)/2)*4;
}
function awardStars(levelId){
  const elapsed = (Date.now()-levelStarted)/1000;
  const ratio = elapsed / levelLimit;
  let earned = ratio <= 0.45 ? 3 : ratio <= 0.8 ? 2 : 1;
  if (hintTier >= 2) earned = Math.min(earned, 1);
  else if (hintTier === 1) earned = Math.min(earned, 2);
  if (attempts > 2) earned = Math.min(earned, 2);
  const prev = stars[levelId] || 0;
  if (earned > prev) stars[levelId] = earned;
  keys += earned === 3 ? 1 : 0;
  if (earned === 3 && prev < 3 && hints < MAX_HINTS) { hints++; toast('🌟 First 3★ clear: +1 hint', 'hint'); }
  persistMeta();
  if (totalStars() >= 10) grant('ten_stars');
  if (streak >= 5) grant('streak_5');
  if (streak >= 10) grant('streak_10');
  if (!hintUsedThis && earned === 3) grant('clean_solve');
}

let attempts = Number(sessionStorage.getItem('brain_attempts_' + current) || 0);
let timer = null;
let locked = false;

const AUDIO = window.Audio100Doors;
const muteBtn = $('#mute');

function syncMuteBtn() {
  if (!muteBtn || !AUDIO) return;
  muteBtn.textContent = AUDIO.isMuted() ? '🔇' : '🔊';
}

if (AUDIO) {
  syncMuteBtn();
  muteBtn?.addEventListener('click', () => {
    AUDIO.ensureCtx();
    AUDIO.toggleMuted();
    syncMuteBtn();
  });
  // Autoplay policies require a user gesture before audio can start.
  const primeAudio = () => {
    AUDIO.ensureCtx();
    AUDIO.startMusicForChapter(chapterNumber());
    document.removeEventListener('pointerdown', primeAudio);
  };
  document.addEventListener('pointerdown', primeAudio, { once: true });
}

function save() {
  persistMeta();
  localStorage.setItem('brain_current', current);
  localStorage.setItem('brain_hints', hints);
  localStorage.setItem('brain_streak', streak);
  localStorage.setItem('brain_best_streak', bestStreak);
  if (hintCountEl) hintCountEl.textContent = hints;
}

function saveAttempts() {
  sessionStorage.setItem('brain_attempts_' + current, attempts);
}

function resetAttempts() {
  sessionStorage.removeItem('brain_attempts_' + current);
  attempts = 0;
}

function chapterNumber(level = current) {
  return Math.ceil(level / 10);
}

function setTheme() {
  document.body.dataset.chapter = chapterNumber();
}

function chapter() {
  const c = chapterNumber();
  const data = CHAPTERS[c - 1];
  chapterEl.textContent = `${data[0]} CHAPTER ${c} • ${data[1]}`;
  chapterEl.title = 'Open chapter progress';
  levelEl.textContent = current;
  streakEl.textContent = `STREAK ${streak} • BEST ${bestStreak}`;
  setTheme();
}

function normalize(v) {
  return String(v).trim().toUpperCase().replace(/\s+/g, ' ');
}

function toast(text, kind = 'hint') {
  toastEl.textContent = text;
  toastEl.dataset.kind = kind;
  toastEl.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function eliminateWrongOption(level) {
  const wrong = $$('.choice').find(b => !b.classList.contains('eliminated') && normalize(b.textContent) !== normalize(level.answer));
  if (wrong) { wrong.classList.add('eliminated'); wrong.disabled = true; }
  return $$('.choice').filter(b => !b.classList.contains('eliminated')).length;
}

function hintText(level, tier) {
  if (tier === 1) return level.hint;
  if (level.choices) {
    const left = eliminateWrongOption(level);
    return left <= 1 ? 'Only one option is left.' : `One wrong option is crossed out. ${left} left.`;
  }
  const a = String(level.answer);
  const numeric = /^\d+$/.test(a);
  if (tier === 2) {
    if (numeric) return `The answer has ${a.length} digit${a.length === 1 ? '' : 's'} and is ${Number(a) % 2 ? 'odd' : 'even'}.`;
    return `The answer has ${a.length} character${a.length === 1 ? '' : 's'} and starts with "${a[0]}".`;
  }
  if (numeric && a.length === 1) return `The answer is between ${Math.max(0, Number(a) - 2)} and ${Number(a) + 2}.`;
  if (numeric) return `The answer starts with ${a[0]}${'_'.repeat(a.length - 1)}.`;
  const show = a.length > 3 ? [0, a.length - 1] : [0];
  return 'Pattern: ' + [...a].map((ch, i) => show.includes(i) || ch === ' ' ? ch : '_').join(' ');
}

function wrongNudge() {
  if (attempts <= 1) return 'Not quite. Re-read the clue.';
  return hintTier === 0 ? 'Not quite. Stuck? The first hint is free.' : 'Not quite. Check your hints below.';
}

function renderHintBox() {
  const box = $('#hintBox'); if (!box) return;
  box.innerHTML = '';
  hintLog.forEach((h, i) => {
    const row = document.createElement('div');
    const b = document.createElement('b'); b.textContent = `💡 ${i + 1}  `;
    row.append(b, document.createTextNode(h));
    box.appendChild(row);
  });
  box.classList.toggle('hidden', hintLog.length === 0);
}

function nextHint() {
  const level = levels[current - 1];
  if (!level || locked) return;
  if (hintTier >= 3) return toast('No more hints for this door.', 'wrong');
  const cost = HINT_COST[hintTier];
  if (cost > hints) { AUDIO?.playWrong(); return toast(t('noHints') + ' 3★ clears, the daily door and 🔑 give more.', 'wrong'); }
  hints -= cost;
  hintTier++;
  hintUsedThis = true;
  hintLog.push(hintText(level, hintTier));
  renderHintBox();
  updateHintButton();
  save();
  AUDIO?.playHint();
}

function wrongFeedback(level) {
  attempts++;
  saveAttempts();
  streak = 0;
  save();
  AUDIO?.playWrong();
  buzz(30);
  const scene = $('.scene');
  const panel = $('.panel');
  scene?.classList.remove('wrong');
  panel?.classList.remove('wrong-panel');
  void scene?.offsetWidth;
  scene?.classList.add('wrong');
  panel?.classList.add('wrong-panel');
  toast(`✕ ${wrongNudge()}`, 'wrong');
}

function check(value, answer) {
  if (locked) return;
  const level = levels[current - 1];
  const accepted = [answer, ...((level && level.alt) || [])].map(normalize);
  if (accepted.includes(normalize(value))) complete();
  else wrongFeedback(level);
}

function burst() {
  if (streak % 5 !== 0) return;
  const scene = $('.scene');
  if (!scene) return;
  scene.classList.remove('milestone');
  void scene.offsetWidth;
  scene.classList.add('milestone');
}

function complete() {
  locked = true;
  clearInterval(timer);
  streak++;
  bestStreak = Math.max(bestStreak, streak);
  sessionLevels++;
  sessionStorage.setItem('brain_session_levels', sessionLevels);
  save();
  AUDIO?.playCorrect();
  AUDIO?.playDoorOpen();
  buzz([12,40,18]);
  if (!dailyMode) awardStars(current);
  else { localStorage.setItem('brain_daily', new Date().toDateString()); grant('daily_clear'); keys+=1; if (hints < MAX_HINTS) hints++; persistMeta(); save(); }
  burst();
  $('.door')?.classList.add('open');
  $('.scene')?.classList.add('correct');

  const isChapterEnd = current % 10 === 0;
  const isGameEnd = current === 100;
  const delay = REDUCED_MOTION ? 150 : 700;

  setTimeout(() => {
    if (isGameEnd) {
      finish();
      locked = false;
      return;
    }
    if (isChapterEnd) {
      AUDIO?.playChapterFanfare();
      showChapterTransition(chapterNumber(), () => {
        AUDIO?.startMusicForChapter(chapterNumber() + 1);
        if (ENERGY_BREAK_ENABLED && sessionLevels % 10 === 0) showBreak(() => advance());
        else advance();
      });
    } else if (ENERGY_BREAK_ENABLED && sessionLevels % 10 === 0) {
      showBreak(() => advance());
    } else {
      advance();
    }
  }, delay);
}

function advance() {
  current++;
  resetAttempts();
  locked = false;
  save();
  render('slide-in');
}

function showChapterTransition(completedChapter, callback) {
  const next = completedChapter + 1;
  const data = CHAPTERS[completedChapter - 1];
  const nextData = CHAPTERS[next - 1];
  const card = document.createElement('div');
  card.className = 'chapter-card';
  card.innerHTML = `<div class="chapter-card-inner"><div class="chapter-card-icon">${data[0]}</div><small>CHAPTER ${completedChapter} COMPLETE</small><strong>${data[1]}</strong><p>${data[2]}</p>${nextData ? `<span>Next: ${nextData[0]} ${nextData[1]}</span>` : ''}</div>`;
  document.body.appendChild(card);
  setTimeout(() => {
    card.classList.add('leave');
    setTimeout(() => { card.remove(); callback(); }, REDUCED_MOTION ? 0 : 450);
  }, REDUCED_MOTION ? 450 : 1500);
}

function showBreak(callback) {
  const card = document.createElement('div');
  card.className = 'break-card';
  card.innerHTML = `<div class="break-inner"><div>☕</div><h2>Take a break?</h2><p>You cleared another 10 doors. A short pause can help your brain reset.</p><button class="submit" id="continueBreak">Continue</button></div>`;
  document.body.appendChild(card);
  $('#continueBreak', card).onclick = () => { card.classList.add('leave'); setTimeout(() => { card.remove(); callback(); }, REDUCED_MOTION ? 0 : 350); };
}

function showProgress() {
  const modal = document.createElement('div');
  modal.className = 'progress-modal';
  const unlocked = chapterNumber() > 10 ? 10 : chapterNumber();
  modal.innerHTML = `<div class="progress-inner"><button class="modal-close" aria-label="Close">×</button><div class="progress-head"><small>PROGRESS</small><h2>${streak} current • ${bestStreak} best</h2></div><div class="badges">${CHAPTERS.map((c, i) => {
    const open = i + 1 <= unlocked;
    const done = current > (i + 1) * 10;
    return `<div class="badge ${open ? 'unlocked' : 'locked'} ${done ? 'done' : ''}"><div>${open ? c[0] : '🔒'}</div><strong>CH ${i + 1}</strong><span>${c[1]}</span></div>`;
  }).join('')}</div></div>`;
  document.body.appendChild(modal);
  $('.modal-close', modal).onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

function render(transition = '') {
  levelStarted = Date.now();
  clearInterval(timer);
  save(); chapter();
  const level = levels[current - 1];
  if (!level) return;
  locked = false;
  const got = stars[level.id] || 0;
  const props = {observation:'👁️ Gauge',sequence:'🔢 Steps',math:'➗ Formula',logic:'⚖️ Rule',choice:'🧭 Pick',cipher:'🔤 Code',memory:'🧠 Flash',lateral:'💡 Twist',multistep:'🔗 Chain',cipherMath:'🔣 Mix'}[level.type] || '🔐 Lock';
  game.innerHTML = `<div class="scene ${transition}"><div class="ceiling"></div><div class="floor"></div><div class="door ${doorSkin}" aria-hidden="true"></div><section class="panel"><div class="star-row">${'★'.repeat(got)}${'☆'.repeat(3-got)}</div><div class="icon">${level.type === 'memory' ? '🧠' : '🔐'}</div><h1>${level.title}</h1><p class="story">${level.scene || t('story')}</p><div class="props"><div class="prop"><b>${props.split(' ')[0]}</b>${props.split(' ').slice(1).join(' ')}</div><div class="prop"><b>${chapterNumber()}</b>CHAPTER</div><div class="prop"><b>${doorSkin.toUpperCase()}</b>DOOR</div></div><p id="clue">${level.clue}</p><div class="timebar"><i id="timeFill"></i></div><div class="time-label" id="timeLabel">3★ window</div><div id="control"></div><div id="hintBox" class="hintbox hidden"></div></section></div>`;
  hintUsedThis = false;
  hintTier = 0;
  hintLog = [];
  updateHintButton();
  const control = $('#control');

  if (level.type === 'memory') {
    const sec = level.memTime || 4;
    const ask = level.ask || 'Enter the sequence.';
    const mode = level.text ? 'text' : 'numeric';
    control.innerHTML = `<div class="memory-status">MEMORIZE • ${sec} SECONDS<br><span class="memory-ask">THEN: ${ask}</span></div><div class="timer"><i style="transition-duration:${sec}s"></i></div><div class="memory-cover" id="memoryCover">MEMORY LOCKED</div><div class="memory-input hidden"><input id="answer" class="answer" inputmode="${mode}" autocomplete="off" placeholder="MEMORY CODE"><button class="submit" id="submit">UNLOCK</button></div>`;
    const bar = $('.timer i', control);
    const clue = $('#clue');
    setTimeout(() => bar?.style.setProperty('width', '0%'), 50);
    setTimeout(() => {
      clue?.classList.add('masked');
      $('#memoryCover')?.classList.add('revealed');
      $('.memory-input')?.classList.remove('hidden');
      $('.memory-status').innerHTML = `MEMORY HIDDEN<br><span class="memory-ask">${ask}</span>`;
      $('#answer')?.focus();
    }, sec * 1000);
  } else if (level.choices) {
    control.innerHTML = `<div class="choices ${level.choices.some(x => String(x).length > 16) ? 'long' : ''}">${level.choices.map(x => `<button class="choice">${x}</button>`).join('')}</div>`;
    $$('.choice', control).forEach(b => b.onclick = () => { AUDIO?.playTap(); check(b.textContent, level.answer); });
  } else {
    control.innerHTML = `<input id="answer" class="answer" autocomplete="off" placeholder="${t('answer')}"><button class="submit" id="submit">${t('unlock')}</button>`;
  }

  const submit = $('#submit');
  if (submit) submit.onclick = () => { AUDIO?.playTap(); check($('#answer').value, level.answer); };
  const input = $('#answer');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') submit?.click(); });
  const lvl = levels[current-1];
  levelLimit = timeBudget(lvl);
  const fill = document.getElementById('timeFill');
  const label = document.getElementById('timeLabel');
  clearInterval(window.levelClock);
  window.levelClock = setInterval(() => {
    const left = Math.max(0, levelLimit - (Date.now()-levelStarted)/1000);
    if (fill) fill.style.width = (left/levelLimit*100) + '%';
    const ratio = 1 - left/levelLimit;
    const starsNow = ratio <= 0.45 ? 3 : ratio <= 0.8 ? 2 : 1;
    if (label) label.textContent = left.toFixed(0) + 's  •  ' + '★'.repeat(starsNow) + '☆'.repeat(3-starsNow);
    if (fill) fill.dataset.tier = starsNow;
    if (left <= 0 && label) label.textContent = 'time up • 1★ if solved';
  }, 200);
}

function finish() {
  document.body.dataset.chapter = 10;
  AUDIO?.playVictory();
  AUDIO?.stopMusic();
  game.innerHTML = `<div class="scene"><section class="panel finish-panel"><div class="icon">🏆</div><h1>YOU ESCAPED</h1><p>100 doors. 100 problems. Your best streak was ${bestStreak}.</p><button class="submit" id="again">PLAY AGAIN</button></section></div>`;
  $('#again').onclick = () => {
    current = 1; hints = 3; streak = 0; bestStreak = 0; sessionLevels = 0; sessionStorage.clear(); save(); render();
    AUDIO?.startMusicForChapter(1);
  };
}

$('#hint').onclick = nextHint;

$('#reset').onclick = () => {
  if (confirm('Reset all progress?')) {
    current = 1; hints = 3; streak = 0; bestStreak = 0; sessionLevels = 0;
    localStorage.removeItem('brain_current');
    sessionStorage.clear(); save(); render();
    AUDIO?.startMusicForChapter(1);
  }
};

chapterEl.addEventListener('click', showProgress);
chapterEl.setAttribute('role', 'button');
chapterEl.setAttribute('tabindex', '0');
chapterEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') showProgress(); });


function escAttr(v){
  return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function svgShape2(name,x,y,size=22,fill='none',stroke='#e9edf3',sw=3,rotate=0){
  if(name==='CIRCLE') return `<circle cx="${x}" cy="${y}" r="${size*.58}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  if(name==='TRIANGLE') return `<path d="M ${x} ${y-size} L ${x+size*.9} ${y+size*.7} L ${x-size*.9} ${y+size*.7} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" transform="rotate(${rotate} ${x} ${y})"/>`;
  if(name==='SQUARE') return `<rect x="${x-size*.62}" y="${y-size*.62}" width="${size*1.24}" height="${size*1.24}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" transform="rotate(${rotate} ${x} ${y})"/>`;
  if(name==='DIAMOND') return `<path d="M ${x} ${y-size} L ${x+size} ${y} L ${x} ${y+size} L ${x-size} ${y} Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  return `<polygon points="${x},${y-size} ${x+size*.8},${y-size*.25} ${x+size*.48},${y+size*.8} ${x-size*.48},${y+size*.8} ${x-size*.8},${y-size*.25}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" transform="rotate(${rotate} ${x} ${y})"/>`;
}
function imageSVG(p){
  const W=360,H=220; let i='';
  if(p.kind==='oddOneOut'){
    p.data.cells.forEach((shape,n)=>{
      const x=65+(n%3)*115,y=55+Math.floor(n/3)*55;
      i+=`<rect x="${x-42}" y="${y-22}" width="84" height="44" rx="10" fill="#141a23" stroke="#343d4c"/>`;
      i+=svgShape2(shape,x,y,15,n===p.data.odd-1?'#d85d70':'none',n===p.data.odd-1?'#ffd3d9':'#e7ebf2',3);
      i+=`<text x="${x}" y="${y+5}" fill="#697487" font-size="9" text-anchor="middle">${n+1}</text>`;
    });
  } else if(p.kind==='countColor'){
    const map={RED:'#e86a78',BLUE:'#75a9ff',GREEN:'#70d6a1',GOLD:'#e7c66d'};
    p.data.colors.forEach((c,n)=>{
      const x=55+(n%6)*52,y=63+Math.floor(n/6)*74;
      i+=svgShape2('CIRCLE',x,y,16,map[c]||'#fff','#0d1219',2);
    });
  } else if(p.kind==='visualSequence'){
    p.data.sequence.forEach((shape,n)=>{
      const x=47+n*69;
      i+=`<rect x="${18+n*69}" y="76" width="58" height="68" rx="12" fill="#141a23" stroke="#343d4c"/>`;
      i+=svgShape2(shape,x,110,18,'none','#e7ecf3',3);
    });
    i+=`<rect x="328" y="76" width="24" height="68" rx="8" fill="#0d1219" stroke="#4a5567"/><text x="340" y="119" fill="#fff" font-size="24" text-anchor="middle">?</text>`;
  } else if(p.kind==='rotation'){
    const deg={UP:0,RIGHT:90,DOWN:180,LEFT:270}[p.data.start];
    i+=`<circle cx="180" cy="105" r="70" fill="#121821" stroke="#394352"/>`;
    i+=svgShape2('TRIANGLE',180,105,52,'#222a36','#eef2f7',4,deg);
    i+=`<text x="180" y="191" fill="#aeb6c4" font-size="12" text-anchor="middle">START: ${p.data.start} • ${p.data.turns} × 90° RIGHT</text>`;
  } else if(p.kind==='mirror'){
    i+=`<line x1="180" y1="25" x2="180" y2="195" stroke="#657287" stroke-dasharray="6 6"/><text x="180" y="15" fill="#8994a6" font-size="10" text-anchor="middle">MIRROR AXIS</text>`;
    p.data.pattern.forEach((shape,n)=>i+=svgShape2(shape,78+n*68,110,22,'none','#e8edf5',3));
  } else if(p.kind==='matrix'){
    const cells=p.data.grid;
    cells.forEach((shape,n)=>{
      const x=105+(n%2)*150,y=75+Math.floor(n/2)*92;
      i+=`<rect x="${x-45}" y="${y-35}" width="90" height="70" rx="12" fill="#141a23" stroke="#343d4c"/>`;
      i+=shape?svgShape2(shape,x,y,22,'none','#e8edf5',3):`<text x="${x}" y="${y+8}" fill="#fff" font-size="28" text-anchor="middle">?</text>`;
    });
  } else if(p.kind==='path'){
    const s=5,x0=100,y0=26,step=34,wall=new Set(p.data.walls.map(w=>w.join(',')));
    for(let r=0;r<s;r++)for(let c=0;c<s;c++){
      const blocked=wall.has(`${r},${c}`),fill=blocked?'#4d5563':'#131a23';
      i+=`<rect x="${x0+c*step}" y="${y0+r*step}" width="26" height="26" rx="6" fill="${fill}" stroke="#374151"/>`;
    }
    i+=`<text x="${x0+13}" y="${y0+19}" fill="#72e3ae" font-weight="800" font-size="11" text-anchor="middle">S</text><text x="${x0+4*step+13}" y="${y0+4*step+19}" fill="#f3c76c" font-weight="800" font-size="11" text-anchor="middle">E</text>`;
  } else if(p.kind==='symmetry'){
    const miss=p.data.missing;
    for(let r=0;r<3;r++)for(let c=0;c<6;c++){
      const mirror=(c<3?c:5-c),active=((r*2+mirror+p.id)%4===0);
      const x=48+c*53,y=53+r*50;
      if(active) i+=svgShape2('DIAMOND',x,y,12,'#dfe7f2','#dfe7f2',1);
      else i+=`<rect x="${x-17}" y="${y-17}" width="34" height="34" rx="7" fill="#111722" stroke="#2f3948"/>`;
    }
    i+=`<text x="${48+miss.charCodeAt(0)-65*0}" y="203" fill="#8390a3" font-size="10" text-anchor="middle">Choose the missing mirror tile</text>`;
  } else if(p.kind==='spatial'){
    const spots={UP:[180,55],RIGHT:[258,110],DOWN:[180,165],LEFT:[102,110]};
    const [x,y]=spots[p.data.direction];
    i+=svgShape2('CIRCLE',180,110,28,'#1d2734','#e7edf5',3);
    i+=svgShape2(p.data.shape,x,y,22,'#dfb95f','#0c1118',2);
    i+=`<text x="180" y="202" fill="#aeb6c3" font-size="11" text-anchor="middle">CIRCLE = CENTER</text>`;
  } else if(p.kind==='visualMath'){
    for(let n=0;n<p.data.count;n++){
      const x=46+(n%6)*53,y=65+Math.floor(n/6)*55;
      i+=`<text x="${x}" y="${y}" font-size="30" text-anchor="middle">${p.data.symbol}</text>`;
    }
    i+=`<text x="180" y="195" fill="#c7cfdb" font-size="13" text-anchor="middle">${p.data.count} × ${p.data.value}  ${p.data.op}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visual brain puzzle"><rect width="${W}" height="${H}" rx="18" fill="#0b1017"/>${i}</svg>`;
}
function imageChoiceMarkup(p){
  if(!p.choices) return `<input id="imageAnswer" class="answer image-answer" ${/^\d+$/.test(String(p.answer))?'inputmode="numeric"':''} autocomplete="off" placeholder="ANSWER"><button class="submit" id="imageCheck">CHECK</button>`;
  return `<div class="image-choice-grid">${p.choices.map(c=>`<button class="image-choice" data-value="${escAttr(c)}">${String(c).replace(/\|/g,' • ')}</button>`).join('')}</div>`;
}
function showImagePuzzle(){
  const p=imagePuzzles[current-1]||imagePuzzles[0];
  if(!p)return toast('Image puzzles are still loading.','wrong');
  const solved=!!imageSolved[p.id], modal=document.createElement('div');
  modal.className='image-puzzle-modal';
  modal.innerHTML=`<div class="image-puzzle-inner"><button class="modal-close" aria-label="Close">×</button><div class="image-puzzle-kicker">🧩 IMAGE PUZZLE ${p.id}/100 • CHAPTER ${chapterNumber(p.id)}</div><h2>${p.title}</h2><p>${p.question}</p><div class="image-art"><img class="image-puzzle-img" src="${p.image}" alt="Visual puzzle ${p.id}" loading="eager"></div>${imageChoiceMarkup(p)}<div class="image-result">${solved?'✅ Solved — replay anytime.':'Solve it for a bonus 🔑 key.'}</div></div>`;
  document.body.appendChild(modal);
  const inner=$('.image-puzzle-inner',modal);
  $('.modal-close',modal).onclick=()=>modal.remove();
  modal.onclick=e=>{if(e.target===modal)modal.remove()};
  const submit=(value)=>{
    if(normalize(value)===normalize(p.answer)){
      if(!imageSolved[p.id]){imageSolved[p.id]=1;keys++;saveImageSolved();persistMeta();save();toast('🧩 Image puzzle solved • +1 🔑','hint');}
      else toast('✅ Already solved.','hint');
      modal.remove();
    }else{
      inner.classList.remove('image-wrong'); void inner.offsetWidth; inner.classList.add('image-wrong');
      toast('✕ Look at the image more carefully.','wrong');
    }
  };
  $$('.image-choice',modal).forEach(b=>b.onclick=()=>submit(b.dataset.value));
  const check=$('#imageCheck',modal);
  if(check)check.onclick=()=>submit($('#imageAnswer',modal)?.value||'');
  $('#imageAnswer',modal)?.addEventListener('keydown',e=>{if(e.key==='Enter')$('#imageCheck',modal)?.click()});
}
function saveImageSolved(){localStorage.setItem('brain_image_solved',JSON.stringify(imageSolved));}
imagePuzzleBtn?.addEventListener('click',()=>{AUDIO?.playTap();showImagePuzzle();});
fetch('levels.json').then(r=>r.json()).then(data=>{levels=data;return fetch('image-puzzles/puzzles.json');}).then(r=>r.json()).then(data=>{imagePuzzles=data;persistMeta();render();}).catch(()=>toast('Could not load puzzle data.','wrong'));


function modal(html){
  const m = document.createElement('div');
  m.className = 'progress-modal';
  m.innerHTML = `<div class="settings-inner">${html}</div>`;
  document.body.appendChild(m);
  m.onclick = e => { if (e.target === m) m.remove(); };
  return m;
}
function showHub(){
  const maxOpen = current;
  const cells = levels.map((l,i)=>{
    const n=i+1; const locked = n>maxOpen;
    const st = stars[n] || 0;
    return `<button class="candy ${n<current?'done':''} ${n===current?'current':''} ch${Math.ceil(n/10)}" ${locked?'disabled':''} data-n="${n}"><span>${n}</span><small>${'★'.repeat(st)}${'☆'.repeat(st?3-st:0)}</small></button>`;
  }).join('');
  const m = modal(`<h2>${t('map')}</h2><p>Fast clear = 3 stars. 1st hint = max 2 stars, later hints = 1 star.</p><div class="candy-path">${cells}</div>`);
  m.querySelectorAll('.candy').forEach(b=>b.onclick=()=>{
    dailyMode=false; current=Number(b.dataset.n); resetAttempts(); save(); m.remove(); render('slide-in');
  });
}
function dailyIndex(){
  const d=new Date(); const key=d.getFullYear()*1000+ (d.getMonth()+1)*40 + d.getDate();
  return (key % 100) + 1;
}
function showDaily(){
  const id = dailyIndex();
  const done = localStorage.getItem('brain_daily') === new Date().toDateString();
  const m = modal(`<h2>${t('daily')}</h2><p>Door #${id} ${done?'already cleared today.':'is live for today.'}</p><button class="submit" id="playDaily">${done?'Replay':'Play'}</button>`);
  m.querySelector('#playDaily').onclick=()=>{ dailyMode=true; current=id; resetAttempts(); m.remove(); render('slide-in'); };
}
function showSettings(){
  const m = modal(`<h2>${t('settings')}</h2>
    <div class="row"><span>Language</span><div class="seg"><button data-lang="en">EN</button><button data-lang="bn">বাংলা</button></div></div>
    <div class="row"><span>Vibration</span><button id="vib">${vibrateOn?'On':'Off'}</button></div>
    <div class="row"><span>Door skin (2 keys)</span><div class="seg"><button data-skin="wood">Wood</button><button data-skin="metal">Metal</button><button data-skin="glass">Glass</button></div></div>
    <div class="achieve"><b>Achievements</b>${['ten_stars','streak_5','streak_10','clean_solve'].map(a=>`<small>${achievements.includes(a)?'✅':'⬜'} ${a.replaceAll('_',' ')}</small>`).join('')}</div>`);
  m.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{ lang=b.dataset.lang; persistMeta(); m.remove(); render(); });
  m.querySelector('#vib').onclick=()=>{ vibrateOn=!vibrateOn; persistMeta(); m.remove(); showSettings(); };
  m.querySelectorAll('[data-skin]').forEach(b=>b.onclick=()=>{
    if (doorSkin===b.dataset.skin) return;
    if (keys<2) return toast('Need 2 keys', 'wrong');
    keys-=2; doorSkin=b.dataset.skin; persistMeta(); render(); m.remove();
  });
}
document.getElementById('hubBtn')?.addEventListener('click', showHub);
document.getElementById('dailyBtn')?.addEventListener('click', showDaily);
document.getElementById('settingsBtn')?.addEventListener('click', showSettings);
document.getElementById('keysBtn')?.addEventListener('click', ()=>{
  if (keys<1) return toast(t('keys'), 'hint');
  keys--; hints++; persistMeta(); save(); toast('+1 hint', 'hint');
});
persistMeta();
