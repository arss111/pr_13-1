/**
 * ============================================================
 *  Приём ответов на приглашение → Google-таблица
 *  + данные для админки (по паролю) + удаление ответа.
 * ============================================================
 *  Как поставить — см. ИНСТРУКЦИЯ.md, шаг 1.
 *  ОБЯЗАТЕЛЬНО поменяйте пароль ниже на свой.
 */

const ADMIN_PASSWORD = 'поменяйте-этот-пароль';

// ------------------------------------------------------------
const SHEET_NAME = 'Ответы';
const HEADERS = ['id', 'Дата ответа', 'Имя', 'Придёт?', 'Сколько человек', 'Напитки', 'Свой вариант напитка', 'Изменён'];
const ATTENDING = { yes: 'Да', maybe: 'Пока не знаю', no: 'Нет' };
const DRINKS = { vodka: 'Водка', prosecco: 'Просекко', champagne: 'Шампанское', wine: 'Вино', other: 'Свой вариант', none: 'Не пью алкоголь' };
const ALCOHOL = ['vodka', 'prosecco', 'champagne', 'wine'];
const MAX_GUESTS = 10;

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#f3e7cf');
    sh.hideColumns(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Чистим текст: убираем управляющие символы, лишние пробелы, обрезаем длину, защищаем от формул */
function clean_(v, max, multiline) {
  let s = typeof v === 'string' ? v : '';
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  s = s.trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // чтобы таблица не приняла текст за формулу
  return s;
}

/** Проверка ответа гостя. Возвращает { ok, row } или { ok:false, error } */
function validate_(d) {
  const id = typeof d.clientId === 'string' ? d.clientId : '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return { ok: false, error: 'Некорректный идентификатор ответа' };

  const name = clean_(d.name, 80, false);
  if (!name || !/[A-Za-zА-Яа-яЁё]/.test(name)) return { ok: false, error: 'Напиши, пожалуйста, своё имя' };

  const att = ATTENDING[d.attending];
  if (!att) return { ok: false, error: 'Выбери, придёшь ли ты' };
  const coming = d.attending !== 'no';

  let guests = 0;
  if (coming) {
    guests = Number(d.guests);
    if (!(guests % 1 === 0 && guests >= 1 && guests <= MAX_GUESTS)) return { ok: false, error: 'Количество гостей — от 1 до ' + MAX_GUESTS };
  }

  let drinks = [];
  if (coming) {
    const raw = Array.isArray(d.drinks) ? d.drinks.slice(0, 10) : [];
    for (let i = 0; i < raw.length; i++) {
      if (!DRINKS[raw[i]]) return { ok: false, error: 'Неизвестный напиток' };
      if (drinks.indexOf(raw[i]) < 0) drinks.push(raw[i]);
    }
    // «Не пью алкоголь» исключает алкогольные напитки (свой вариант оставляем — это может быть морс или сок)
    if (drinks.indexOf('none') >= 0) drinks = drinks.filter(function (x) { return ALCOHOL.indexOf(x) < 0; });
    if (!drinks.length) return { ok: false, error: 'Выбери хотя бы один напиток' };
    const order = Object.keys(DRINKS);
    drinks.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
  }

  let other = '';
  if (drinks.indexOf('other') >= 0) {
    other = clean_(d.drinkOther, 80, false);
    if (!other) return { ok: false, error: 'Напиши свой вариант напитка' };
  }
  const listed = drinks.filter(function (x) { return x !== 'other'; }).map(function (x) { return DRINKS[x]; }).join(', ');
  return {
    ok: true,
    id: id,
    row: [id, null, name, att, guests, listed, other, null],
  };
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return -1;
}

/** Все запросы на запись приходят сюда */
function doPost(e) {
  let d;
  try {
    d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Некорректные данные' });
  }
  if (!d || typeof d !== 'object') return json_({ ok: false, error: 'Пустой запрос' });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // --- Удаление ответа из админки ---
    if (d.action === 'delete') {
      if (d.key !== ADMIN_PASSWORD) return json_({ ok: false, error: 'forbidden' });
      const sh = sheet_();
      const r = findRow_(sh, String(d.id || ''));
      if (r > 0) sh.deleteRow(r);
      return json_({ ok: true, deleted: r > 0 });
    }

    // --- Ответ гостя ---
    if (typeof d.website === 'string' && d.website.trim() !== '') return json_({ ok: true }); // ловушка для ботов
    const v = validate_(d);
    if (!v.ok) return json_({ ok: false, error: v.error });

    const sh = sheet_();
    const now = new Date();
    const r = findRow_(sh, v.id);
    if (r > 0) {
      v.row[1] = sh.getRange(r, 2).getValue(); // дата первого ответа сохраняется
      v.row[7] = now;
      sh.getRange(r, 1, 1, v.row.length).setValues([v.row]);
      return json_({ ok: true, updated: true });
    }
    v.row[1] = now;
    v.row[7] = '';
    sh.appendRow(v.row);
    return json_({ ok: true, updated: false });
  } catch (err) {
    return json_({ ok: false, error: 'Не получилось сохранить, попробуй ещё раз' });
  } finally {
    lock.releaseLock();
  }
}

/** Данные для админки: только с правильным паролем */
function doGet(e) {
  const key = (e && e.parameter && e.parameter.key) || '';
  if (key !== ADMIN_PASSWORD) return json_({ ok: false, error: 'forbidden' });

  const attBack = {}; Object.keys(ATTENDING).forEach(function (k) { attBack[ATTENDING[k]] = k; });
  const drinkBack = {}; Object.keys(DRINKS).forEach(function (k) { drinkBack[DRINKS[k]] = k; });

  const sh = sheet_();
  const last = sh.getLastRow();
  const rows = [];
  if (last > 1) {
    sh.getRange(2, 1, last - 1, HEADERS.length).getValues().forEach(function (r) {
      if (!r[0]) return;
      const iso = function (v) { return v instanceof Date ? v.toISOString() : (v ? String(v) : ''); };
      const drinks = String(r[5] || '').split(',').map(function (s) { return drinkBack[s.trim()]; }).filter(Boolean);
      const other = String(r[6] || '');
      if (other) drinks.push('other');
      rows.push({
        id: String(r[0]),
        created: iso(r[1]),
        name: String(r[2]),
        attending: attBack[r[3]] || 'yes',
        guests: Number(r[4]) || 0,
        drinks: drinks,
        drinkOther: other,
        updated: iso(r[7]) || iso(r[1]),
      });
    });
  }
  return json_({ ok: true, rows: rows });
}
