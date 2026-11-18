// Edge Function "respaldo-xlsx" · App Hermanos McGregor — GENERADO por backup/make_edge.sh desde backup/build.js (no editar a mano)
// Devuelve el respaldo completo en .xlsx. Requiere el header x-backup-key = secret BACKUP_DRIVE_KEY; sin él responde 401.
// Lee los datos con bk_dump() usando la llave de servicio (solo existe en el servidor). Ajuste: "Verify JWT" APAGADO.
import { zipSync, strToU8 } from "npm:fflate@0.8.2";
// Respaldo semanal McGregor: arma el Excel a partir de bk_dump(). Mismo código en Node (pruebas) y en la Edge Function (Deno).
// buildXlsx(dump, now, fflate) → bytes del .xlsx. Vistas con estilo primero, "Resumen" al inicio, hojas "BD …" en crudo al final.
const C = { g: 'FF133A2B', g2: 'FF1F4D3A', gold: 'FFA4A16A', cream: 'FFF5F0E4', zebra: 'FFF7F3E8', white: 'FFFFFFFF', red: 'FFB23A48', ok: 'FF2D8A55', mute: 'FF6B7A72' };
const TZ = 'America/Mexico_City', DESDE_SALDOS = '2026-11-14';
const PERFIL = m => m.hidden ? 'Administrador' : m.guest ? 'Invitado' : ({ presidente: 'Presidente', secretario: 'Secretario', tesorero: 'Tesorero' })[m.role] || (m.board ? 'Board' : 'Socio');
const FUND = { hio: 'Hoyo en uno', noshow: 'No-show', general: 'General' };
const asDate = v => { if (!v) return null; const s = String(v); const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00Z') : new Date(s); return isNaN(d) ? null : d; };
// fecha/hora local de Guadalajara como "fecha de Excel" (sin zona)
// México sin horario de verano desde oct-2022: Guadalajara = UTC−6 fijo (mucho más rápido que Intl por fila)
const OFF = -6 * 3600e3;
const localDT = v => { if (v === null || v === undefined || v === '') return null; const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  const d = new Date(s); return isNaN(d) ? null : new Date(d.getTime() + OFF); };
const ymdLocal = d => new Date(d.getTime() + OFF).toISOString().slice(0, 10);
const seasonOf = ymd => { const [y, m] = ymd.split('-').map(Number); return `${y}-${m <= 6 ? 1 : 2}`; };
const num = v => (v === null || v === undefined || v === '') ? null : +v;
const cell = v => (v === null || v === undefined) ? null : (typeof v === 'object' ? JSON.stringify(v) : v);
const clip = v => (typeof v === 'string' && v.length > 32000) ? v.slice(0, 32000) + '…' : v;

// ===== Escritor XLSX mínimo (sin librerías pesadas): estilos fijos de la marca, celdas, combinaciones,
// encabezado congelado, filtros, cebra por formato condicional, totales con SUBTOTAL. Comprime con fflate.
const XS = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COL = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
// estilos (índices de cellXfs)
const S = { def: 0, title: 1, sub: 2, head: 3, text: 4, money: 5, date: 6, datetime: 7, int: 8, num: 9, wrap: 10, totL: 11, totM: 12, totI: 13, sec: 14, kvM: 15, kvI: 16, kvT: 17, note: 18, empty: 19, big: 20, label: 21 };
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0;[Red]-&quot;$&quot;#,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm"/></numFmts>
<fonts count="10"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Georgia"/></font><font><i/><sz val="9"/><color rgb="FF6B7A72"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF133A2B"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF133A2B"/><name val="Calibri"/></font><font><sz val="9"/><color rgb="FF6B7A72"/><name val="Calibri"/></font><font><b/><sz val="20"/><color rgb="FFFFFFFF"/><name val="Georgia"/></font><font><i/><sz val="10"/><color rgb="FF6B7A72"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF133A2B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4D3A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF5F0E4"/></patternFill></fill></fills>
<borders count="4"><border/><border><bottom style="medium"><color rgb="FFA4A16A"/></bottom></border><border><top style="medium"><color rgb="FFA4A16A"/></top></border><border><bottom style="thin"><color rgb="FFA4A16A"/></bottom></border></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="22">
<xf/>
<xf fontId="1" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
<xf fontId="2" applyFont="1" applyAlignment="1"><alignment indent="1"/></xf>
<xf fontId="3" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf fontId="4" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="4" numFmtId="164" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="4" numFmtId="165" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf fontId="4" numFmtId="166" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf fontId="4" numFmtId="3" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="4" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf fontId="4" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="5" fillId="4" borderId="2" applyFont="1" applyFill="1" applyBorder="1"/>
<xf fontId="5" fillId="4" borderId="2" numFmtId="164" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"/>
<xf fontId="5" fillId="4" borderId="2" numFmtId="3" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"/>
<xf fontId="6" fillId="4" borderId="3" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf fontId="5" numFmtId="164" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
<xf fontId="5" numFmtId="3" applyFont="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
<xf fontId="5" applyFont="1" applyAlignment="1"><alignment horizontal="right" vertical="top" wrapText="1"/></xf>
<xf fontId="7" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf fontId="9" applyFont="1"/>
<xf fontId="8" fillId="2" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
<xf fontId="4" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="1"><dxf><fill><patternFill patternType="solid"><bgColor rgb="FFF7F3E8"/></patternFill></fill></dxf></dxfs>
</styleSheet>`;
const serial = d => d.getTime() / 864e5 + 25569;
class Sheet {
  constructor(name, tab) { this.name = name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31); this.tab = tab; this.rows = new Map(); this.heights = {}; this.widths = []; this.merges = []; this.freeze = 0; this.filter = null; this.zebra = null; }
  set(r, c, v, s) { if (!this.rows.has(r)) this.rows.set(r, []); this.rows.get(r)[c] = [v, s]; }
  xml() {
    const cells = [...this.rows.keys()].sort((a, b) => a - b).map(r => { const row = this.rows.get(r); let o = `<row r="${r}"${this.heights[r] ? ` ht="${this.heights[r]}" customHeight="1"` : ''}>`;
      for (let c = 0; c < row.length; c++) { const x = row[c]; if (!x) continue; const [v, s] = x, ref = COL(c) + r, st = s ? ` s="${s}"` : '';
        if (v === null || v === undefined || v === '') o += `<c r="${ref}"${st}/>`;
        else if (v instanceof Date) o += isNaN(v) ? `<c r="${ref}"${st}/>` : `<c r="${ref}"${st}><v>${serial(v)}</v></c>`;
        else if (typeof v === 'number') o += isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}"${st}/>`;
        else if (typeof v === 'object' && v.f) o += `<c r="${ref}"${st}><f>${XS(v.f)}</f></c>`;
        else o += `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${XS(v)}</t></is></c>`; }
      return o + '</row>'; }).join('');
    const pane = this.freeze ? `<pane ySplit="${this.freeze}" topLeftCell="A${this.freeze + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheetPr>${this.tab ? `<tabColor rgb="${this.tab}"/>` : ''}</sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`
      + (this.widths.length ? `<cols>${this.widths.map((w, i) => w ? `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>` : '').join('')}</cols>` : '')
      + `<sheetData>${cells}</sheetData>` + (this.filter ? `<autoFilter ref="${this.filter}"/>` : '')
      + (this.merges.length ? `<mergeCells count="${this.merges.length}">${this.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '')
      + (this.zebra ? `<conditionalFormatting sqref="${this.zebra}"><cfRule type="expression" dxfId="0" priority="1"><formula>MOD(ROW(),2)=0</formula></cfRule></conditionalFormatting>` : '')
      + `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/></worksheet>`; }
}
function writeXlsx(sheets, zipSync, strToU8) {
  const f = {};
  f['[Content_Types].xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  f['_rels/.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const dn = sheets.map((s, i) => s.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${s.name.replace(/'/g, "''")}'!${s.filter.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2')}</definedName>` : '').join('');
  f['xl/workbook.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${XS(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${dn ? `<definedNames>${dn}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  f['xl/_rels/workbook.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  f['xl/styles.xml'] = STYLES;
  sheets.forEach((s, i) => { f[`xl/worksheets/sheet${i + 1}.xml`] = s.xml(); });
  const z = {}; for (const k in f) z[k] = strToU8(f[k]); return zipSync(z, { level: 6 });
}

