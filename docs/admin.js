(function () {
  "use strict";
  const C = window.INVITE || {};
  const $ = (id) => document.getElementById(id);
  const LS_KEY = "invite_admin_key";
  const LS_DEMO = "invite_demo_responses";
  let rows = [];
  let filter = "all";

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  const plural = (n, f) => {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f[2];
    if (b > 1 && b < 5) return f[1];
    if (b === 1) return f[0];
    return f[2];
  };
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const fmtDate = (s) => {
    const d = new Date(s);
    return isNaN(d) ? "" : d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const splitDrinks = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

  function showLogin(err) {
    $("dash").hidden = true;
    $("login").hidden = false;
    $("loginErr").hidden = !err;
    if (err) $("loginErr").textContent = err;
    setTimeout(() => $("key").focus(), 50);
  }

  async function load() {
    if (!C.scriptUrl) {
      rows = store.get(LS_DEMO) || [];
      $("demoNote").hidden = false;
      return render();
    }
    const key = store.get(LS_KEY);
    if (!key) return showLogin();
    $("refresh").disabled = true;
    try {
      const res = await fetch(`${C.scriptUrl}?key=${encodeURIComponent(key)}&t=${Date.now()}`);
      const json = await res.json();
      if (!json.ok) {
        store.del(LS_KEY);
        return showLogin(json.error === "forbidden" ? "Неверный пароль" : json.error);
      }
      rows = json.rows || [];
      render();
    } catch (e) {
      console.error(e);
      if ($("dash").hidden) showLogin("Не удалось загрузить данные. Проверьте scriptUrl и интернет.");
      else $("updated").textContent = "Не удалось обновить — проверьте интернет.";
    } finally {
      $("refresh").disabled = false;
    }
  }

  function render() {
    $("login").hidden = true;
    $("dash").hidden = false;
    const noon = new Date(`${C.date}T12:00:00`);
    $("evtLine").textContent = noon.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) + " · " + (C.place || "");
    if (C.sheetUrl) { $("sheetLink").hidden = false; $("sheetLink").href = C.sheetUrl; }
    $("updated").textContent = "Обновлено " + new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    const yes = rows.filter((r) => r.attending === "Да");
    const maybe = rows.filter((r) => r.attending === "Пока не знаю");
    const no = rows.filter((r) => r.attending === "Нет");
    const sum = (arr) => arr.reduce((s, r) => s + (parseInt(r.guests, 10) || 0), 0);
    const yesGuests = sum(yes), maybeGuests = sum(maybe);

    $("kGuests").textContent = yesGuests;
    $("kGuestsSub").textContent = `${yes.length} ${plural(yes.length, ["ответ", "ответа", "ответов"])}`;
    $("kMaybe").textContent = maybeGuests;
    $("kMaybeSub").textContent = maybe.length ? `максимум будет ${yesGuests + maybeGuests}` : "";
    $("kNo").textContent = no.length;
    $("kTotal").textContent = rows.length;

    // Напитки
    const coming = rows.filter((r) => r.attending !== "Нет");
    const counts = new Map((C.drinks || []).map((d) => [d, 0]));
    coming.forEach((r) => splitDrinks(r.drinks).forEach((d) => counts.set(d, (counts.get(d) || 0) + 1)));
    const others = coming.filter((r) => r.drinkOther);
    if (others.length) counts.set("Свой вариант", others.length);
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map((e) => e[1]));
    const bars = $("drinkBars");
    bars.innerHTML = "";
    if (!coming.length) bars.appendChild(el("p", "empty", "Пока нет ответов"));
    else entries.forEach(([name, n]) => {
      const row = el("div", "bar-row");
      const track = el("div", "bar-track");
      const fill = el("div", "bar-fill");
      fill.style.width = (n / max) * 100 + "%";
      track.appendChild(fill);
      row.append(el("span", null, name), track, el("span", "bar-val", n));
      bars.appendChild(row);
    });
    const ol = $("drinkOther");
    ol.innerHTML = "";
    others.forEach((r) => {
      const li = el("li");
      li.append(el("b", null, r.name + ": "), document.createTextNode(r.drinkOther));
      ol.appendChild(li);
    });

    notes($("foodNotes"), coming.filter((r) => r.food), "food", "Никто ничего не указал");
    notes($("wishes"), rows.filter((r) => r.wish), "wish", "Пока пожеланий нет");
    table();
  }

  function notes(ul, list, field, emptyText) {
    ul.innerHTML = "";
    if (!list.length) { ul.appendChild(el("li", "empty", emptyText)); return; }
    list.forEach((r) => {
      const li = el("li");
      li.append(el("b", null, r.name + ": "), document.createTextNode(r[field]));
      ul.appendChild(li);
    });
  }

  function table() {
    const tb = $("tbody");
    tb.innerHTML = "";
    const list = rows
      .filter((r) => filter === "all" || r.attending === filter)
      .sort((a, b) => new Date(b.updated || b.date) - new Date(a.updated || a.date));
    if (!list.length) {
      const tr = el("tr"); const td = el("td", "empty", "Пока пусто"); td.colSpan = 7; tr.appendChild(td); tb.appendChild(tr);
      return;
    }
    const cls = { "Да": "yes", "Пока не знаю": "maybe", "Нет": "no" };
    list.forEach((r) => {
      const tr = el("tr");
      const tag = el("span", "tag " + (cls[r.attending] || ""), r.attending);
      const tdTag = el("td"); tdTag.appendChild(tag);
      const drinks = [...splitDrinks(r.drinks), r.drinkOther].filter(Boolean).join(", ");
      tr.append(
        el("td", null, r.name), tdTag, el("td", null, r.attending === "Нет" ? "—" : r.guests),
        el("td", null, r.companions || ""), el("td", null, drinks), el("td", null, r.food || ""),
        el("td", null, fmtDate(r.updated || r.date))
      );
      tb.appendChild(tr);
    });
  }

  function csv() {
    const head = ["Имя", "Ответ", "Гостей", "С кем", "Напитки", "Свой вариант", "Еда", "Пожелание", "Дата"];
    const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const lines = [head.map(q).join(";")].concat(rows.map((r) =>
      [r.name, r.attending, r.guests, r.companions, r.drinks, r.drinkOther, r.food, r.wish, fmtDate(r.updated || r.date)].map(q).join(";")
    ));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gosti.csv";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const k = $("key").value.trim();
    if (!k) return;
    store.set(LS_KEY, k);
    load();
  });
  $("refresh").addEventListener("click", load);
  $("csv").addEventListener("click", csv);
  $("logout").addEventListener("click", () => { store.del(LS_KEY); rows = []; showLogin(); });
  $("filters").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-f]");
    if (!b) return;
    filter = b.dataset.f;
    [...$("filters").children].forEach((x) => x.classList.toggle("btn-ghost", x !== b));
    table();
  });
  setInterval(() => { if (!$("dash").hidden && !document.hidden) load(); }, 60000);
  load();
})();
