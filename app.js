// Страница-визитка: ссылки (site.json), репертуар (songs.json), сбор на ремонт (repair.json — сумму обновляет da-listen на Маке), «в эфире» (ntfy)
const $ = s => document.querySelector(s)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const safeUrl = u => /^https:\/\//i.test(String(u || '')) ? esc(u) : '#'
const fmt = n => n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',').replace(/,0$/, '') + 'K' : String(n)
let SITE = {}, SONGS = []

async function getJson(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Math.floor(Date.now() / 30000), { cache: 'no-store' })
  if (!r.ok) throw new Error(r.status)
  return r.json()
}

function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true }, 2200)
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text) } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove()
  }
  toast('Скопировано ✓')
}

function renderLinks() {
  const out = [`<button class="btn main" data-go="songs"><span class="ic">🎶</span><span class="tx">Заказать песню<small>Репертуар — выбери, что спеть</small></span></button>`,
    `<a class="btn" href="queue.html"><span class="ic">📋</span><span class="tx">Очередь<small>Что поётся сейчас, кто что заказал</small></span></a>`,
    `<a class="btn" href="top.html"><span class="ic">🔥</span><span class="tx">Топ песен<small>Что чаще всего поют и заказывают</small></span></a>`]
  for (const l of SITE.links || []) {
    if (!l.url) continue
    out.push(`<a class="btn" href="${safeUrl(l.url)}" target="_blank" rel="noopener"><span class="ic">${esc(l.icon || '🔗')}</span><span class="tx">${esc(l.title)}${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</span></a>`)
  }
  $('#links').innerHTML = out.join('')
  $('#foot-tt').href = SITE.tiktok
}

function renderSongs() {
  const q = $('#q').value.trim().toLowerCase()
  const list = SONGS.filter(s => !q || (s.artist + ' ' + s.title).toLowerCase().includes(q))
  let last = ''
  $('#list').innerHTML = list.length ? list.map(s => {
    const L = (s.artist || s.title).trim()[0]?.toUpperCase() || ''
    const head = !q && L !== last ? `<div class="letter">${esc(last = L)}</div>` : ''
    return `${head}<div class="song"><span class="nm">${esc(s.title)}<small>${esc(s.artist)}</small></span><button data-order="${esc(s.id)}">Заказать</button></div>`
  }).join('') : '<p class="hint">Такой песни пока нет — напиши её в чат эфира — посмотрю 😉</p>'
}

function openOrder(song) {
  const name = `${song.artist ? song.artist + ' — ' : ''}${song.title}`
  const chat = `!песня ${song.title}`
  const daMsg = `🎵 ${name}`
  const ways = []
  if (SITE.ordersTopic) ways.push(`<div class="way"><h4>🎶 Заказать отсюда — бесплатно</h4>
    <p>Во время эфира песня встанет в общую очередь, вне эфира — в заявки на следующий эфир. Один заказ раз в 10 минут.</p>
    <input class="nick" id="nick" maxlength="30" placeholder="Твой ник в TikTok" value="${esc(localStorage.nick || '')}">
    <button class="go" data-send="${esc(song.id)}">Заказать</button>
    <p class="hint" id="sent" hidden></p></div>`)
  if (SITE.da) ways.push(`<div class="way"><h4>💛 Донатом — песня следующей</h4>
    <p>От ${esc(SITE.daNextRub)} ₽ — спою сразу после текущей. Твоё сообщение прозвучит в эфире голосом. Вставь в сообщение к донату:</p>
    <div class="cmd"><span>${esc(daMsg)}</span><button class="go alt" data-copy="${esc(daMsg)}">Копировать</button></div>
    <a class="go" href="${safeUrl(SITE.da)}" target="_blank" rel="noopener" data-copyfirst="${esc(daMsg)}">Открыть донат</a></div>`)
  ways.push(`<div class="way"><h4>🎁 Подарком в эфире — песня следующей</h4>
    <p>Зайди в эфир, напиши в чат команду и отправь подарки от ${esc(SITE.coinsNext)} монет — песня встанет следующей. Меньше — поднимется в очереди.</p>
    <div class="cmd"><span>${esc(chat)}</span><button class="go alt" data-copy="${esc(chat)}">Копировать</button></div>
    <a class="go" href="${safeUrl(SITE.live)}" target="_blank" rel="noopener" data-copyfirst="${esc(chat)}">Открыть эфир</a></div>`)
  ways.push(`<div class="way"><h4>💬 Из чата</h4>
    <p>Можно и прямо в эфире: напиши эту же команду в чат — песня встанет в общую очередь.</p></div>`)
  $('#s-title').textContent = name
  $('#s-body').innerHTML = ways.join('')
  $('#sheet').hidden = false
}

