(function () {
  "use strict";
  const C = window.INVITE || {};
  const $ = (id) => document.getElementById(id);
  const LS_ID = "invite_rsvp_id";
  const LS_ANSWER = "invite_rsvp_answer";
  const LS_DEMO = "invite_demo_responses";
  const OTHER = "Свой вариант";

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

  // ---------- Даты ----------
  const eventStart = new Date(`${C.date}T${C.time || "00:00"}:00`);
  const noon = new Date(`${C.date}T12:00:00`);
  const dateText = noon.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const weekday = noon.toLocaleDateString("ru-RU", { weekday: "long" });

  // ---------- Заполнение текста ----------
  function fill() {
    $("age").textContent = C.age || "";
    if (C.name) {
      $("heroTitle").textContent = C.name;
      $("heroSub").textContent = "приглашает на свой день рождения";
    } else {
      $("heroTitle").textContent = "день рождения";
      $("heroSub").hidden = true;
    }
    $("badgeDate").textContent = dateText;
    $("badgeWeekday").textContent = weekday;
    $("message").textContent = C.message || "";
    $("dDate").textContent = dateText;
    $("dWeekday").textContent = weekday[0].toUpperCase() + weekday.slice(1);
    if (C.time) {
      $("dTime").textContent = C.time;
      $("dTimeNote").textContent = "Просим не опаздывать";
    } else {
      $("dTime").textContent = "Скоро";
      $("dTimeNote").textContent = "Время сообщим дополнительно";
    }
    $("dPlace").textContent = C.place || "";
    $("dAddress").textContent = C.address || "";
    $("dAddress").hidden = !C.address;
    $("mapLink").href = C.mapUrl ||
      "https://yandex.ru/maps/?text=" + encodeURIComponent([C.place, C.address].filter(Boolean).join(", "));
    if (C.dressCode) { $("dDress").textContent = C.dressCode; $("dressCard").hidden = false; }
    if (C.rsvpDeadline) $("deadlineNote").textContent = `Пожалуйста, ответьте до ${C.rsvpDeadline}. Ответ можно будет изменить.`;
    if (C.contact) { $("contactLine").hidden = false; $("contactLine").textContent = "Вопросы: " + C.contact; }
    if (!C.scriptUrl) $("demoBanner").hidden = false;
    document.title = (C.name ? C.name + " · " : "") + "Приглашение на день рождения · " + dateText;
  }

  // ---------- Обратный отсчёт ----------
  function tick() {
    let diff = Math.max(0, eventStart - new Date());
    if (diff === 0) {
      $("countdown").innerHTML = '<div class="card unit" style="grid-column:1/-1"><div class="num">Праздник уже начался! 🎉</div></div>';
      return false;
    }
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    $("cdD").textContent = d;
    $("cdH").textContent = String(h).padStart(2, "0");
    $("cdM").textContent = String(m).padStart(2, "0");
    $("cdS").textContent = String(s).padStart(2, "0");
    const caps = document.querySelectorAll("#countdown .cap");
    caps[0].textContent = plural(d, ["день", "дня", "дней"]);
    caps[1].textContent = plural(h, ["час", "часа", "часов"]);
    caps[2].textContent = plural(m, ["минута", "минуты", "минут"]);
    caps[3].textContent = plural(s, ["секунда", "секунды", "секунд"]);
    return true;
  }

  // ---------- Календарь ----------
  function downloadIcs() {
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const ymd = C.date.replace(/-/g, "");
    const next = new Date(noon.getTime() + 864e5);
    const ymdNext = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const esc = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//birthday-invite//RU", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:birthday-${ymd}@invite`,
      `DTSTAMP:${stamp}`,
      C.time ? `DTSTART:${fmt(eventStart)}` : `DTSTART;VALUE=DATE:${ymd}`,
      C.time ? `DTEND:${fmt(new Date(eventStart.getTime() + 5 * 36e5))}` : `DTEND;VALUE=DATE:${ymdNext}`,
      `SUMMARY:${esc("День рождения" + (C.name ? " — " + C.name : "") + " · " + C.age)}`,
      `LOCATION:${esc([C.place, C.address].filter(Boolean).join(", "))}`,
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Завтра день рождения!", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "den-rozhdeniya.ics";
    document.body.appendChild(a);
    a.click();
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
      setTimeout(done, 450);
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
      if (other.checked) setTimeout(() => $("drinkOther").focus(), 50);
    });
  }

  function setCount(n) {
    count = Math.min(maxGuests, Math.max(1, n));
    $("count").textContent = count;
    $("minus").disabled = count <= 1;
    $("plus").disabled = count >= maxGuests;
    $("countWord").textContent = count === 1 ? "только я" : `я + ${count - 1} ${plural(count - 1, ["гость", "гостя", "гостей"])}`;
    toggle($("companionsBlock"), count > 1);
  }

  function attendingValue() {
    const r = document.querySelector('input[name="attending"]:checked');
    return r ? r.value : "";
  }

  function onAttendingChange() {
    const v = attendingValue();
    toggle($("comingBlock"), v === "Да" || v === "Пока не знаю");
    $("attErr").hidden = true;
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

  function getId() {
    let id = store.get(LS_ID);
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      store.set(LS_ID, id);
    }
    return id;
  }

  function validate(d) {
    let ok = true;
    $("name").classList.toggle("invalid", !d.name);
    $("nameErr").hidden = !!d.name;
    if (!d.name) ok = false;
    $("attErr").hidden = !!d.attending;
    if (!d.attending) ok = false;
    if (!ok) {
      const first = !d.name ? $("name") : document.querySelector('input[name="attending"]');
      first.closest(".field").scrollIntoView({ behavior: "smooth", block: "center" });
      if (!d.name) setTimeout(() => $("name").focus({ preventScroll: true }), 300);
    }
    return ok;
  }

  async function send(d) {
    if (!C.scriptUrl) {
      const list = store.get(LS_DEMO) || [];
      const i = list.findIndex((x) => x.id === d.id);
      const row = { ...d, drinks: d.drinks.join(", "), date: i >= 0 ? list[i].date : new Date().toISOString(), updated: new Date().toISOString() };
      if (i >= 0) list[i] = row; else list.push(row);
      store.set(LS_DEMO, list);
      await new Promise((r) => setTimeout(r, 600));
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
      $("formErr").textContent = "Не получилось отправить. Проверьте интернет и попробуйте ещё раз.";
      console.error(err);
    } finally {
      btn.disabled = false; btn.textContent = "Отправить ответ";
    }
  }

  function showThanks(d, scroll) {
    const t = {
      "Да": ["🥂", "Ура, ждём вас!", `Спасибо, ${d.name}! Очень рады, что вы будете с нами ${dateText}.`],
      "Пока не знаю": ["🤞", "Спасибо за ответ!", `${d.name}, надеемся, что получится. Когда будете знать точно — просто измените ответ по этой же ссылке.`],
      "Нет": ["💌", "Жаль, что не получится", `Спасибо, что ответили, ${d.name}! Будем вспоминать вас за праздничным столом.`],
    }[d.attending];
    $("thanksEmoji").textContent = t[0];
    $("thanksTitle").textContent = t[1];
    $("thanksText").textContent = t[2];
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
    $("thanks").hidden = false;
    $("rsvp").querySelector("h2").textContent = "Спасибо за ответ";
    if (scroll) $("rsvp").scrollIntoView({ behavior: "smooth" });
    if (scroll && d.attending === "Да") confetti();
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
    $("rsvp").querySelector("h2").textContent = "Вы придёте?";
    const saved = store.get(LS_ANSWER);
    if (saved) prefill(saved);
    $("rsvp").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- Конфетти ----------
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.createElement("canvas");
    Object.assign(cv.style, { position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 50 });
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colors = ["#f6e3bb", "#e3c287", "#b98f4e", "#ffffff", "#9e3a50"];
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 15 - 6,
      r: Math.random() * 6 + 3, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    let frame = 0;
    (function loop() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach((p) => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      });
      if (++frame < 160) requestAnimationFrame(loop); else cv.remove();
    })();
  }

  // ---------- Снег ----------
  function snow() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = $("snow"), ctx = cv.getContext("2d");
    let w, h, flakes;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 14000));
      flakes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.8 + 0.4,
        s: Math.random() * 0.5 + 0.2, d: Math.random() * Math.PI * 2, o: Math.random() * 0.5 + 0.2,
      }));
    };
    resize();
    addEventListener("resize", resize);
    (function loop() {
      ctx.clearRect(0, 0, w, h);
      flakes.forEach((f) => {
        f.y += f.s; f.d += 0.01; f.x += Math.sin(f.d) * 0.3;
        if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(246,227,187,${f.o})`; ctx.fill();
      });
      requestAnimationFrame(loop);
    })();
  }

  // ---------- Старт ----------
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
  $("calBtn").addEventListener("click", downloadIcs);
  $("calBtn2").addEventListener("click", downloadIcs);
  const saved = store.get(LS_ANSWER);
  if (saved && saved.name) showThanks(saved, false);
  snow();
})();