function table(ws, { title, sub, cols, rows, totals, startRow = 1 }) {
  // cols: [{h, k|fn, w, t:'money'|'date'|'datetime'|'int'|'num'|'bool'|texto, wrap}]
  const n = cols.length, lastC = COL(Math.max(n, 2) - 1); let r = startRow;
  ws.set(r, 0, title, S.title); for (let c = 1; c < Math.max(n, 2); c++) ws.set(r, c, null, S.title); ws.merges.push(`A${r}:${lastC}${r}`); ws.heights[r] = 30; r++;
  ws.set(r, 0, sub || '', S.sub); ws.merges.push(`A${r}:${lastC}${r}`); r++;
  const hr = r; cols.forEach((c, i) => { ws.set(r, i, c.h, S.head); ws.widths[i] = c.w || 14; }); ws.heights[r] = 24; r++;
  const first = r, ST = { money: S.money, date: S.date, datetime: S.datetime, int: S.int, num: S.num };
  const conv = cols.map(c => c.t === 'date' || c.t === 'datetime' ? localDT : (c.t === 'money' || c.t === 'int' || c.t === 'num') ? num : c.t === 'bool' ? (v => v === null || v === undefined ? null : (v ? 'Sí' : 'No')) : (v => clip(cell(v))));
  const sty = cols.map(c => ST[c.t] || (c.wrap ? S.wrap : S.text));
  for (const row of rows) { for (let i = 0; i < n; i++) { const c = cols[i]; ws.set(r, i, conv[i](c.fn ? c.fn(row) : row[c.k]), sty[i]); } r++; }
  if (!rows.length) { ws.set(r, 0, 'Sin registros', S.empty); r++; }
  const last = r - 1;
  if (totals && rows.length) { cols.forEach((c, i) => { const L = COL(i);
      if (i === 0) ws.set(r, i, 'TOTAL', S.totL); else if (totals.includes(c.k || c.h)) ws.set(r, i, { f: `SUBTOTAL(9,${L}${first}:${L}${last})` }, c.t === 'money' ? S.totM : S.totI); else ws.set(r, i, null, S.totL); }); r++; }
  ws.filter = `A${hr}:${COL(n - 1)}${Math.max(last, hr)}`; ws.freeze = hr;
  if (rows.length) ws.zebra = `A${first}:${COL(n - 1)}${last}`;
  return r;
}
function compute(T, now) {
  const today = ymdLocal(now), wk0 = new Date(now.getTime() - 7 * 864e5), inWeek = v => { const d = asDate(v); return d && d >= wk0 && d <= now; };
  const M = (T.c_members || []).filter(m => !m.hidden), byId = new Map((T.c_members || []).map(m => [m.id, m])), nm = id => { const m = byId.get(id); return m ? (m.nickname || m.name) : ''; };
  const act = M.filter(m => m.active && !m.removed);
  const ev = (T.b_events || []).slice().sort((a, b) => String(a.event_date || '').localeCompare(String(b.event_date || '')));
  const ent = T.b_entries || [], cnt = id => ent.filter(e => e.event_id === id).length;
  const next = ev.find(e => !e.closed && !e.solo_historico && (e.event_date || '9999') >= today) || ev.find(e => !e.closed && !e.solo_historico);
  const lastC = ev.filter(e => e.closed).slice(-1)[0];
  // pagos de apuestas: plan congelado (b_settle_plan) + marcas de pagado (b_settle)
  const paid = new Map((T.b_settle || []).map(s => [s.event_id + '|' + s.payer + '|' + s.payee, s]));
  const evById = new Map(ev.map(e => [e.id, e]));
  const pagos = (T.b_settle_plan || []).flatMap(p => { const e = evById.get(p.event_id); if (!e || e.solo_historico || (e.event_date && e.event_date < DESDE_SALDOS)) return [];
    return (p.transfers || []).map(x => { const s = paid.get(p.event_id + '|' + x.payer + '|' + x.payee); return { torneo: e.name, fecha: e.event_date, payer: x.payer, payee: x.payee, amount: +x.amount, estado: s ? 'Pagado' : 'Pendiente', by: s ? (s.marked_by_name || nm(s.marked_by)) : '', at: s ? s.created_at : null }; }); })
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || a.estado.localeCompare(b.estado) || a.payer.localeCompare(b.payer));
  const sinPlan = ev.filter(e => e.closed && !e.solo_historico && (!e.event_date || e.event_date >= DESDE_SALDOS) && !(T.b_settle_plan || []).some(p => p.event_id === e.id));
  const season = seasonOf(today), dues = (T.t_dues || []).filter(d => d.season === season);
  const set = (T.c_settings || [])[0] || {};
  const fondos = {}; (T.t_moves || []).forEach(m => { fondos[m.fund] = (fondos[m.fund] || 0) + (+m.amount || 0); });
  const outW = (T.a_outings || []).filter(o => inWeek(o.out_date) || (o.out_date >= ymdLocal(wk0) && o.out_date <= today));
  const marksW = (T.a_marks || []).filter(k => outW.some(o => o.id === k.outing_id));
  const uW = (T.u_events || []).filter(u => inWeek(u.at)), usersW = new Set(uW.map(u => u.member_id).filter(Boolean));
  return { today, wk0, M, act, byId, nm, ev, cnt, next, lastC, pagos, sinPlan, season, dues, set, fondos, outW, marksW, uW, usersW, inWeek };
}

