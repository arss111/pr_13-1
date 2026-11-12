/* Логика приглашения: детали, обратный отсчёт, форма ответа → Google-таблица. Настройки — в config.js */
(function () {
  "use strict";
  const P = window.PARTY || {};
  const T = window.INVITE_THEME || {};
  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LS_ID = "invite_rsvp_id", LS_SENT = "invite_rsvp_sent_v2";
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
  };
  const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return f[2]; if (b > 1 && b < 5) return f[1]; if (b === 1) return f[0]; return f[2]; };
  const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

  // ---------- Даты ----------
  const startIso = P.date + "T" + (P.time || "00:00") + ":00" + (P.utcOffset || "+03:00");
  const eventStart = new Date(startIso);
  const noon = new Date(P.date + "T12:00:00Z");
  const dateText = noon.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  const weekday = noon.toLocaleDateString("ru-RU", { weekday: "long", timeZone: "UTC" });
  const Weekday = weekday[0].toUpperCase() + weekday.slice(1);
  const mapUrl = P.mapUrl || "https://yandex.ru/maps/?text=" + encodeURIComponent([P.city, P.address, (P.place || "").replace(/[«»]/g, "")].filter(Boolean).join(", "));
  const DRINKS = P.drinks || [], ATT = P.attending || [];
  const label = (id, list) => (list.find((x) => x.id === id) || {}).label || id;

  const ICON = {
    pin: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    cal: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    vodka: '<svg viewBox="0 0 64 64"><path d="M27 5h10v9l5 6v36a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3V20l5-6z"/><path d="M22 30h20v14H22z"/><path d="M27 9h10"/></svg>',
    prosecco: '<svg viewBox="0 0 64 64"><path d="M26 6h12l-1 22a5 5 0 0 1-10 0z"/><path d="M32 33v19M25 56h14"/><circle cx="31" cy="20" r="1.2"/><circle cx="34" cy="14" r="1.2"/><circle cx="30" cy="11" r="1"/></svg>',
    champagne: '<svg viewBox="0 0 64 64"><path d="M13 22h38c0 10-8 15-19 15S13 32 13 22z"/><path d="M32 37v15M23 56h18"/><path d="M24 6l3 6M40 6l-3 6M32 3v7"/></svg>',
    wine: '<svg viewBox="0 0 64 64"><path d="M21 6h22c1 14-3 24-11 24S20 20 21 6z"/><path d="M21.6 16h20.8"/><path d="M32 30v22M23 56h18"/></svg>',
    other: '<svg viewBox="0 0 64 64"><path d="M10 10h32L26 30z"/><path d="M26 30v20M18 54h16"/><path d="M38 50l14-14 6 6-14 14-7 1z"/><path d="M48 40l6 6"/></svg>',
    none: '<svg viewBox="0 0 64 64"><path d="M19 18h26l-3.5 38h-19z"/><path d="M38 4l-5 14"/><path d="M21 30h22"/><circle cx="46" cy="16" r="7"/><path d="M46 9v14M39 16h14"/></svg>',
  };
  const THANKS_ICON = {
    yes: '<svg viewBox="0 0 64 64"><g transform="rotate(-14 22 34)"><path pathLength="1" d="M17 10h10l-1 17a4 4 0 0 1-8 0z"/><path pathLength="1" d="M22 31v15M17 46h10"/></g><g transform="rotate(14 42 34)"><path pathLength="1" d="M37 10h10l-1 17a4 4 0 0 1-8 0z"/><path pathLength="1" d="M42 31v15M37 46h10"/></g><path class="late" pathLength="1" d="M32 2v6M24 5l3 4M40 5l-3 4"/></svg>',
    maybe: '<svg viewBox="0 0 64 64"><path pathLength="1" d="M18 8h28M18 56h28"/><path pathLength="1" d="M21 8c0 13 22 15 22 24S21 43 21 56M43 8c0 13-22 15-22 24s22 11 22 24"/><path class="late" pathLength="1" d="M27 50h10"/></svg>',
    no: '<svg viewBox="0 0 64 64"><path pathLength="1" d="M8 18h48v32H8z"/><path pathLength="1" d="M8 18l24 19 24-19"/><path class="late" pathLength="1" d="M8 50l18-15M56 50L38 35"/></svg>',
  };
  const ATT_HINT = { yes: "Уже предвкушаю", maybe: "Отвечу позже по этой же ссылке", no: "Но мысленно буду с вами" };

  // ---------- Разметка блоков ----------
  function mountDetails() {
    const m = $("detailsMount"); if (!m) return;
    m.innerHTML = `
      <div class="details">
        <div class="card detail reveal"><span class="label">Дата</span><span class="value" id="dDate"></span><span class="note" id="dWeekday"></span></div>
        <div class="card detail time-card reveal" style="--d:1"><span class="label">Начало</span><span class="value" id="dTime"></span><span class="note" id="dTimeNote"></span></div>
        <div class="card detail wide reveal" style="--d:2"><span class="label">Место</span><span class="value" id="dPlace"></span><span class="note" id="dAddress"></span>
          <div class="actions">
            <a class="btn btn-ghost btn-sm" id="mapLink" target="_blank" rel="noopener">${ICON.pin}Открыть в Яндекс Картах</a>
            <button class="btn btn-ghost btn-sm calBtn" type="button">${ICON.cal}В календарь</button>
          </div>
        </div>
        <div class="card detail wide reveal" id="dressCard" hidden><span class="label">Дресс-код</span><span class="value" id="dDress"></span></div>
        <div class="card detail wide reveal" id="infoCard" hidden><span class="label">Важно</span><span class="note" id="dInfo" style="font-size:16px"></span></div>
      </div>`;
  }

  function mountCountdown() {
    const m = $("countdownMount"); if (!m) return;
    m.innerHTML = `<div class="countdown" id="countdown" style="grid-template-columns:repeat(3,1fr)">${["d", "h", "m"].map((u, i) =>
      `<div class="card unit reveal" style="--d:${i}"><div class="num" id="cd_${u}">0</div><div class="cap" id="cap_${u}"></div></div>`).join("")}</div>`;
  }

  function mountRsvp() {
    const m = $("rsvpMount"); if (!m) return;
    m.innerHTML = `
      <div class="card form-card reveal" id="formCard">
        <form id="rsvpForm" novalidate>
          <div class="field">
            <label class="field-label" for="name">Как тебя зовут? <span class="req">*</span></label>
            <input type="text" id="name" autocomplete="name" placeholder="Имя и фамилия" maxlength="80">
            <div class="error-text" id="nameErr" hidden>Пожалуйста, представься</div>
          </div>
          <div class="field">
            <span class="field-label">Сможешь прийти? <span class="req">*</span></span>
            <div class="choices" role="radiogroup">
              ${ATT.map((a) => `<label class="choice"><input type="radio" name="attending" value="${a.id}"><span><span>${a.label}<small>${ATT_HINT[a.id] || ""}</small></span></span></label>`).join("")}
            </div>
            <div class="error-text" id="attErr" hidden>Выбери вариант</div>
          </div>
          <div class="collapsible closed" id="comingBlock">
            <div class="field">
              <span class="field-label">Сколько вас будет?</span>
              <p class="hint">Считая тебя — например, с парой или с детьми</p>
              <div class="stepper-row">
                <div class="stepper">
                  <button type="button" id="minus" aria-label="Меньше">−</button>
                  <output id="count" aria-live="polite">1</output>
                  <button type="button" id="plus" aria-label="Больше">+</button>
                </div>
                <span class="muted" id="countWord">только я</span>
              </div>
            </div>
            <div class="field">
              <span class="field-label">Предпочтения по напиткам</span>
              <p class="hint" id="drinksHint">Меню уже готово. Можно выбрать несколько вариантов</p>
              <div class="drinks" id="drinks"></div>
              <div class="collapsible closed" id="otherBlock"><div style="padding-top:10px"><input type="text" id="drinkOther" placeholder="Напиши свой вариант: например, виски или морс" maxlength="80"></div></div>
              <div class="error-text" id="drinkErr" hidden></div>
            </div>
          </div>
          <input class="hp" id="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
          <button class="btn btn-block" type="submit" id="submitBtn">Отправить ответ</button>
          <div class="form-error" id="formErr" hidden></div>
          <p class="form-note" id="deadlineNote">Ответ можно будет изменить по этой же ссылке.</p>
        </form>
      </div>
      <div class="card thanks" id="thanks" hidden>
        <div class="thanks-icon" id="thanksIcon"></div>
        <h2 id="thanksTitle">Спасибо!</h2>
        <p id="thanksText"></p>
        <dl class="summary" id="summary"></dl>
        <div class="row">
          <button class="btn btn-ghost" type="button" id="editBtn">Изменить ответ</button>
          <button class="btn btn-ghost calBtn" type="button" id="calBtn2">${ICON.cal}В календарь</button>
        </div>
      </div>`;
  }

  // ---------- Заполнение текста ----------
  function fill() {
    setText("age", P.age || "");
    if (P.name) { setText("heroTitle", P.name); setText("heroSub", "приглашает на свой день рождения"); }
    else if ($("heroSub")) $("heroSub").hidden = true;
    setText("badgeDate", dateText);
    setText("badgeWeekday", weekday);
    setText("message", P.message || "");
    setText("dDate", dateText);
    setText("dWeekday", Weekday);
    setText("dTime", P.time || "Скоро");
    setText("dTimeNote", P.time ? "" : "Время сообщим дополнительно");
    if (P.time && $("dTimeNote")) $("dTimeNote").hidden = true;
    setText("dPlace", P.place || "");
    setText("dAddress", [P.city, P.address].filter(Boolean).join(", "));
    setText("placeInline", P.place || "");
    if ($("mapLink")) $("mapLink").href = mapUrl;
    if (P.dressCode) { setText("dDress", P.dressCode); $("dressCard").hidden = false; }
    if (P.extraInfo) { setText("dInfo", P.extraInfo); $("infoCard").hidden = false; }
    if (P.rsvpDeadline) setText("deadlineNote", `Пожалуйста, ответь до ${P.rsvpDeadline}. Ответ можно будет изменить.`);
    if (P.contact && $("contactLine")) { $("contactLine").hidden = false; $("contactLine").textContent = "Вопросы: " + P.contact; }
    if (!P.scriptUrl && $("demoBanner")) $("demoBanner").hidden = false;
  }

  // ---------- Обратный отсчёт: дни, часы, минуты ----------
  const last = {};
  function setNum(u, v) {
    const e = $("cd_" + u); if (!e || last[u] === v) return;
    last[u] = v; e.textContent = v;
    if (!reduced) { e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); }
  }
  function tick() {
    const box = $("countdown"); if (!box) return false;
    let diff = eventStart - new Date();
    if (diff <= 0) { box.innerHTML = '<div class="card unit done">Праздник уже начался!</div>'; return false; }
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);
    setNum("d", String(d)); setNum("h", String(h).padStart(2, "0")); setNum("m", String(m).padStart(2, "0"));
    setText("cap_d", plural(d, ["день", "дня", "дней"]));
    setText("cap_h", plural(h, ["час", "часа", "часов"]));
    setText("cap_m", plural(m, ["минута", "минуты", "минут"]));
    return true;
  }

  // ---------- Календарь ----------
  function downloadIcs() {
    const z = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//birthday-invite//RU", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:birthday-" + P.date + "@invite", "DTSTAMP:" + z(new Date()), "DTSTART:" + z(eventStart), "DTEND:" + z(new Date(eventStart.getTime() + 5 * 36e5)),
      "SUMMARY:" + esc("День рождения — " + (P.name || "")), "LOCATION:" + esc([P.place, P.city, P.address].filter(Boolean).join(", ")),
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + esc("Завтра день рождения!"), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = "den-rozhdeniya.ics"; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- Раскрывающиеся блоки ----------
  function toggle(el, open) {
    const closed = el.classList.contains("closed");
    if (open && closed) {
      el.classList.remove("closed");
      el.style.maxHeight = el.scrollHeight + "px";
      const done = () => { if (!el.classList.contains("closed")) el.style.maxHeight = "none"; };
      el.addEventListener("transitionend", done, { once: true });
      setTimeout(done, 500);
    } else if (!open && !closed) {
      el.style.maxHeight = el.scrollHeight + "px";
      void el.offsetHeight;
      el.classList.add("closed");
    }
  }

  // ---------- Форма ----------
  const maxGuests = Math.max(1, P.maxGuests || 10);
  let count = 1;
  const drinks = new Set();

  function renderDrinkCards() {
    const box = $("drinks");
    DRINKS.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "drink"; b.dataset.v = d.id; b.setAttribute("aria-pressed", "false");
      b.innerHTML = (ICON[d.id] || "") + '<span class="tick">' + ICON.tick + "</span>";
      b.append(d.label);
      b.addEventListener("click", () => {
        // Любые варианты сочетаются: если пришли вдвоём, один может пить водку, другой — шампанское
        drinks.has(d.id) ? drinks.delete(d.id) : drinks.add(d.id);
        $("drinkErr").hidden = true;
        renderDrinks();
        if (d.id === "other" && drinks.has("other")) setTimeout(() => $("drinkOther").focus({ preventScroll: true }), 120);
      });
      box.appendChild(b);
    });
  }
  function renderDrinks() {
    document.querySelectorAll("#drinks .drink").forEach((b) => { const on = drinks.has(b.dataset.v); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    toggle($("otherBlock"), drinks.has("other"));
  }

  function setCount(n) {
    const prev = count;
    count = Math.min(maxGuests, Math.max(1, n));
    const out = $("count"); out.textContent = count;
    if (prev !== count && !reduced) { out.classList.remove("bump"); void out.offsetWidth; out.classList.add("bump"); }
    $("minus").disabled = count <= 1; $("plus").disabled = count >= maxGuests;
    $("countWord").textContent = count === 1 ? "только я" : `я + ${count - 1} ${plural(count - 1, ["гость", "гостя", "гостей"])}`;
    $("drinksHint").textContent = count > 1
      ? `Вас будет ${count} — отметь напитки для всех, можно несколько вариантов`
      : "Меню уже готово. Можно выбрать несколько вариантов";
  }

  const attendingValue = () => { const r = document.querySelector('input[name="attending"]:checked'); return r ? r.value : ""; };
  function onAttendingChange() {
    const v = attendingValue();
    toggle($("comingBlock"), v === "yes" || v === "maybe");
    $("attErr").hidden = true;
  }

  function clientId() {
    let id = store.get(LS_ID);
    if (!id) { id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); store.set(LS_ID, id); }
    return id;
  }

  function collect() {
    const attending = attendingValue(), coming = attending && attending !== "no";
    const list = coming ? DRINKS.map((d) => d.id).filter((id) => drinks.has(id)) : [];
    return {
      clientId: clientId(), name: $("name").value.trim(), attending,
      guests: coming ? count : 0, drinks: list,
      drinkOther: list.includes("other") ? $("drinkOther").value.trim() : "",
      website: $("website").value,
    };
  }

  function validate(d) {
    let first = null;
    const bad = !d.name || !/\p{L}/u.test(d.name);
    $("name").classList.remove("invalid"); void $("name").offsetWidth; $("name").classList.toggle("invalid", bad);
    $("nameErr").hidden = !bad; if (bad) first = first || $("name");
    $("attErr").hidden = !!d.attending; if (!d.attending) first = first || document.querySelector('input[name="attending"]');
    if (d.attending && d.attending !== "no") {
      let msg = "";
      if (!d.drinks.length) msg = "Выбери хотя бы один вариант";
      else if (d.drinks.includes("other") && !d.drinkOther) msg = "Напиши свой вариант напитка";
      $("drinkErr").hidden = !msg; $("drinkErr").textContent = msg;
      if (msg) first = first || (d.drinks.includes("other") ? $("drinkOther") : $("drinks"));
    }
    if (first) { first.closest(".field").scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
    return true;
  }

  let sending = false;
  async function onSubmit(e) {
    e.preventDefault();
    if (sending) return; // защита от повторного нажатия
    const d = collect();
    if (!validate(d)) return;
    const btn = $("submitBtn");
    sending = true; btn.disabled = true; btn.textContent = "Отправляем…"; $("formErr").hidden = true;
    try {
      if (!P.scriptUrl) throw new Error("Приглашение ещё не подключено к таблице ответов");
      // Простой запрос без заголовка Content-Type — так Google Apps Script принимает его без лишних проверок браузера
      const res = await fetch(P.scriptUrl, { method: "POST", body: JSON.stringify({ action: "rsvp", ...d }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "Не получилось отправить");
      const sent = { name: d.name, attending: d.attending, guests: d.guests, drinks: d.drinks, drinkOther: d.drinkOther };
      store.set(LS_SENT, sent);
      showThanks(sent, true);
    } catch (err) {
      $("formErr").hidden = false;
      $("formErr").textContent = navigator.onLine === false ? "Нет интернета. Проверь связь и попробуй ещё раз." : (err.message || "Не получилось отправить, попробуй ещё раз");
    } finally {
      sending = false; btn.disabled = false; btn.textContent = "Отправить ответ";
    }
  }

  function showThanks(s, animate) {
    const t = {
      yes: ["Спасибо, ждём тебя!", `${s.name}, до встречи ${dateText}${P.time ? " в " + P.time : ""}!`],
      maybe: ["Спасибо за ответ!", `${s.name}, надеемся, что получится. Когда будешь знать точно, просто измени ответ по этой же ссылке.`],
      no: ["Жаль, что не получится", `Спасибо за ответ, ${s.name}! Будем вспоминать тебя за праздничным столом.`],
    }[s.attending] || ["Спасибо!", ""];
    $("thanksIcon").innerHTML = THANKS_ICON[s.attending] || THANKS_ICON.yes;
    setText("thanksTitle", t[0]); setText("thanksText", t[1]);
    const rows = [["Ответ", label(s.attending, ATT)]];
    if (s.attending !== "no") {
      rows.push(["Вас будет", String(s.guests)]);
      const list = (s.drinks || []).filter((x) => x !== "other").map((x) => label(x, DRINKS));
      if (s.drinkOther) list.push(s.drinkOther);
      if (list.length) rows.push(["Напитки", list.join(", ")]);
    }
    const dl = $("summary"); dl.innerHTML = "";
    rows.forEach(([k, v]) => { const dt = document.createElement("dt"); dt.textContent = k; const dd = document.createElement("dd"); dd.textContent = v; dl.append(dt, dd); });
    $("calBtn2").hidden = s.attending === "no";
    $("formCard").hidden = true;
    const th = $("thanks"); th.hidden = false; th.classList.remove("pop"); void th.offsetWidth; th.classList.add("pop");
    setText("rsvpTitle", "Спасибо за ответ");
    if (animate) {
      $("rsvp").scrollIntoView({ behavior: "smooth" });
      if (s.attending === "yes") setTimeout(() => confetti(), 350);
    }
  }

  function edit() {
    const s = store.get(LS_SENT) || {};
    $("name").value = s.name || "";
    const r = document.querySelector(`input[name="attending"][value="${s.attending}"]`); if (r) r.checked = true;
    setCount(s.guests || 1);
    drinks.clear(); (s.drinks || []).forEach((x) => drinks.add(x));
    $("drinkOther").value = s.drinkOther || "";
    onAttendingChange(); renderDrinks();
    $("thanks").hidden = true; $("formCard").hidden = false; $("formCard").classList.add("in");
    setText("rsvpTitle", "Ты придёшь?");
    $("rsvp").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- Конфетти: движение по времени, гаснут не позже чем через 2,4 с ----------
  let parts = [], running = false, lastT = 0, cv = null, cx = null;
  const LIFE = 2400, FADE = 700;
  function confetti() {
    if (reduced) return;
    if (!cv) {
      cv = document.createElement("canvas");
      Object.assign(cv.style, { position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 80 });
      document.body.appendChild(cv); cx = cv.getContext("2d");
    }
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = T.confetti || ["#fff4d8", "#f1d9a6", "#e3c287", "#b98f4e", "#ffffff", "#a8384f"];
    for (let i = 0; i < 160; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, sp = Math.random() * 14 + 7;
      parts.push({ x: innerWidth / 2, y: innerHeight * 0.62, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: Math.random() * 8 + 4, h: Math.random() * 4 + 2,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, c: colors[(Math.random() * colors.length) | 0], round: Math.random() < 0.3, age: 0 });
    }
    if (!running) { running = true; lastT = 0; requestAnimationFrame(loop); }
  }
  function loop(t) {
    const ms = lastT ? Math.min(50, t - lastT) : 16.7; lastT = t; const k = ms / 16.7;
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach((p) => {
      p.age += ms; p.vy += 0.28 * k; const drag = Math.pow(0.985, k); p.vx *= drag; p.vy *= drag;
      p.x += (p.vx + Math.sin(p.age / 150 + p.r) * 0.6) * k; p.y += p.vy * k; p.r += p.vr * k;
      cx.globalAlpha = Math.max(0, 1 - Math.max(0, p.age - (LIFE - FADE)) / FADE);
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c;
      if (p.round) { cx.beginPath(); cx.arc(0, 0, p.h, 0, 7); cx.fill(); } else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.age / 130 + p.r)) + 0.5);
      cx.restore();
    });
    cx.globalAlpha = 1;
    parts = parts.filter((p) => p.age < LIFE && p.y < innerHeight + 40);
    if (parts.length) requestAnimationFrame(loop); else { running = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ---------- Появление при прокрутке ----------
  function revealObserver() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || reduced) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((e) => io.observe(e));
  }

  // ---------- Старт ----------
  mountDetails(); mountCountdown(); mountRsvp(); fill();
  if (tick()) { const timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000); }
  renderDrinkCards(); setCount(1);
  document.querySelectorAll('input[name="attending"]').forEach((r) => r.addEventListener("change", onAttendingChange));
  $("minus").addEventListener("click", () => setCount(count - 1));
  $("plus").addEventListener("click", () => setCount(count + 1));
  $("name").addEventListener("input", () => { $("name").classList.remove("invalid"); $("nameErr").hidden = true; });
  $("drinkOther").addEventListener("input", () => { $("drinkErr").hidden = true; });
  $("rsvpForm").addEventListener("submit", onSubmit);
  $("editBtn").addEventListener("click", edit);
  document.querySelectorAll(".calBtn").forEach((b) => b.addEventListener("click", downloadIcs));
  const saved = store.get(LS_SENT);
  if (saved && saved.name) showThanks(saved, false);
  revealObserver();
  window.InviteApp = { confetti };
})();
