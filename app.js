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

// значки соцсетей: в site.json у ссылки "brand": "tiktok" | "telegram" | "youtube" (иначе — эмодзи из "icon")
const BRAND = {
  tiktok: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M20.7 4.3 2.9 11.2c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14.2c.3-1.2-.5-1.8-1.5-1.3zM8.6 13.8l9.6-6.1c.5-.3.9-.1.5.2l-7.9 7.2-.3 3.3-1.9-4.6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M10 15.5v-7l6 3.5-6 3.5z"/></svg>',
}
function renderLinks() {
  const out = [`<a class="btn main" href="#songs"><span class="ic">🎶</span><span class="tx">Репертуар · заказать песню<small>${SONGS.length ? SONGS.length + ' песен — ' : ''}выбери, что спеть</small></span></a>`]
  for (const l of SITE.links || []) {
    if (!l.url) continue
    const inner = String(l.url).startsWith('#')               // ссылка на блок этой же страницы
    const ic = BRAND[l.brand] ? `<span class="ic brand ${esc(l.brand)}">${BRAND[l.brand]}</span>` : `<span class="ic">${esc(l.icon || '🔗')}</span>`
    out.push(`<a class="btn" href="${inner ? esc(l.url) : safeUrl(l.url)}"${inner ? '' : ' target="_blank" rel="noopener"'}>${ic}<span class="tx">${esc(l.title)}${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</span></a>`)
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
  }).join('') : '<p class="hint">Такой песни пока нет в списке — нажми «Закажи свою» выше 😉</p>'
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

// своя песня (нет в репертуаре): уходит в ту же ntfy-тему как {custom, by}; Мак кладёт её в «Заявки гостей» караоке
function openCustom() {
  $('#s-title').textContent = 'Своя песня'
  $('#s-body').innerHTML = SITE.ordersTopic ? `<div class="way">
    <p>Напиши исполнителя и название — заказ увижу я, в списке на сайте его не будет. Если песни нет в моём караоке, спою, когда выучу.</p>
    <input class="nick" id="csong" maxlength="100" placeholder="Исполнитель — песня" value="${esc($('#q').value.trim())}">
    <input class="nick" id="nick" maxlength="30" placeholder="Твой ник в TikTok" value="${esc(localStorage.nick || '')}">
    <button class="go" data-send="custom">Отправить</button>
    <p class="hint" id="sent" hidden></p></div>` : '<p class="hint">Напиши название в чат эфира — посмотрю 😉</p>'
  $('#sheet').hidden = false
}

// заказ уходит в ntfy-тему; Мак забирает его за ~5 с и ставит в очередь (scripts/site-publish.mjs в karaoke)
async function sendOrder(btn) {
  const nick = $('#nick').value.trim().replace(/^@/, '')
  if (!nick) { $('#nick').focus(); return toast('Напиши свой ник') }
  const custom = btn.dataset.send === 'custom' ? $('#csong').value.trim() : ''
  if (btn.dataset.send === 'custom' && custom.length < 3) { $('#csong').focus(); return toast('Напиши, какую песню спеть') }
  localStorage.nick = nick
  btn.disabled = true; btn.textContent = 'Отправляю…'
  const out = $('#sent')
  try {
    const r = await fetch('https://ntfy.sh/' + encodeURIComponent(SITE.ordersTopic), { method: 'POST', body: JSON.stringify(custom ? { custom, by: nick } : { songId: btn.dataset.send, by: nick }) })
    if (!r.ok) throw new Error(r.status)
    btn.textContent = 'Отправлено ✓'
    out.hidden = false
    out.innerHTML = custom ? 'Заказ отправлен — я его увижу 💛' : 'Заказ принят! Через несколько секунд он появится в <a href="queue.html">очереди</a> (если идёт эфир).'
  } catch {
    btn.disabled = false; btn.textContent = 'Заказать'
    out.hidden = false; out.textContent = 'Не отправилось — проверь интернет и попробуй ещё раз.'
  }
}

function renderLive(L) {
  const on = !!(L && L.live && Date.now() - (L.at || 0) < 10 * 60000)
  $('#live').hidden = !on
  $('#live').href = safeUrl(SITE.live)
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
  $('#g-pct').textContent = (pc <= 0 ? '0' : pc < 0.1 ? '<0,1' : pc < 10 ? (Math.floor(pc * 10) / 10).toFixed(1).replace('.', ',') : String(Math.floor(pc))) + '%'
  const zero = !(R.raised > 0)                              // «0 ₽ · 0%» отпугивает — вместо этого зовём быть первым
  $('#g-goal0').textContent = rub(R.goal)
  $('#g-line').hidden = zero; $('#g-zero').hidden = !zero; $('.bar').hidden = zero
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
  if (e.target.closest('#custom')) return openCustom()
  const t = e.target.closest('[data-order],[data-copy],[data-copyfirst],[data-send],[data-close],#sheet')
  if (!t) return
  if (t.dataset.send) return sendOrder(t)
  if (t.dataset.order) { const s = SONGS.find(x => String(x.id) === t.dataset.order); if (s) openOrder(s) }
  else if (t.dataset.copy) copy(t.dataset.copy)
  else if (t.dataset.copyfirst) copy(t.dataset.copyfirst)   // ссылка всё равно откроется — текст уже в буфере
  else if ('close' in t.dataset || e.target === t) $('#sheet').hidden = true
})
$('#q').addEventListener('input', renderSongs)

// ссылки Taplink ведут на #songs и #repair — показываем только этот раздел, без кнопок-дублей шапки
function route() {
  const p = location.hash.slice(1)
  document.body.className = p === 'songs' || p === 'repair' ? 'pg pg-' + p : ''
  window.scrollTo(0, 0)
}
addEventListener('hashchange', route)
route()
addEventListener('load', () => { if (document.body.className) scrollTo(0, 0) })   // браузер сам прыгает к якорю после загрузки

;(async () => {
  try { SITE = await getJson('site.json') } catch { SITE = {} }
  SITE.tiktok ||= 'https://www.tiktok.com/@sun_singer'
  SITE.live ||= SITE.tiktok + '/live'
  SITE.coinsNext ||= 200
  renderLinks()
  if (SITE.home) $('#home').href = SITE.home
  renderRepair(await getJson('repair.json').catch(() => null))
  try {
    SONGS = await getJson('songs.json')
    SONGS.sort((a, b) => (a.artist || a.title).localeCompare(b.artist || b.title, 'ru'))
    $('#count').textContent = SONGS.length + ' песен'
  } catch { SONGS = [] }
  renderLinks()                                             // ещё раз — с числом песен на кнопке
  renderSongs()
  pollLive(); setInterval(pollLive, 30000)
})()