function buildWorkbook(dump, now = new Date()) {
  const T = dump.tables || {}, X = compute(T, now), sheets = [];
  const fmtD = d => { const x = localDT(d instanceof Date ? d.toISOString() : d); if (!x) return '—'; const M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']; return `${x.getUTCDate()} ${M[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
  const nowL = localDT(now.toISOString()), hhmm = `${String(nowL.getUTCHours()).padStart(2, '0')}:${String(nowL.getUTCMinutes()).padStart(2, '0')}`;
  const sub = `Respaldo generado el ${fmtD(now)} a las ${hhmm} (hora de Guadalajara)`;
  const pend = X.pagos.filter(p => p.estado === 'Pendiente'), pag = X.pagos.filter(p => p.estado === 'Pagado'), sum = L => L.reduce((a, p) => a + p.amount, 0);
  const prof = {}; X.act.forEach(m => { const p = PERFIL(m); prof[p] = (prof[p] || 0) + 1; });
  const reqP = (T.c_requests || []).filter(r => !['aprobada', 'rechazada'].includes(r.status));
  const R = []; const sec = s => R.push({ sec: s }); const kv = (k, v, t, nota) => R.push({ k, v, t, nota });
  sec('👥 Socios');
  kv('Socios activos', X.act.length, 'int');
  ['Presidente', 'Secretario', 'Tesorero', 'Board', 'Socio', 'Invitado'].forEach(p => kv(`      ${p}`, prof[p] || 0, 'int'));
  const altas = X.act.filter(m => X.inWeek(m.created_at));
  kv('Altas en la semana', altas.length, 'int', altas.map(m => m.nickname || m.name).join(', '));
  kv('Solicitudes de acceso pendientes', reqP.length, 'int', reqP.map(r => r.name).join(', '));
  sec('💰 Torneos y apuestas');
  kv('Próximo torneo', X.next ? X.next.name : '—', 'text', X.next ? `${fmtD(X.next.event_date)} · ${X.cnt(X.next.id)} inscritos en la quiniela · aportación $${(+X.next.aportacion || 0).toLocaleString('en-US')}` : '');
  kv('Último torneo cerrado', X.lastC ? X.lastC.name : '—', 'text', X.lastC ? fmtD(X.lastC.event_date) : '');
  kv('Pagos de apuestas pendientes', sum(pend), 'money', `${pend.length} pagos · torneos desde la Rosa`);
  kv('Pagos de apuestas ya liquidados', sum(pag), 'money', `${pag.length} pagos`);
  const pagW = pag.filter(p => X.inWeek(p.at)); kv('Pagos marcados esta semana', sum(pagW), 'money', `${pagW.length} pagos`);
  if (X.sinPlan.length) kv('⚠️ Torneos cerrados sin plan de pagos guardado', X.sinPlan.length, 'int', X.sinPlan.map(e => e.name).join(', ') + ' · se guarda solo al abrir Cuentas o Saldos con un usuario del Board');
  sec('💵 Tesorería');
  kv(`Cuotas pagadas temporada ${X.season}`, X.dues.length, 'int', `de ${X.act.filter(m => !m.guest).length} socios activos`);
  kv(`Monto de cuotas temporada ${X.season}`, X.dues.reduce((a, d) => a + (+d.amount || 0), 0), 'money');
  Object.keys(FUND).forEach(f => kv(`Fondo ${FUND[f]} (suma de movimientos)`, X.fondos[f] || 0, 'money'));
  sec('⛳ Salidas y asistencias (últimos 7 días)');
  kv('Salidas', X.outW.length, 'int', X.outW.map(o => `${fmtD(o.out_date)} ${o.label || o.tipo || ''}`.trim()).join(' · '));
  kv('Asistencias', X.marksW.filter(k => k.status === 'asistio').length, 'int');
  const ns = X.marksW.filter(k => k.status === 'no_show'); kv('No-shows', ns.length, 'int', ns.map(k => X.nm(k.member_id)).join(', '));
  sec('📣 Noticias y uso (últimos 7 días)');
  const nW = (T.n_news || []).filter(n => X.inWeek(n.created_at));
  kv('Noticias publicadas', nW.length, 'int', nW.slice(0, 6).map(n => n.title).join(' · '));
  kv('Socios que usaron la app', X.usersW.size, 'int');
  kv('Acciones registradas en la app', X.uW.length, 'int');
  // ---- Resumen
  const ws = new Sheet('Resumen', 'FFA4A16A'); sheets.push(ws);
  ws.set(1, 0, 'Hermanos McGregor · Respaldo semanal', S.big); ws.set(1, 1, null, S.big); ws.set(1, 2, null, S.big); ws.merges.push('A1:C1'); ws.heights[1] = 38;
  ws.set(2, 0, `${sub} · semana del ${fmtD(X.wk0)} al ${fmtD(now)}`, S.sub); ws.merges.push('A2:C2');
  ws.widths = [46, 24, 86]; let r = 4; ['Indicador', 'Valor', 'Detalle'].forEach((h, i) => ws.set(r, i, h, S.head)); ws.heights[r] = 22; r++; ws.freeze = 4;
  const z0 = r;
  R.forEach(o => { if (o.sec) { ws.set(r, 0, o.sec, S.sec); ws.set(r, 1, null, S.sec); ws.set(r, 2, null, S.sec); ws.merges.push(`A${r}:C${r}`); ws.heights[r] = 22; r++; return; }
    ws.set(r, 0, o.k, S.label); ws.set(r, 1, o.v, o.t === 'money' ? S.kvM : o.t === 'int' ? S.kvI : S.kvT); ws.set(r, 2, o.nota || null, S.note); r++; });
  // ---- Vistas
  const V = (name, cfg) => { const s = new Sheet(name, 'FF133A2B'); sheets.push(s); table(s, { sub, ...cfg }); };
  V('Socios', { title: 'Socios', rows: X.M.slice().sort((a, b) => ((b.active && !b.removed) - (a.active && !a.removed)) || String(a.name).localeCompare(b.name)), cols: [
    { h: 'Nombre', k: 'name', w: 26 }, { h: 'Apodo', k: 'nickname', w: 16 }, { h: 'Perfil', fn: PERFIL, w: 12 }, { h: 'Fundador', k: 'fundador', t: 'bool', w: 10 }, { h: 'Liga', k: 'liga', w: 10 },
    { h: 'HCP', k: 'hcp', t: 'num', w: 7 }, { h: 'Correo', k: 'email', w: 30 }, { h: 'Activo', fn: m => m.active && !m.removed, t: 'bool', w: 8 }, { h: 'Tiene foto', k: 'tiene_foto', t: 'bool', w: 10 }, { h: 'Alta', k: 'created_at', t: 'date', w: 12 }] });
  V('Torneos', { title: 'Torneos', rows: X.ev.slice().reverse(), totals: ['Inscritos quiniela'], cols: [
    { h: 'Torneo', k: 'name', w: 28 }, { h: 'Fecha', k: 'event_date', t: 'date', w: 12 }, { h: 'Campo', k: 'course', w: 18 }, { h: 'Formato', k: 'format', w: 11 },
    { h: 'Aportación', k: 'aportacion', t: 'money', w: 12 }, { h: 'Bolsa equipos', fn: e => (e.bolsas || {}).equipos || null, t: 'money', w: 13 }, { h: 'Bolsa podio', fn: e => (e.bolsas || {}).podio || null, t: 'money', w: 12 },
    { h: 'Inscritos quiniela', k: 'Inscritos quiniela', fn: e => X.cnt(e.id), t: 'int', w: 12 }, { h: 'Cerrado', k: 'closed', t: 'bool', w: 9 }, { h: 'Solo histórico', k: 'solo_historico', t: 'bool', w: 11 }] });
  V('Pagos de apuestas', { title: 'Pagos de apuestas · quién le paga a quién', rows: X.pagos, totals: ['amount'], cols: [
    { h: 'Torneo', k: 'torneo', w: 26 }, { h: 'Fecha', k: 'fecha', t: 'date', w: 12 }, { h: 'Paga', k: 'payer', w: 20 }, { h: 'Recibe', k: 'payee', w: 20 }, { h: 'Monto', k: 'amount', t: 'money', w: 12 },
    { h: 'Estado', k: 'estado', w: 11 }, { h: 'Marcado por', k: 'by', w: 18 }, { h: 'Fecha marcado', k: 'at', t: 'datetime', w: 16 }] });
  V('Cuotas', { title: 'Tesorería · cuotas de la liga', rows: (T.t_dues || []).slice().sort((a, b) => String(b.season).localeCompare(a.season) || X.nm(a.member_id).localeCompare(X.nm(b.member_id))), totals: ['amount'], cols: [
    { h: 'Temporada', k: 'season', w: 11 }, { h: 'Socio', fn: d => X.nm(d.member_id), w: 24 }, { h: 'Monto', k: 'amount', t: 'money', w: 12 }, { h: 'Pagado', k: 'paid_at', t: 'datetime', w: 16 }, { h: 'Notas', k: 'notes', w: 30 }] });
  V('Movimientos Tesorería', { title: 'Tesorería · movimientos de fondos', rows: (T.t_moves || []).slice().sort((a, b) => String(b.mov_date).localeCompare(a.mov_date)), totals: ['amount'], cols: [
    { h: 'Fecha', k: 'mov_date', t: 'date', w: 12 }, { h: 'Fondo', fn: m => FUND[m.fund] || m.fund, w: 14 }, { h: 'Concepto', k: 'concept', w: 36 }, { h: 'Monto', k: 'amount', t: 'money', w: 12 }, { h: 'Socio', fn: m => X.nm(m.member_id), w: 22 }, { h: 'Registró', fn: m => X.nm(m.created_by), w: 18 }] });
  const marks = T.a_marks || [], mk = new Map(); marks.forEach(k => { const o = mk.get(k.outing_id) || { a: 0, n: 0 }; if (k.status === 'asistio') o.a++; if (k.status === 'no_show') o.n++; mk.set(k.outing_id, o); });
  V('Salidas', { title: 'Salidas', rows: (T.a_outings || []).slice().sort((a, b) => String(b.out_date).localeCompare(a.out_date)), totals: ['Asistencias', 'No-shows'], cols: [
    { h: 'Fecha', k: 'out_date', t: 'date', w: 12 }, { h: 'Liga', k: 'liga', w: 10 }, { h: 'Tipo', k: 'tipo', w: 13 }, { h: 'Etiqueta', k: 'label', w: 24 }, { h: 'Cuota', k: 'fee', t: 'money', w: 10 },
    { h: 'Asistencias', k: 'Asistencias', fn: o => (mk.get(o.id) || {}).a || 0, t: 'int', w: 11 }, { h: 'No-shows', k: 'No-shows', fn: o => (mk.get(o.id) || {}).n || 0, t: 'int', w: 10 }, { h: 'Invitados', k: 'guests', w: 18 }, { h: 'Notas', k: 'notes', w: 30 }] });
  const outById = new Map((T.a_outings || []).map(o => [o.id, o])), od = k => String((outById.get(k.outing_id) || {}).out_date || '');
  V('Asistencias', { title: 'Asistencias y no-shows', rows: marks.slice().sort((a, b) => od(b).localeCompare(od(a))), totals: ['penalty'], cols: [
    { h: 'Fecha salida', fn: k => (outById.get(k.outing_id) || {}).out_date, t: 'date', w: 12 }, { h: 'Socio', fn: k => X.nm(k.member_id), w: 24 }, { h: 'Estado', fn: k => ({ asistio: 'Asistió', no_show: 'No-show' })[k.status] || k.status, w: 11 },
    { h: 'Multa', k: 'penalty', t: 'money', w: 10 }, { h: 'Multa pagada', k: 'penalty_paid', t: 'bool', w: 12 }, { h: 'Pagada el', k: 'paid_at', t: 'datetime', w: 16 }] });
  V('Calendario', { title: 'Calendario del club', rows: (T.c_calendar || []).slice().sort((a, b) => String(a.first_date).localeCompare(b.first_date)), cols: [
    { h: 'Año', k: 'year', t: 'num', w: 7 }, { h: 'Mes', k: 'month', t: 'num', w: 6 }, { h: 'Fecha', k: 'first_date', t: 'date', w: 12 }, { h: 'Días', k: 'days', w: 14 }, { h: 'Nombre', k: 'name', w: 30 }, { h: 'Tipo', k: 'tipo', w: 14 }, { h: 'Festejados', k: 'honorees', w: 30 }] });
  V('Noticias', { title: 'Noticias', rows: (T.n_news || []).slice().sort((a, b) => String(b.created_at).localeCompare(a.created_at)), cols: [
    { h: 'Fecha', k: 'created_at', t: 'datetime', w: 16 }, { h: 'Tipo', k: 'kind', w: 10 }, { h: 'Título', k: 'title', w: 40 }, { h: 'Texto', k: 'body', w: 70, wrap: true }] });
  // ---- BD en crudo (todas las columnas)
  Object.keys(T).sort().forEach(name => { const rows = T[name] || [], keys = [...new Set(rows.flatMap(x => Object.keys(x)))];
    const s = new Sheet('BD ' + name, 'FF6B7A72'); sheets.push(s);
    const t = k => /_date$/.test(k) ? 'date' : /(_at|^at)$/.test(k) ? 'datetime' : null;
    table(s, { title: `BD · ${name}`, sub: `${rows.length} registros · ${sub}`, rows, cols: keys.length ? keys.map(k => ({ h: k, k, w: Math.min(40, Math.max(10, k.length + 4)), t: t(k) || undefined })) : [{ h: '(tabla vacía)', k: 'x', w: 20 }] }); });
  return sheets;
}
// buildXlsx(dump, now, {zipSync, strToU8}) → Uint8Array del .xlsx
function buildXlsx(dump, now, z) { return writeXlsx(buildWorkbook(dump, now), z.zipSync, z.strToU8); }

const J = (status: number, msg: string) => new Response(JSON.stringify({ error: msg }), { status, headers: { "content-type": "application/json; charset=utf-8" } });
function same(a: string, b: string) { const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b); let d = x.length ^ y.length; for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0); return d === 0; }
Deno.serve(async (req) => {
  const secret = Deno.env.get("BACKUP_DRIVE_KEY");
  if (!secret) return J(500, "Falta el secret BACKUP_DRIVE_KEY en Supabase (Edge Functions → Secrets).");
  const key = req.headers.get("x-backup-key") || "";
  if (!key || !same(key, secret)) return J(401, "Clave de respaldo inválida o ausente (header x-backup-key).");
  const url = Deno.env.get("SUPABASE_URL"), sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !sk) return J(500, "La función no tiene SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  const r = await fetch(`${url}/rest/v1/rpc/bk_dump`, { method: "POST", headers: { apikey: sk, Authorization: `Bearer ${sk}`, "content-type": "application/json" }, body: "{}" });
  if (!r.ok) return J(502, `No se pudieron leer los datos (${r.status}): ${(await r.text()).slice(0, 300)}`);
  const dump = await r.json(), now = new Date();
  const bytes = buildXlsx(dump, now, { zipSync, strToU8 });
  const ymd = new Date(now.getTime() - 6 * 3600e3).toISOString().slice(0, 10);
  return new Response(bytes, { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="McGregor_respaldo_${ymd}.xlsx"`, "cache-control": "no-store" } });
});