// заказ уходит в ntfy-тему; Мак забирает его за ~5 с и ставит в очередь (scripts/site-publish.mjs в karaoke)
async function sendOrder(btn) {
  const nick = $('#nick').value.trim().replace(/^@/, '')
  if (!nick) { $('#nick').focus(); return toast('Напиши свой ник') }
  localStorage.nick = nick
  btn.disabled = true; btn.textContent = 'Отправляю…'
  const out = $('#sent')
  try {
    const r = await fetch('https://ntfy.sh/' + encodeURIComponent(SITE.ordersTopic), { method: 'POST', body: JSON.stringify({ songId: btn.dataset.send, by: nick }) })
    if (!r.ok) throw new Error(r.status)
    btn.textContent = 'Отправлено ✓'
    out.hidden = false
    out.innerHTML = 'Заказ принят! Через несколько секунд он появится в <a href="queue.html">очереди</a> (если идёт эфир).'
  } catch {
    btn.disabled = false; btn.textContent = 'Заказать'
    out.hidden = false; out.textContent = 'Не отправилось — проверь интернет и попробуй ещё раз.'
  }
}

function renderLive(L) {
  const on = !!(L && L.live && Date.now() - (L.at || 0) < 10 * 60000)
  $('#live').hidden = !on
  if (on && L.likes != null) $('#live-t').textContent = `Сейчас в эфире · ${fmt(L.likes)} ❤`
}

// сбор на ремонт: repair.json {goal, raised} — da-listen прибавляет каждый донат и публикует
function renderRepair(R) {
  $('#r-da').href = safeUrl(SITE.da)
  $('#r-tt').href = safeUrl(SITE.tiktok)
  if (!R || !(R.goal > 0)) return
  const rub = n => Math.round(n).toLocaleString('ru-RU') + ' ₽'
  $('#g-bar').style.width = Math.min(100, (R.raised || 0) / R.goal * 100) + '%'
  $('#g-raised').textContent = rub(R.raised || 0)
  $('#g-goal').textContent = rub(R.goal)
  const pc = Math.min(100, (R.raised || 0) / R.goal * 100)
  $('#g-pct').textContent = (pc > 0 && pc < 10 ? pc.toFixed(1).replace('.', ',') : String(Math.floor(pc))) + '%'
  $('#goal').hidden = false
}

// эфир публикует Мак (scripts/site-publish.mjs live) в ntfy.sh: берём последнее сообщение темы
async function pollLive() {
  if (!SITE.ntfyTopic) return renderLive(null)
  try {
    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(SITE.ntfyTopic)}/json?poll=1&since=latest`, { cache: 'no-store' })
    const lines = (await r.text()).trim().split('\n').filter(Boolean)
    const m = lines.length ? JSON.parse(lines[lines.length - 1]) : null
    renderLive(m && m.message ? JSON.parse(m.message) : null)
  } catch { renderLive(null) }
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-order],[data-copy],[data-copyfirst],[data-send],[data-close],#sheet')
  if (!t) return
  if (t.dataset.send) return sendOrder(t)
  if (t.dataset.go) { document.getElementById(t.dataset.go).scrollIntoView({ behavior: 'smooth' }); setTimeout(() => $('#q').focus({ preventScroll: true }), 500) }
  else if (t.dataset.order) { const s = SONGS.find(x => String(x.id) === t.dataset.order); if (s) openOrder(s) }
  else if (t.dataset.copy) copy(t.dataset.copy)
  else if (t.dataset.copyfirst) copy(t.dataset.copyfirst)   // ссылка всё равно откроется — текст уже в буфере
  else if ('close' in t.dataset || e.target === t) $('#sheet').hidden = true
})
$('#q').addEventListener('input', renderSongs)

;(async () => {
  try { SITE = await getJson('site.json') } catch { SITE = {} }
  SITE.tiktok ||= 'https://www.tiktok.com/@sun_singer'
  SITE.live ||= SITE.tiktok + '/live'
  SITE.coinsNext ||= 100
  renderLinks()
  renderRepair(await getJson('repair.json').catch(() => null))
  try {
    SONGS = await getJson('songs.json')
    SONGS.sort((a, b) => (a.artist || a.title).localeCompare(b.artist || b.title, 'ru'))
    $('#count').textContent = SONGS.length + ' песен'
  } catch { SONGS = [] }
  renderSongs()
  pollLive(); setInterval(pollLive, 30000)
})()
