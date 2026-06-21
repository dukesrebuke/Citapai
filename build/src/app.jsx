
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

const SAVED_KEY = 'citapai_saved_v1';
const THEME_KEY = 'citapai_theme_v1';
const LANG_KEY  = 'citapai_lang_v1';

function loadSaved()  { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; } }
function persistSaved(items) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(items)); } catch {} }
function loadTheme()  { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; } }
function persistTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch {} }
function loadLang()   { try { return localStorage.getItem(LANG_KEY)  || 'es'; } catch { return 'es'; } }
function persistLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch {} }

function parseSharedParam() {
  try {
    const enc = new URLSearchParams(window.location.search).get('shared');
    return enc ? JSON.parse(atob(enc)) : null;
  } catch { return null; }
}

function useToast() {
  const [msg, setMsg]         = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);
  const show = useCallback((text) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(text);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 2400);
  }, []);
  return { msg, visible, show };
}

function copyText(text, onSuccess, onFail) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => execCopy(text, onSuccess, onFail));
  } else {
    execCopy(text, onSuccess, onFail);
  }
}
function execCopy(text, onSuccess, onFail) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy') ? onSuccess() : onFail(); } catch { onFail(); }
  document.body.removeChild(ta);
}

/* ── i18n ── */
const T = {
  es: {
    planBtn:       'Curar Mi Cita',
    loading:       ['Escaneando barrios...', 'Consultando a los locales...', 'Evitando los turistas...', 'Chequeando el ambiente...', 'Ya casi...'],
    saved:         'Guardadas',
    noSaved:       'Ninguna cita guardada aún. Cura una y guárdala.',
    save:          'Guardar',
    savedCheck:    'Guardada ✓',
    share:         'Compartir',
    tryAnother:    'Otra Idea',
    viewMap:       'Ver en Maps',
    whatsapp:      'Reservar por WhatsApp',
    error:         'El curador no responde. Intenta de nuevo.',
    hours:         'Horario',
    bestTime:      'Mejor Momento',
    crowd:         'Afluencia',
    cost:          'Costo',
    source:        'Fuente',
    proTipLabel:   'Pro Tip',
    savedToast:    'Cita guardada',
    removedToast:  'Eliminada',
    copiedToast:   'Link copiado',
    dateType:      'Tipo de Cita',
    timeOfDay:     'Hora del Día',
    atmosphere:    'Ambiente',
    price:         'Presupuesto',
    neighborhood:  'Barrio',
    dateTypes:     [['foodie','Gastronómica'],['adventurous','Aventura'],['cultural','Cultural'],['relaxing','Relajante'],['active','Activa']],
    times:         [['morning','Mañana'],['afternoon','Tarde'],['evening','Noche'],['late night','Noche Tarde']],
    atmospheres:   [['romantic','Romántica'],['intimate','Íntima'],['social','Social'],['lowkey','Tranquila'],['lively','Animada']],
    prices:        [['budget','Económico'],['mid','Moderado'],['upscale','Especial'],['splurge','Lujo']],
    neighborhoods: [['any','Cualquier Barrio'],['El Poblado','El Poblado'],['Laureles','Laureles'],['Envigado','Envigado'],['El Centro','El Centro'],['Estadio','Estadio'],['Aranjuez','Aranjuez'],['Belén','Belén'],['La América','La América'],['Prado','Prado'],['Castilla','Castilla'],['Guayabal','Guayabal'],['Manila','Manila']],
  },
  en: {
    planBtn:       'Curate My Date',
    loading:       ['Scanning neighborhoods...', 'Asking the locals...', 'Avoiding tourist traps...', 'Checking the vibe...', 'Almost there...'],
    saved:         'Saved',
    noSaved:       'No saved dates yet. Curate one and hit Save.',
    save:          'Save',
    savedCheck:    'Saved ✓',
    share:         'Share',
    tryAnother:    'Try Another',
    viewMap:       'View on Map',
    whatsapp:      'Reserve on WhatsApp',
    error:         'The curator is unavailable. Please try again.',
    hours:         'Hours',
    bestTime:      'Best Time',
    crowd:         'Crowd',
    cost:          'Cost',
    source:        'Source',
    proTipLabel:   'Pro Tip',
    savedToast:    'Date saved',
    removedToast:  'Removed',
    copiedToast:   'Link copied',
    dateType:      'Date Type',
    timeOfDay:     'Time of Day',
    atmosphere:    'Atmosphere',
    price:         'Price Range',
    neighborhood:  'Neighborhood',
    dateTypes:     [['foodie','Foodie'],['adventurous','Adventurous'],['cultural','Cultural'],['relaxing','Relaxing'],['active','Active']],
    times:         [['morning','Morning'],['afternoon','Afternoon'],['evening','Evening'],['late night','Late Night']],
    atmospheres:   [['romantic','Romantic'],['intimate','Intimate'],['social','Social'],['lowkey','Low-Key'],['lively','Lively']],
    prices:        [['budget','Budget'],['mid','Mid'],['upscale','Upscale'],['splurge','Splurge']],
    neighborhoods: [['any','Anywhere'],['El Poblado','El Poblado'],['Laureles','Laureles'],['Envigado','Envigado'],['El Centro','El Centro'],['Estadio','Estadio'],['Aranjuez','Aranjuez'],['Belén','Belén'],['La América','La América'],['Prado','Prado'],['Castilla','Castilla'],['Guayabal','Guayabal'],['Manila','Manila']],
  }
};

