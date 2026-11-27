// Dışarıdan kütüphane kullanmadan basit Word (.docx) dosyası üretir.
// paragraflar: [{ parcalar: [{ t, b, u, renk }], hiza: 'center'|'left', bosluk: sonrası (pt), sayfaSonu: true }]

const xmlEsc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function calisma(p) {
  const r = [];
  if (p.b) r.push('<w:b/><w:bCs/>');
  if (p.u) r.push('<w:u w:val="single"/>');
  if (p.renk) r.push(`<w:color w:val="${p.renk}"/>`);
  return `<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>${r.join('')}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.t)}</w:t></w:r>`;
}

function paragraf(p) {
  if (p.sayfaSonu) return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const ppr = `<w:pPr><w:spacing w:before="0" w:after="${Math.round((p.bosluk ?? 4) * 20)}" w:line="264" w:lineRule="auto"/>${p.girinti ? `<w:ind w:left="${p.girinti}"/>` : ''}${p.hiza === 'center' ? '<w:jc w:val="center"/>' : ''}</w:pPr>`;
  return `<w:p>${ppr}${(p.parcalar || []).map(calisma).join('')}</w:p>`;
}

export function belgeXml(paragraflar) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraflar.map(paragraf).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

// ---- Sıkıştırmasız ZIP ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

// Bazı okuyucular (ör. iPhone'un önizlemesi) sıfır tarihli zip kayıtlarını reddedebilir; geçerli bir DOS tarihi yazılır
const TARIH = (() => { const d = new Date(); return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); })();
function zip(dosyalar) {
  const enc = new TextEncoder(), parcalar = [], merkez = [];
  let ofs = 0;
  for (const [ad, icerik] of dosyalar) {
    const a = enc.encode(ad), v = enc.encode(icerik), c = crc32(v);
    const yerel = new DataView(new ArrayBuffer(30));
    yerel.setUint32(0, 0x04034b50, true); yerel.setUint16(4, 20, true); yerel.setUint16(6, 0x0800, true); yerel.setUint16(12, TARIH, true);
    yerel.setUint32(14, c, true); yerel.setUint32(18, v.length, true); yerel.setUint32(22, v.length, true); yerel.setUint16(26, a.length, true);
    parcalar.push(new Uint8Array(yerel.buffer), a, v);
    const m = new DataView(new ArrayBuffer(46));
    m.setUint32(0, 0x02014b50, true); m.setUint16(4, 20, true); m.setUint16(6, 20, true); m.setUint16(8, 0x0800, true); m.setUint16(14, TARIH, true);
    m.setUint32(16, c, true); m.setUint32(20, v.length, true); m.setUint32(24, v.length, true); m.setUint16(28, a.length, true); m.setUint32(42, ofs, true);
    merkez.push(new Uint8Array(m.buffer), a);
    ofs += 30 + a.length + v.length;
  }
  const mBoy = merkez.reduce((t, x) => t + x.length, 0), son = new DataView(new ArrayBuffer(22));
  son.setUint32(0, 0x06054b50, true); son.setUint16(8, dosyalar.length, true); son.setUint16(10, dosyalar.length, true);
  son.setUint32(12, mBoy, true); son.setUint32(16, ofs, true);
  return new Blob([...parcalar, ...merkez, new Uint8Array(son.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function docx(paragraflar) {
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="tr-TR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>'],
    ['word/document.xml', belgeXml(paragraflar)]
  ]);
}

// iPhone'da (özellikle ana ekrana eklenmiş uygulamada) dosya indirme çalışmaz; orada paylaşım menüsü açılır,
// kullanıcı "Dosyalar'a Kaydet", Word ya da WhatsApp'ı seçer. Diğer cihazlarda dosya doğrudan iner.
export async function indir(blob, ad) {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && navigator.canShare) {
    const f = new File([blob], ad, { type: blob.type });
    if (navigator.canShare({ files: [f] })) {
      try { await navigator.share({ files: [f], title: ad }); return; }
      catch (x) { if (x?.name === 'AbortError') return; }
    }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ad;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
