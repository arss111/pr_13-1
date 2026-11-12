/* Общая логика приглашения: детали, отсчёт, форма ответа. Внешний вид задаёт страница-вариант. */
(function () {
  "use strict";
  const C = window.INVITE || {};
  const T = window.INVITE_THEME || {};
  const $ = (id) => document.getElementById(id);
  const LS_ID = "invite_rsvp_id";
  const LS_ANSWER = "invite_rsvp_answer";
  const LS_DEMO = "invite_demo_responses";
  const OTHER = "Свой вариант";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const plural = (n, f) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
  };
  const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };

  // ---------- Даты ----------
  const eventStart = new Date(`${C.date}T${C.time || "00:00"}:00`);
  const noon = new Date(`${C.date}T12:00:00`);
  const dateText = noon.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const weekday = noon.toLocaleDateString("ru-RU", { weekday: "long" });
  const Weekday = weekday[0].toUpperCase() + weekday.slice(1);

  const ICON = {
    pin: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    cal: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  };
  const THANKS_ICON = {
    "Да": '<svg viewBox="0 0 64 64"><g transform="rotate(-14 22 34)"><path pathLength="1" d="M17 10h10l-1 17a4 4 0 0 1-8 0z"/><path pathLength="1" d="M22 31v15M17 46h10"/></g><g transform="rotate(14 42 34)"><path pathLength="1" d="M37 10h10l-1 17a4 4 0 0 1-8 0z"/><path pathLength="1" d="M42 31v15M37 46h10"/></g><path class="late" pathLength="1" d="M32 2v6M24 5l3 4M40 5l-3 4"/></svg>',
    "Пока не знаю": '<svg viewBox="0 0 64 64"><path pathLength="1" d="M18 8h28M18 56h28"/><path pathLength="1" d="M21 8c0 13 22 15 22 24S21 43 21 56M43 8c0 13-22 15-22 24s22 11 22 24"/><path class="late" pathLength="1" d="M27 50h10"/></svg>',
    "Нет": '<svg viewBox="0 0 64 64"><path pathLength="1" d="M8 18h48v32H8z"/><path pathLength="1" d="M8 18l24 19 24-19"/><path class="late" pathLength="1" d="M32 31c-3-5-10-2-7 3l7 6 7-6c3-5-4-8-7-3z"/></svg>',
  };

  // ---------- Разметка блоков ----------
  function mountDetails() {
    const m = $("detailsMount"); if (!m) return;
    m.innerHTML = `
      <div class="details">
        <div class="card detail reveal"><span class="label">Дата</span><span class="value" id="dDate"></span><span class="note" id="dWeekday"></span></div>
        <div class="card detail reveal" style="--d:1"><span class="label">Начало</span><span class="value" id="dTime"></span><span class="note" id="dTimeNote"></span></div>
        <div class="card detail wide reveal" style="--d:2"><span class="label">Место</span><span class="value" id="dPlace"></span><span class="note" id="dAddress"></span>
          <div class="actions">
            <a class="btn btn-ghost btn-sm" id="mapLink" target="_blank" rel="noopener">${ICON.pin}Открыть на карте</a>
            <button class="btn btn-ghost btn-sm calBtn" type="button">${ICON.cal}В календарь</button>
          </div>
        </div>
        <div class="card detail wide reveal" id="dressCard" hidden><span class="label">Дресс-код</span><span class="value" id="dDress"></span></div>
      </div>`;
  }

  function mountCountdown() {
    const m = $("countdownMount"); if (!m) return;
    m.innerHTML = `<div class="countdown" id="countdown">${["d", "h", "m", "s"].map((u, i) =>
      `<div class="card unit reveal" style="--d:${i}"><div class="num" id="cd_${u}">0</div><div class="cap" id="cap_${u}"></div></div>`).join("")}</div>`;
  }

  function mountRsvp() {
    const m = $("rsvpMount"); if (!m) return;
    m.innerHTML = `
      <div class="card form-card reveal" id="formCard">
        <form id="rsvpForm" novalidate>
          <div class="field">
            <label class="field-label" for="name">Как тебя зовут? <span class="req">*</span></label>
            <input type="text" id="name" autocomplete="name" placeholder="Имя и фамилия" maxlength="100">
            <div class="error-text" id="nameErr" hidden>Пожалуйста, представься</div>
          </div>
          <div class="field">
            <span class="field-label">Сможешь прийти? <span class="req">*</span></span>
            <div class="choices" role="radiogroup">
              <label class="choice"><input type="radio" name="attending" value="Да"><span><span>Да, с радостью приду<small>Уже предвкушаю</small></span></span></label>
              <label class="choice"><input type="radio" name="attending" value="Пока не знаю"><span><span>Пока не знаю точно<small>Отвечу позже по этой же ссылке</small></span></span></label>
              <label class="choice"><input type="radio" name="attending" value="Нет"><span><span>К сожалению, не смогу<small>Но мысленно буду с вами</small></span></span></label>
            </div>
            <div class="error-text" id="attErr" hidden>Выбери вариант</div>
          </div>
          <div class="collapsible closed" id="comingBlock">
            <div class="field">
              <span class="field-label">Сколько вас будет?</span>
              <div class="stepper-row">
                <div class="stepper">
                  <button type="button" id="minus" aria-label="Меньше">−</button>
                  <output id="count" aria-live="polite">1</output>
                  <button type="button" id="plus" aria-label="Больше">+</button>
                </div>
                <span class="muted" id="countWord">только я</span>
              </div>
            </div>
            <div class="collapsible closed" id="companionsBlock">
              <div class="field">
                <label class="field-label" for="companions">С кем ты придёшь?</label>
                <input type="text" id="companions" placeholder="Например: жена Анна, сын Миша" maxlength="300">
              </div>
            </div>
            <div class="field">
              <span class="field-label">Что предпочитаешь пить?</span>
              <p class="hint">Можно выбрать несколько вариантов</p>
              <div class="chips" id="drinks"></div>
              <div class="collapsible closed" id="otherBlock"><div style="padding-top:10px"><input type="text" id="drinkOther" placeholder="Ваш вариант" maxlength="200"></div></div>
            </div>
            <div class="field">
              <label class="field-label" for="food">Пожелания по еде</label>
              <p class="hint">Аллергии, вегетарианство, что-то не ешь</p>
              <input type="text" id="food" placeholder="Необязательно" maxlength="500">
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="wish">Пара слов имениннику</label>
            <textarea id="wish" placeholder="Необязательно, но очень приятно" maxlength="1000"></textarea>
          </div>
          <button class="btn btn-block" type="submit" id="submitBtn">Отправить ответ</button>
          <div class="form-error" id="formErr" hidden></div>
          <p class="form-note" id="deadlineNote"></p>
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
    setText("age", C.age || "");
    if (C.name) {
      setText("heroTitle", C.name);
      setText("heroSub", "приглашает на свой день рождения");
    } else if ($("heroSub")) {
      $("heroSub").hidden = true;
    }
    setText("badgeDate", dateText);
    setText("badgeWeekday", weekday);
    setText("message", C.message || "");
    setText("dDate", dateText);
    setText("dWeekday", Weekday);
    setText("dTime", C.time || "Скоро");
    setText("dTimeNote", C.time ? "Просим не опаздывать" : "Время сообщим дополнительно");
    setText("dPlace", C.place || "");
    setText("dAddress", C.address || "");
    setText("placeInline", C.place || "");
    if ($("mapLink")) $("mapLink").href = C.mapUrl ||
      "https://yandex.ru/maps/?text=" + encodeURIComponent([C.place, C.address].filter(Boolean).join(", "));
    if (C.dressCode && $("dressCard")) { setText("dDress", C.dressCode); $("dressCard").hidden = false; }
    if (C.rsvpDeadline) setText("deadlineNote", `Пожалуйста, ответь до ${C.rsvpDeadline}. Ответ можно будет изменить.`);
    if (C.contact && $("contactLine")) { $("contactLine").hidden = false; $("contactLine").textContent = "Вопросы: " + C.contact; }
    if (!C.scriptUrl && $("demoBanner")) $("demoBanner").hidden = false;
    document.title = (C.name ? C.name + " · " : "") + "Приглашение на день рождения · " + dateText;
  }

  // ---------- Обратный отсчёт ----------
  const last = {};
  function setNum(u, v) {
    const e = $("cd_" + u); if (!e) return;
    if (last[u] === v) return;
    last[u] = v;
    e.textContent = v;
    if (!reduced) { e.classList.remove("bump"); void e.offsetWidth; e.classList.add("bump"); }
  }
  function tick() {
    const box = $("countdown"); if (!box) return false;
    let diff = Math.max(0, eventStart - new Date());
    if (diff === 0) { box.innerHTML = '<div class="card unit done">Праздник уже начался!</div>'; return false; }
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    setNum("d", String(d)); setNum("h", String(h).padStart(2, "0"));
    setNum("m", String(m).padStart(2, "0")); setNum("s", String(s).padStart(2, "0"));
    setText("cap_d", plural(d, ["день", "дня", "дней"]));
    setText("cap_h", plural(h, ["час", "часа", "часов"]));
    setText("cap_m", plural(m, ["минута", "минуты", "минут"]));
    setText("cap_s", plural(s, ["секунда", "секунды", "секунд"]));
    return true;
  }

  // ---------- Календарь ----------
  function downloadIcs() {
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const ymd = C.date.replace(/-/g, "");
    const next = new Date(noon.getTime() + 864e5);
    const ymdNext = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//birthday-invite//RU", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:birthday-${ymd}@invite`, `DTSTAMP:${stamp}`,
      C.time ? `DTSTART:${fmt(eventStart)}` : `DTSTART;VALUE=DATE:${ymd}`,
      C.time ? `DTEND:${fmt(new Date(eventStart.getTime() + 5 * 36e5))}` : `DTEND;VALUE=DATE:${ymdNext}`,
      `SUMMARY:${esc("День рождения" + (C.name ? " — " + C.name : "") + " · " + C.age)}`,
      `LOCATION:${esc([C.place, C.address].filter(Boolean).join(", "))}`,
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Завтра день рождения!", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
    a.download = "den-rozhdeniya.ics";
    document.body.appendChild(a); a.click();
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
  const maxGuests = Math.max(1, C.maxGuests || 6);
  let count = 1;

  function renderDrinks() {
    const box = $("drinks");
    [...(C.drinks || []), OTHER].forEach((d) => {
      const label = document.createElement("label");
      label.className = "chip";
      const input = document.createElement("input");
      input.type = "checkbox"; input.name = "drinks"; input.value = d;
      const span = document.createElement("span");
      span.textContent = d === OTHER ? "✎ " + d : d;
      label.append(input, span);
      box.appendChild(label);
    });
    box.addEventListener("change", () => {
      const other = box.querySelector(`input[value="${OTHER}"]`);
      toggle($("otherBlock"), other.checked);
      if (other.checked) setTimeout(() => $("drinkOther").focus(), 60);
    });
  }

  function setCount(n) {
    const prev = count;
    count = Math.min(maxGuests, Math.max(1, n));
    const out = $("count");
    out.textContent = count;
    if (prev !== count && !reduced) { out.classList.remove("bump"); void out.offsetWidth; out.classList.add("bump"); }
    $("minus").disabled = count <= 1;
    $("plus").disabled = count >= maxGuests;
    $("countWord").textContent = count === 1 ? "только я" : `я + ${count - 1} ${plural(count - 1, ["гость", "гостя", "гостей"])}`;
    toggle($("companionsBlock"), count > 1);
  }

  const attendingValue = () => { const r = document.querySelector('input[name="attending"]:checked'); return r ? r.value : ""; };
  function onAttendingChange() {
    const v = attendingValue();
    toggle($("comingBlock"), v === "Да" || v === "Пока не знаю");
    $("attErr").hidden = true;
  }

  function getId() {
    let id = store.get(LS_ID);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      store.set(LS_ID, id);
    }
    return id;
  }

  function collect() {
    const attending = attendingValue();
    const coming = attending !== "Нет";
    const drinks = coming ? [...document.querySelectorAll('input[name="drinks"]:checked')].map((i) => i.value) : [];
    return {
      id: getId(),
      name: $("name").value.trim(),
      attending,
      guests: coming ? count : 0,
      companions: coming && count > 1 ? $("companions").value.trim() : "",
      drinks: drinks.filter((d) => d !== OTHER),
      drinkOther: drinks.includes(OTHER) ? $("drinkOther").value.trim() : "",
      food: coming ? $("food").value.trim() : "",
      wish: $("wish").value.trim(),
    };
  }

  function validate(d) {
    $("name").classList.remove("invalid"); void $("name").offsetWidth;
    $("name").classList.toggle("invalid", !d.name);
    $("nameErr").hidden = !!d.name;
    $("attErr").hidden = !!d.attending;
    const ok = !!d.name && !!d.attending;
    if (!ok) {
      const first = !d.name ? $("name") : document.querySelector('input[name="attending"]');
      first.closest(".field").scrollIntoView({ behavior: "smooth", block: "center" });
      if (!d.name) setTimeout(() => $("name").focus({ preventScroll: true }), 350);
    }
    return ok;
  }

  async function send(d) {
    if (!C.scriptUrl) {
      const list = store.get(LS_DEMO) || [];
      const i = list.findIndex((x) => x.id === d.id);
      const now = new Date().toISOString();
      const row = { ...d, drinks: d.drinks.join(", "), date: i >= 0 ? list[i].date : now, updated: now };
      if (i >= 0) list[i] = row; else list.push(row);
      store.set(LS_DEMO, list);
      await new Promise((r) => setTimeout(r, 700));
      return;
    }
    const res = await fetch(C.scriptUrl, { method: "POST", body: JSON.stringify(d) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Ошибка сервера");
  }

  async function onSubmit(e) {
    e.preventDefault();
    const d = collect();
    if (!validate(d)) return;
    const btn = $("submitBtn");
    btn.disabled = true; btn.textContent = "Отправляем…";
    $("formErr").hidden = true;
    try {
      await send(d);
      store.set(LS_ANSWER, d);
      showThanks(d, true);
    } catch (err) {
      $("formErr").hidden = false;
      $("formErr").textContent = "Не получилось отправить. Проверь интернет и попробуй ещё раз.";
      console.error(err);
    } finally {
      btn.disabled = false; btn.textContent = "Отправить ответ";
    }
  }

  function showThanks(d, animate) {
    const t = {
      "Да": ["Ура, ждём тебя!", `Спасибо, ${d.name}! Очень рады, что ты будешь с нами ${dateText}.`],
      "Пока не знаю": ["Спасибо за ответ!", `${d.name}, надеемся, что получится. Когда будешь знать точно, просто измени ответ по этой же ссылке.`],
      "Нет": ["Жаль, что не получится", `Спасибо за ответ, ${d.name}! Будем вспоминать тебя за праздничным столом.`],
    }[d.attending];
    $("thanksIcon").innerHTML = THANKS_ICON[d.attending] || "";
    $("thanksTitle").textContent = t[0];
    $("thanksText").textContent = t[1];
    const rows = [["Ответ", d.attending]];
    if (d.attending !== "Нет") {
      rows.push(["Гостей", String(d.guests)]);
      if (d.companions) rows.push(["С вами", d.companions]);
      const drinks = [...d.drinks, d.drinkOther].filter(Boolean).join(", ");
      if (drinks) rows.push(["Напитки", drinks]);
      if (d.food) rows.push(["Еда", d.food]);
    }
    const dl = $("summary");
    dl.innerHTML = "";
    rows.forEach(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = v;
      dl.append(dt, dd);
    });
    $("calBtn2").hidden = d.attending === "Нет";
    $("formCard").hidden = true;
    const th = $("thanks");
    th.hidden = false;
    th.classList.remove("pop"); void th.offsetWidth; th.classList.add("pop");
    setText("rsvpTitle", "Спасибо за ответ");
    if (animate) {
      $("rsvp").scrollIntoView({ behavior: "smooth" });
      if (d.attending === "Да") setTimeout(confetti, 350);
    }
  }

  function prefill(d) {
    $("name").value = d.name || "";
    const r = document.querySelector(`input[name="attending"][value="${d.attending}"]`);
    if (r) r.checked = true;
    setCount(d.guests || 1);
    $("companions").value = d.companions || "";
    document.querySelectorAll('input[name="drinks"]').forEach((i) => {
      i.checked = (d.drinks || []).includes(i.value) || (i.value === OTHER && !!d.drinkOther);
    });
    $("drinkOther").value = d.drinkOther || "";
    toggle($("otherBlock"), !!d.drinkOther);
    $("food").value = d.food || "";
    $("wish").value = d.wish || "";
    onAttendingChange();
  }

  function edit() {
    $("thanks").hidden = true;
    $("formCard").hidden = false;
    $("formCard").classList.add("in");
    setText("rsvpTitle", "Ты придёшь?");
    const saved = store.get(LS_ANSWER);
    if (saved) prefill(saved);
    $("rsvp").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- Конфетти ----------
  function confetti(opts) {
    if (reduced) return;
    opts = opts || {};
    const cv = document.createElement("canvas");
    Object.assign(cv.style, { position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 80 });
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = T.confetti || ["#f6e3bb", "#e3c287", "#b98f4e", "#ffffff", "#9e3a50"];
    const ox = opts.x != null ? opts.x : innerWidth / 2, oy = opts.y != null ? opts.y : innerHeight * 0.65;
    const parts = Array.from({ length: opts.count || 160 }, () => {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = Math.random() * 13 + 7;
      return {
        x: ox, y: oy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        w: Math.random() * 8 + 4, h: Math.random() * 4 + 2, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.35,
        tilt: Math.random() * 6, c: colors[(Math.random() * colors.length) | 0], round: Math.random() < 0.3,
      };
    });
    let frame = 0;
    (function loop() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const fade = Math.max(0, 1 - Math.max(0, frame - 120) / 60);
      ctx.globalAlpha = fade;
      parts.forEach((p) => {
        p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx + Math.sin(frame / 10 + p.tilt) * 0.6; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h, 0, 7); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(frame / 8 + p.tilt)) + 0.5);
        ctx.restore();
      });
      if (++frame < 180) requestAnimationFrame(loop); else cv.remove();
    })();
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
  mountDetails();
  mountCountdown();
  mountRsvp();
  fill();
  if (tick()) { const t = setInterval(() => { if (!tick()) clearInterval(t); }, 1000); }
  renderDrinks();
  setCount(1);
  document.querySelectorAll('input[name="attending"]').forEach((r) => r.addEventListener("change", onAttendingChange));
  $("minus").addEventListener("click", () => setCount(count - 1));
  $("plus").addEventListener("click", () => setCount(count + 1));
  $("name").addEventListener("input", () => { $("name").classList.remove("invalid"); $("nameErr").hidden = true; });
  $("rsvpForm").addEventListener("submit", onSubmit);
  $("editBtn").addEventListener("click", edit);
  document.querySelectorAll(".calBtn").forEach((b) => b.addEventListener("click", downloadIcs));
  const saved = store.get(LS_ANSWER);
  if (saved && saved.name) showThanks(saved, false);
  revealObserver();

  window.InviteApp = { confetti, dateText, weekday };
})();