function App() {
  const [theme,     setThemeState] = useState(loadTheme);
  const [lang,      setLangState]  = useState(loadLang);
  const [loading,   setLoading]    = useState(false);
  const [loadLine,  setLoadLine]   = useState(0);
  const [result,    setResult]     = useState(null);
  const [error,     setError]      = useState(null);
  const [saved,     setSaved]      = useState(loadSaved);
  const [showSaved, setShowSaved]  = useState(false);
  const [isSaved,   setIsSaved]    = useState(false);

  const [dateType,     setDateType]     = useState('foodie');
  const [timeOfDay,    setTimeOfDay]    = useState('evening');
  const [atmosphere,   setAtmosphere]   = useState('romantic');
  const [price,        setPrice]        = useState('mid');
  const [neighborhood, setNeighborhood] = useState('any');
  // Venues already shown this session, so "Try Another" / retries don't repeat them.
  // Capped client-side too — kept small so it doesn't bloat the request payload.
  const [shownVenues,  setShownVenues]  = useState([]);

  const toast        = useToast();
  const resultRef    = useRef(null);
  const loadInterval = useRef(null);
  const t            = T[lang];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    persistTheme(theme);
  }, [theme]);

  const toggleTheme = () => setThemeState(th => th === 'dark' ? 'light' : 'dark');

  const toggleLang = () => {
    const next = lang === 'es' ? 'en' : 'es';
    setLangState(next);
    persistLang(next);
    document.documentElement.lang = next;
  };

  useEffect(() => {
    const shared = parseSharedParam();
    if (shared) {
      setResult(shared);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      setLoadLine(0);
      loadInterval.current = setInterval(() => setLoadLine(l => (l + 1) % t.loading.length), 900);
    } else {
      clearInterval(loadInterval.current);
    }
    return () => clearInterval(loadInterval.current);
  }, [loading, lang]);

  useEffect(() => {
    if (!result) { setIsSaved(false); return; }
    const key = result.MapQuery || result.Title;
    setIsSaved(saved.some(s => (s.MapQuery || s.Title) === key));
  }, [result, saved]);

  const fetchOnce = async (excludedVenues = []) => {
    const res = await fetch('/.netlify/functions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateType, timeOfDay, atmosphere, price, neighborhood, lang, excludedVenues })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error('No candidate returned');

    // Extract citation sources
    let citationSources = [];
    const gm = candidate.groundingMetadata;
    if (gm?.groundingAttributions) {
      citationSources = gm.groundingAttributions
        .map(a => ({ uri: a.web?.uri, title: a.web?.title }))
        .filter(s => s.uri && s.title);
    }

    const rawText = candidate.content.parts[0].text;
    const parsed  = parseModelResponse(rawText);

    if (!parsed.Title || !parsed.Location) throw new Error('Unexpected model format');

    return { parsed, citationSources };
  };

  const generate = async () => {
    setLoading(true); setError(null); setResult(null); setIsSaved(false);
    const MAX_ATTEMPTS = 2; // safety net only — the server already retries the finder stage internally
    let lastGood = null;
    const localExcluded = [...shownVenues]; // grows within this call too, so attempt 2 doesn't repeat attempt 1's pick
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const { parsed, citationSources } = await fetchOnce(localExcluded);
        lastGood = { parsed, citationSources };
        if (parsed.Title) localExcluded.push(parsed.Title);
        const isVerified = (parsed.Verified || '').trim().toLowerCase().startsWith('y');
        if (isVerified) break;
        // Not verified — loop again for a fresh round trip.
      }
      const { parsed, citationSources } = lastGood;
      setResult({ ...parsed, _citationSources: citationSources });
      if (parsed.Title) {
        setShownVenues(prev => [...prev, parsed.Title].slice(-12));
      }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  };

  const parseModelResponse = (text) => {
    const data = {};
    text.split('\n').filter(l => l.trim()).forEach(line => {
      const [rawKey, ...rest] = line.split(':');
      if (!rawKey || rest.length === 0) return;
      const k = rawKey.trim().toLowerCase();
      const v = rest.join(':').trim();
      if (k.startsWith('title'))                        data.Title       = v;
      else if (k.startsWith('location'))                data.Location    = v;
      else if (k.startsWith('map'))                     data.MapQuery    = v;
      else if (k.startsWith('desc'))                    data.Description = v;
      else if (k.startsWith('hour') || k.startsWith('hora')) data.Hours  = v;
      else if (k.startsWith('phone') || k.startsWith('tel'))    data.Phone = v;
      else if (k.includes('best') || k.includes('mejor'))   data.BestTime= v;
      else if (k.includes('occup') || k.includes('afluen')) data.Occupancy = v;
      else if (k.startsWith('verif'))                   data.Verified    = v;
    });
    return data;
  };

  const saveDate = () => {
    if (!result || isSaved) return;
    const updated = [{ ...result, savedAt: Date.now() }, ...saved].slice(0, 20);
    setSaved(updated); persistSaved(updated); setIsSaved(true);
    toast.show(t.savedToast);
  };

  const removeDate = (key) => {
    const updated = saved.filter(s => (s.MapQuery || s.Title) !== key);
    setSaved(updated); persistSaved(updated);
    if (result && (result.MapQuery || result.Title) === key) setIsSaved(false);
    toast.show(t.removedToast);
  };

  const shareDate = (item) => {
    const encoded = btoa(JSON.stringify(item));
    const url = `${window.location.origin}/app.html?shared=${encoded}`;
    copyText(url, () => toast.show(t.copiedToast), () => window.prompt('Copy this link:', url));
  };

  const mapHref = (item) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.MapQuery || item.Title + ' Medellín')}`;

  const whatsappHref = (item) => {
    if (!item.Phone) return null;
    const digits = item.Phone.replace(/[^\d]/g, '');
    if (!digits) return null;
    const msg = lang === 'es'
      ? `Hola, vi "${item.Title}" en Citapai y quisiera reservar para una cita.`
      : `Hi, I saw "${item.Title}" on Citapai and would like to make a reservation.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  };

  const Pill = ({ value, current, set, label }) => (
    <button onClick={() => set(value)} className={`pill${current === value ? ' active' : ''}`}>{label}</button>
  );

  return (
    <>
      {/* Topbar */}
      <div className="topbar">
        <a href="/" className="logo">Citapai<span>.</span></a>
        <div className="topbar-right">
          <button className={`topbar-btn${showSaved ? ' active' : ''}`} onClick={() => setShowSaved(s => !s)}>
            {t.saved}{saved.length > 0 ? ` (${saved.length})` : ''}
          </button>
          <button className="lang-toggle" onClick={toggleLang}>{lang === 'es' ? 'EN' : 'ES'}</button>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" />
        </div>
      </div>

      <div className="app-shell">

        {/* Saved drawer */}
        {showSaved && (
          <div style={{ marginBottom: '40px' }}>
            <div className="saved-header">
              <h3>{t.saved}</h3>
              {saved.length > 0 && <span className="saved-count">{saved.length} {lang === 'es' ? 'guardadas' : 'saved'}</span>}
            </div>
            {saved.length === 0
              ? <p className="empty-italic">{t.noSaved}</p>
              : saved.map(item => {
                  const key = item.MapQuery || item.Title;
                  return (
                    <div className="saved-item" key={key + item.savedAt}>
                      <div className="saved-item-info">
                        <div className="saved-item-neighborhood">{item.Location}</div>
                        <div className="saved-item-title">{item.Title}</div>
                        <div className="saved-item-desc">{item.Description}</div>
                      </div>
                      <div className="saved-item-actions">
                        <a className="icon-btn" href={mapHref(item)} target="_blank" rel="noopener noreferrer">Map</a>
                        <button className="icon-btn" onClick={() => shareDate(item)}>Share</button>
                        <button className="icon-btn danger" onClick={() => removeDate(key)}>✕</button>
                      </div>
                    </div>
                  );
                })
            }
            <div className="rule" style={{ margin: '28px 0 0 0' }} />
          </div>
        )}

        {/* Filters */}
        <div style={{ marginBottom: '40px' }}>

          <div className="filter-group">
            <div className="section-label">{t.dateType}</div>
            <div className="pill-row">
              {t.dateTypes.map(([v, l]) => <Pill key={v} value={v} current={dateType} set={setDateType} label={l} />)}
            </div>
          </div>

          <div className="filter-group">
            <div className="section-label">{t.timeOfDay}</div>
            <div className="pill-row">
              {t.times.map(([v, l]) => <Pill key={v} value={v} current={timeOfDay} set={setTimeOfDay} label={l} />)}
            </div>
          </div>

          <div className="filter-group">
            <div className="section-label">{t.atmosphere}</div>
            <div className="pill-row">
              {t.atmospheres.map(([v, l]) => <Pill key={v} value={v} current={atmosphere} set={setAtmosphere} label={l} />)}
            </div>
          </div>

          <div className="filter-group">
            <div className="section-label">{t.price}</div>
            <div className="pill-row">
              {t.prices.map(([v, l]) => <Pill key={v} value={v} current={price} set={setPrice} label={l} />)}
            </div>
          </div>

          <div className="filter-group">
            <div className="section-label">{t.neighborhood}</div>
            <div className="pill-row">
              {t.neighborhoods.map(([v, l]) => <Pill key={v} value={v} current={neighborhood} set={setNeighborhood} label={l} />)}
            </div>
          </div>

          <button className="btn-generate" onClick={generate} disabled={loading}>
            {loading ? t.loading[loadLine] : t.planBtn}
          </button>

          {error && <div className="error-msg">{error}</div>}
        </div>

        {/* Result card */}
        {result && (
          <div ref={resultRef}>
            <div className="result-card">
              <div className="result-neighborhood">{result.Location}</div>
              <h2 className="result-title">{result.Title}</h2>
              <p className="result-description">{result.Description}</p>

              {result.ProTip && (
                <div className="pro-tip">
                  <strong>{t.proTipLabel}</strong>
                  {result.ProTip}
                </div>
              )}

              <div className="result-meta">
                <div className="meta-item"><label>{t.hours}</label><span>{result.Hours}</span></div>
                <div className="meta-item"><label>{t.bestTime}</label><span>{result.BestTime}</span></div>
                {result.PriceNote && <div className="meta-item"><label>{t.cost}</label><span>{result.PriceNote}</span></div>}
                {result.Occupancy && <div className="meta-item"><label>{t.crowd}</label><span>{result.Occupancy}</span></div>}
              </div>

              <div className="result-actions">
                <a className="btn-action primary" href={mapHref(result)} target="_blank" rel="noopener noreferrer">
                  {t.viewMap}
                </a>
                {whatsappHref(result) && (
                  <a className="btn-action" href={whatsappHref(result)} target="_blank" rel="noopener noreferrer">
                    {t.whatsapp}
                  </a>
                )}
                <button className={`btn-action${isSaved ? ' saved' : ''}`} onClick={saveDate} disabled={isSaved}>
                  {isSaved ? t.savedCheck : t.save}
                </button>
                <button className="btn-action" onClick={() => shareDate(result)}>{t.share}</button>
                <button className="btn-action" onClick={generate} disabled={loading}>{t.tryAnother}</button>
              </div>

              {result._citationSources && result._citationSources.length > 0 && (
                <div className="citation-box">
                  <p>{t.source}</p>
                  <a href={result._citationSources[0].uri} target="_blank" rel="noopener noreferrer">
                    {result._citationSources[0].title || result._citationSources[0].uri}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <div className={`toast${toast.visible ? ' show' : ''}`}>{toast.msg}</div>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
