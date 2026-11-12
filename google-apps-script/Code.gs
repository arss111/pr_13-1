/**
 * Приём ответов на приглашение → Google-таблица.
 *
 * 1. Создайте Google-таблицу → Расширения → Apps Script.
 * 2. Вставьте этот код вместо содержимого Code.gs.
 * 3. ПОМЕНЯЙТЕ ADMIN_KEY на свой пароль (его вы будете вводить на странице статистики).
 * 4. Развернуть → Новое развертывание → Веб-приложение:
 *      Выполнять как: «Я», Доступ: «Все» → Развернуть → скопируйте URL.
 */

const ADMIN_KEY = 'поменяйте-этот-пароль';
const SHEET_NAME = 'Ответы';
const HEADERS = [
  'id', 'Дата ответа', 'Имя', 'Придёт', 'Кол-во гостей', 'Спутники',
  'Напитки', 'Свой вариант напитка', 'Еда / аллергии', 'Пожелание', 'Обновлено',
];
const KEYS = [
  'id', 'date', 'name', 'attending', 'guests', 'companions',
  'drinks', 'drinkOther', 'food', 'wish', 'updated',
];
const ALLOWED_ATTENDING = ['Да', 'Пока не знаю', 'Нет'];

function getSheet_() {
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

// Обрезает строку и не даёт превратить её в формулу таблицы.
function clean_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);
    const attending = ALLOWED_ATTENDING.indexOf(d.attending) >= 0 ? d.attending : '';
    const name = clean_(d.name, 100);
    if (!name || !attending) return json_({ ok: false, error: 'Не заполнены имя или ответ' });

    const id = clean_(d.id, 64) || Utilities.getUuid();
    let guests = parseInt(d.guests, 10);
    if (!(guests >= 0 && guests <= 20)) guests = attending === 'Нет' ? 0 : 1;
    const drinks = (Array.isArray(d.drinks) ? d.drinks : [])
      .slice(0, 20).map(function (x) { return clean_(x, 60); }).filter(String).join(', ');
    const now = new Date();

    const sh = getSheet_();
    const last = sh.getLastRow();
    let rowIndex = -1;
    if (last > 1) {
      const ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === id) { rowIndex = i + 2; break; }
      }
    }

    const row = [
      id, now, name, attending, guests, clean_(d.companions, 300),
      drinks, clean_(d.drinkOther, 200), clean_(d.food, 500), clean_(d.wish, 1000), now,
    ];

    if (rowIndex > 0) {
      row[1] = sh.getRange(rowIndex, 2).getValue(); // сохраняем дату первого ответа
      sh.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sh.appendRow(row);
    }
    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const key = e && e.parameter ? e.parameter.key : '';
  if (key !== ADMIN_KEY) return json_({ ok: false, error: 'forbidden' });

  const sh = getSheet_();
  const last = sh.getLastRow();
  const rows = [];
  if (last > 1) {
    const values = sh.getRange(2, 1, last - 1, KEYS.length).getValues();
    values.forEach(function (r) {
      const o = {};
      KEYS.forEach(function (k, i) {
        const v = r[i];
        o[k] = v instanceof Date ? v.toISOString() : v;
      });
      rows.push(o);
    });
  }
  return json_({ ok: true, rows: rows });
}
