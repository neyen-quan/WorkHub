import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MessageCircle, Send, Mail, FolderOpen, Sparkles, ChevronDown, ExternalLink, PanelsTopLeft, Plus, Search, ArrowLeft, File as FileIcon, Folder, Image, FileText, Table2, Film, RefreshCw, HardDrive, ShieldCheck, LayoutGrid, Sun, Moon, Facebook, Linkedin, CalendarDays, FolderPlus, Pencil, Trash2, Columns2, Copy, Scissors, ClipboardPaste, Smartphone, Languages } from 'lucide-react';
import './style.css';
import {version as APP_VERSION} from '../package.json';

const EMAILS = [
  { id: 'gmail-laacade', email: '', short: 'Laacade', color: '#4389d1' },
  { id: 'gmail-neyen', email: '', short: 'Personal', color: '#d75f4a' },
  { id: 'gmail-hincharc', email: '', short: 'HinchaRC', color: '#22a889' },
  { id: 'gmail-quan', email: '', short: 'Quan', color: '#8b72dc' },
  { id: 'gmail-deva', email: '', short: 'Deva', color: '#d29b46' },
  { id: 'gmail-alterframe', email: '', short: 'Alterframe', color: '#2c9dba' }
];
const AI_APPS = [
  { id: 'gpt-personal', name: 'GPT personal · ', short: 'GPT Personal', sub: 'Cuenta ', icon: Sparkles },
  { id: 'gpt-alterframe', name: 'GPT Alterframe · ', short: 'GPT AlterFrame', sub: 'Cuenta ', icon: Sparkles },
  { id: 'ia-nico', name: 'IA Nico', short: 'IA Nico', sub: 'Portal de trabajo', icon: PanelsTopLeft },
  { id: 'gemini-personal', name: 'Gemini Personal · ', short: 'Gemini Personal', sub: 'Cuenta ', icon: Sparkles }
];
const MESSAGING_APPS = [
  { id: 'wa-personal', name: 'WhatsApp Personal', short: 'WhatsApp Personal', icon: MessageCircle },
  { id: 'wa-work', name: 'WhatsApp Laburo', short: 'WhatsApp Laburo', icon: MessageCircle },
  { id: 'telegram', name: 'Telegram', short: 'Telegram', icon: Send }
];
const DEFAULT_MICROINFLUENCERS_URL = '';
const GMAIL_DEVA_STARTUP_MIGRATION = 'workhub-gmail-deva-startup-v2';
const TABS = [
  { id: 'gmail', title: 'Gmail', icon: Mail },
  { id: 'calendar', title: 'Calendario', icon: CalendarDays, FolderPlus, Pencil, Trash2 },
  { id: 'linkedin', title: 'LinkedIn', icon: Linkedin },
  { id: 'facebook', title: 'Facebook', icon: Facebook },
  ...AI_APPS.map(app => ({ id: app.id, title: app.short, icon: app.icon })),
  { id: 'microinfluencers', title: 'Microinfluencers', icon: Smartphone },
  { id: 'translator', title: 'Translator', icon: Languages },
  { id: 'documents', title: 'Documentos', icon: FolderOpen }
];

const TAB_IDS = TABS.map(item => item.id);
const isAiProvider = id => AI_APPS.some(app => app.id === id);
function loadNameOverrides(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter(([id, name]) => typeof id === 'string' && typeof name === 'string'))
      : {};
  } catch { return {}; }
}
const DEFAULT_AI_WORKSPACE = [
  { id: 'chat-default-personal', service: 'gpt-personal', name: 'GPT Personal', url: 'https://chatgpt.com/', customName: false },
  { id: 'chat-default-alterframe', service: 'gpt-alterframe', name: 'GPT Alterframe', url: 'https://chatgpt.com/', customName: false },
  { id: 'chat-default-nico', service: 'ia-nico', name: 'Guía de Nico', url: 'https://portal-colegas.vercel.app/login', customName: false },
  { id: 'chat-default-gemini-personal', service: 'gemini-personal', name: 'Gemini Personal', url: 'https://gemini.google.com/app?hl=es-419', customName: false }
];
const AI_PROVIDER_TABS_MIGRATION = 'workhub-ai-provider-tabs-migrated-v1';
const GEMINI_PERSONAL_TAB_MIGRATION = 'workhub-gemini-personal-tab-v1';
function loadAiWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem('workhub-ai-chat-tabs') || 'null');
    const valid = Array.isArray(saved) ? saved.filter(item => AI_APPS.some(app => app.id === item?.service) && typeof item.id === 'string') : [];
    if (valid.length) {
      const current = valid.map(item => ({ ...item, name: String(item.name || 'Chat IA'), url: String(item.url || ''), customName: Boolean(item.customName) }));
      if (!localStorage.getItem(AI_PROVIDER_TABS_MIGRATION)) {
        for (const providerTab of DEFAULT_AI_WORKSPACE) {
          if (!current.some(item => item.service === providerTab.service)) current.push(providerTab);
        }
        localStorage.setItem(AI_PROVIDER_TABS_MIGRATION, 'done');
      }
      if (!localStorage.getItem(GEMINI_PERSONAL_TAB_MIGRATION)) {
        if (!current.some(item => item.service === 'gemini-personal')) current.push(DEFAULT_AI_WORKSPACE.find(item => item.service === 'gemini-personal'));
        localStorage.setItem(GEMINI_PERSONAL_TAB_MIGRATION, 'done');
      }
      return current;
    }
  } catch {}
  try { localStorage.setItem(AI_PROVIDER_TABS_MIGRATION, 'done'); } catch {}
  return DEFAULT_AI_WORKSPACE;
}
function normalizeAiSplitPanes(value, aiTabs) {
  const source = Array.isArray(value) && value.length === 2 ? value : DEFAULT_SPLIT_PANES;
  return source.map((pane, index) => {
    const section = pane?.section === 'ai' || TAB_IDS.includes(pane?.section) ? pane.section : DEFAULT_SPLIT_PANES[index].section;
    if (section !== 'ai') {
      const choices = SPLIT_SUBOPTIONS[section] || [];
      const sub = choices.some(option => option.id === pane?.sub) ? pane.sub : choices[0]?.id || '';
      return { section, sub };
    }
    const current = aiTabs.find(item => item.id === pane?.sub) || aiTabs.find(item => item.service === pane?.sub) || aiTabs[0];
    return { section: 'ai', sub: current?.id || DEFAULT_AI_WORKSPACE[0].id };
  });
}
function aiViewId(item) { return `ai-chat-${item.id}::${item.service}`; }
const DEFAULT_FOLDER_TABS = ['gmail', 'calendar', 'linkedin', 'facebook'];
function makeDefaultNav() {
  const order = (() => { try { const old = JSON.parse(localStorage.getItem('workhub-tab-order') || 'null'); return Array.isArray(old) ? [...old.filter((id, i) => TAB_IDS.includes(id) && old.indexOf(id) === i), ...TAB_IDS.filter(id => !old.includes(id))] : TAB_IDS; } catch { return TAB_IDS; } })();
  const folder = { type: 'folder', id: 'folder-social', name: 'Redes y agenda', open: false, children: order.filter(id => DEFAULT_FOLDER_TABS.includes(id)) };
  let inserted = false;
  const items = [];
  for (const id of order) {
    if (DEFAULT_FOLDER_TABS.includes(id)) { if (!inserted) { items.push(folder); inserted = true; } }
    else items.push({ type: 'tab', id });
  }
  return items;
}
function loadNavItems() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('workhub-tab-structure') || 'null'); } catch {}
  if (!Array.isArray(saved)) return makeDefaultNav();
  const result = [], seen = new Set();
  const addTab = id => { if (id === 'ai') { AI_APPS.forEach(app => addTab(app.id)); return; } if (TAB_IDS.includes(id) && !seen.has(id)) { result.push({ type: 'tab', id }); seen.add(id); } };
  for (const item of saved) {
    if (item?.type === 'tab') addTab(item.id);
    else if (item?.type === 'folder' && typeof item.id === 'string' && typeof item.name === 'string') {
      const children = [];
      for (const id of Array.isArray(item.children) ? item.children : []) {
        if (id === 'ai') { for (const app of AI_APPS) if (!seen.has(app.id)) { children.push(app.id); seen.add(app.id); } }
        else if (TAB_IDS.includes(id) && !seen.has(id)) { children.push(id); seen.add(id); }
      }
      result.push({ type: 'folder', id: item.id, name: item.name, open: Boolean(item.open), children });
    }
  }
  // Put Gemini alongside the provider tabs in the user's existing Trabajo/IA
  // folder. If no provider folder exists, leave the normal top-level fallback.
  if (!seen.has('gemini-personal')) {
    const providerFolder = result.find(item => item.type === 'folder' && item.children.some(id => ['gpt-personal', 'gpt-alterframe', 'ia-nico'].includes(id)));
    if (providerFolder) { providerFolder.children.push('gemini-personal'); seen.add('gemini-personal'); }
  }
  if (TAB_IDS.includes('translator') && !seen.has('translator')) {
    const workFolder = result.find(item => item.type === 'folder' && item.children.includes('gpt-personal')) || result.find(item => item.type === 'folder' && item.children.some(id => AI_APPS.some(app => app.id === id)));
    if (workFolder) { workFolder.children.push('translator'); seen.add('translator'); }
  }
  TAB_IDS.filter(id => !seen.has(id)).forEach(id => result.push({ type: 'tab', id }));
  return result;
}
function removeTab(items, tabId) {
  return items.map(item => item.type === 'folder' ? { ...item, children: item.children.filter(id => id !== tabId) } : item).filter(item => item.type !== 'tab' || item.id !== tabId);
}

const MAX_WORKSPACE_PANELS = 3;
function workspacePanelKey(panel) {
  return panel.section === 'ai' ? `ai:${panel.sub}` : panel.section === 'documents' ? `documents:${panel.slot ?? 0}` : panel.section;
}
function orderWorkspacePanels(panels, navItems, aiTabs) {
  const order = navItems.flatMap(item => item.type === 'folder' ? item.children : [item.id]);
  const seen = new Set();
  return (Array.isArray(panels) ? panels : []).filter(panel => panel && typeof panel.section === 'string').map((panel,index) => ({
    panel: panel.section === 'documents' && !Number.isInteger(panel.slot) ? {...panel,slot:index} : panel,
    index,
    service: panel.section === 'ai' ? aiTabs.find(chat => chat.id === panel.sub)?.service : panel.section
  })).filter(entry => {
    const key = workspacePanelKey(entry.panel);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b) => {
    const rank = service => order.includes(service) ? order.indexOf(service) : order.length;
    const top = rank(a.service) - rank(b.service);
    if (top) return top;
    if (a.panel.section === 'ai' && b.panel.section === 'ai') return aiTabs.findIndex(chat => chat.id === a.panel.sub) - aiTabs.findIndex(chat => chat.id === b.panel.sub);
    if (a.panel.section === 'documents' && b.panel.section === 'documents') return a.panel.slot - b.panel.slot;
    return a.index - b.index;
  }).map(entry => entry.panel);
}
function workspacePanelLimit(panels, aiTabs) {
  return panels.length > 0 && panels.every(panel => panel.section === 'ai' && aiTabs.find(chat => chat.id === panel.sub)?.service === 'gpt-personal') ? 2 : MAX_WORKSPACE_PANELS;
}
function normalizeWorkspacePanels(panels, navItems, aiTabs) {
  const ordered = orderWorkspacePanels(panels,navItems,aiTabs);
  return ordered.slice(0,workspacePanelLimit(ordered,aiTabs));
}
function workspaceReplacementOptions(current, target, aiTabs) {
  return current.filter(panel => {
    const next = [...current.filter(item => workspacePanelKey(item) !== workspacePanelKey(panel)),target];
    return next.length <= workspacePanelLimit(next,aiTabs);
  });
}
function planWorkspacePanelSelection(current, target, replaceKey = null, aiTabs = []) {
  const key = workspacePanelKey(target);
  if (current.some(panel => workspacePanelKey(panel) === key)) {
    return {panels:current.length > 1 ? current.filter(panel => workspacePanelKey(panel) !== key) : current};
  }
  if (current.length + 1 > workspacePanelLimit([...current,target],aiTabs)) {
    if (replaceKey == null) return {panels:current,needsReplacement:true};
    if (!workspaceReplacementOptions(current,target,aiTabs).some(panel => workspacePanelKey(panel) === replaceKey)) return {panels:current};
    return {panels:[...current.filter(panel => workspacePanelKey(panel) !== replaceKey),target]};
  }
  return {panels:[...current,target]};
}

const INITIAL_PERSONAL_USAGE = {
  source:'pending', observedAt:null, fiveHour:null, weekly:null,
  resetsObservedAt:Date.parse('2026-10-13T15:03:40Z'), resetsSource:'captura',
  resets:[
    {label:'22/10 · 15:30',expiresAt:Date.parse('2026-10-22T18:30:00Z')},
    {label:'29/10 · 16:07',expiresAt:Date.parse('2026-10-29T19:07:00Z')},
    {label:'06/11 · 18:41',expiresAt:Date.parse('2026-11-06T21:41:00Z')}
  ]
};
function PersonalUsageStrip() {
  const [usage, setUsage] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('workhub-personal-usage'));
      return stored?.source === 'chatgpt' && stored?.fiveHour && stored?.weekly ? { ...INITIAL_PERSONAL_USAGE, ...stored, resets:stored.resets || INITIAL_PERSONAL_USAGE.resets } : INITIAL_PERSONAL_USAGE;
    } catch { return INITIAL_PERSONAL_USAGE; }
  });
  const [now,setNow] = useState(Date.now);
  const [connection,setConnection] = useState({status:'checking'});
  const formatDate = value => value ? new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)) : 'sin lectura';
  function accept(next) {
    if (!next) return;
    setConnection({status:next.status || 'ready',error:next.error,retryAt:next.retryAt});
    if (!next.fiveHour && !next.weekly) return;
    setUsage(current => ({...current,...next,
      resets:Array.isArray(next.resets) ? next.resets : current.resets,
      resetsSource:Array.isArray(next.resets) ? 'chatgpt' : current.resetsSource,
      resetsObservedAt:Array.isArray(next.resets) ? next.observedAt : current.resetsObservedAt
    }));
  }
  async function sync(force = false) {
    try { accept(await window.workhub?.readPersonalUsage?.(force)); }
    catch { setConnection({status:'error',error:'No se pudo consultar el uso automáticamente.'}); }
  }
  useEffect(()=>{localStorage.setItem('workhub-personal-usage',JSON.stringify(usage));},[usage]);
  useEffect(()=>{
    const unsubscribe=window.workhub?.onPersonalUsage?.(accept);
    sync();
    const interval=setInterval(()=>{setNow(Date.now());sync();},60000);
    return ()=>{clearInterval(interval);unsubscribe?.();};
  },[]);
  const activeResets=usage.resets.filter(reset=>!reset.expiresAt || reset.expiresAt>now);
  const detail=connection.error || usage.resetsError || `Uso de Work/Codex. Última lectura: ${formatDate(usage.observedAt)}. Actualización automática cada cinco minutos.`;
  const resetCount=Number.isInteger(usage.resetCount) ? usage.resetCount : activeResets.length;
  function meter(label,data) {
    const due=data?.resetAt && data.resetAt<=now;
    return <div className="gpt-usage-meter" title={`Última consulta: ${formatDate(usage.observedAt)}${due ? '. Pasó el reinicio previsto; esperando una lectura nueva.' : ''}`}>
      <span><strong>{label}</strong> {data && !due ? `${Math.round(data.left)}%` : '—'}</span>
      {data && !due && <progress value={data.left} max="100" aria-label={`${label}: ${data.left}% restante`}/>}
      {data?.resetAt && <span className="gpt-usage-reset-date">↻ {formatDate(data.resetAt)}</span>}
    </div>;
  }
  return <section className="gpt-usage-strip" aria-label="Uso automático de GPT Personal">
    <div className="gpt-usage-caption"><strong>Uso</strong><span className={`gpt-usage-state ${connection.status}`} title={detail} role="status" aria-label={detail}>{connection.status==='error' || usage.resetsError ? 'Error' : connection.status==='checking' ? '…' : '●'}</span><button type="button" onClick={()=>sync(true)} title={`${detail}${connection.retryAt ? ` Próximo intento: ${formatDate(connection.retryAt)}.` : ''}`} aria-label="Reintentar consulta automática de uso"><RefreshCw size={12}/></button></div>
    {meter('5h',usage.fiveHour)}{meter('Semana',usage.weekly)}
    <div className="gpt-usage-resets" title={`Última lectura de resets: ${formatDate(usage.resetsObservedAt)}. ${usage.resetsSource!=='chatgpt' ? 'Vencimientos de tu captura; disponibilidad pendiente de confirmar automáticamente.' : 'Vencimientos en hora Argentina.'}`}><strong>Resets {resetCount}{usage.resetsSource!=='chatgpt' ? '*' : ''}</strong><div>{activeResets.map((reset,index)=><span key={`${reset.label}-${index}`} title={`Vence ${reset.expiresAt ? formatDate(reset.expiresAt) : reset.label} · Argentina`}>{reset.expiresAt ? formatDate(reset.expiresAt) : reset.label}</span>)}</div></div>
  </section>;
}

function App() {
  useEffect(()=>{window.workhub?.desktopReady?.();},[]);
  const [tab, setTab] = useState(() => {
    // After the one-time Gmail setup patch, open only the fifth account so it
    // can be signed in without changing any of the other account profiles.
    try {
      if (!localStorage.getItem(GMAIL_DEVA_STARTUP_MIGRATION)) {
        localStorage.setItem('workhub-selected-mail-accounts', JSON.stringify(['gmail-deva']));
        localStorage.setItem('workhub-global-panels', JSON.stringify([{ section: 'gmail' }]));
        localStorage.setItem(GMAIL_DEVA_STARTUP_MIGRATION, 'done');
        return 'gmail';
      }
    } catch {}
    try { const saved = JSON.parse(localStorage.getItem('workhub-global-panels') || 'null'); const panel = Array.isArray(saved) && saved.length ? saved.at(-1) : null; const section = panel?.section; if (section === 'ai') { const chats = JSON.parse(localStorage.getItem('workhub-ai-chat-tabs') || '[]'); return chats.find(item => item.id === panel.sub)?.service || 'gpt-personal'; } if (TAB_IDS.includes(section) || section === 'documents') return section; } catch {}
    return 'gpt-personal';
  });
  const [aiTabs, setAiTabs] = useState(loadAiWorkspace);
  const providerViewMemory = useRef(null);
  if (providerViewMemory.current === null) {
    try {
      const saved = JSON.parse(localStorage.getItem('workhub-ai-provider-views') || '{}');
      providerViewMemory.current = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { providerViewMemory.current = {}; }
  }
  const [activeAiTabId, setActiveAiTabId] = useState(() => localStorage.getItem('workhub-ai-active-tab') || DEFAULT_AI_WORKSPACE[0].id);
  const [visibleAiTabIds, setVisibleAiTabIds] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('workhub-ai-visible-tabs') || 'null'); return Array.isArray(saved) ? saved : [DEFAULT_AI_WORKSPACE[0].id]; } catch { return [DEFAULT_AI_WORKSPACE[0].id]; }
  });
  const [aiChatDialog, setAiChatDialog] = useState(null);
  const [aiDialogError, setAiDialogError] = useState('');
  const [draggedAiTabId, setDraggedAiTabId] = useState(null);
  const [aiDropTarget, setAiDropTarget] = useState(null);
  const [aiGridRatios, setAiGridRatios] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('workhub-ai-grid-ratios') || 'null'); return { x: Math.max(25,Math.min(75,Number(saved?.x)||50)), x2: Math.max(43,Math.min(82,Number(saved?.x2)||66.67)), y: Math.max(25,Math.min(75,Number(saved?.y)||50)) }; } catch { return { x:50, x2:66.67, y:50 }; }
  });
  const [globalPanelState, setGlobalPanelState] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workhub-global-panels') || 'null');
      const panels = Array.isArray(saved) ? saved.filter(panel => panel?.section !== 'messaging') : [];
      const legacyIds = visibleAiTabIds.filter(id => aiTabs.some(chat => chat.id === id));
      return panels.length <= 1 && panels.every(panel => panel.section === 'ai') && isAiProvider(tab) && legacyIds.length > panels.length ? legacyIds.map(sub => ({section:'ai',sub})) : panels;
    } catch { return []; }
  });
  const [panelReplacement, setPanelReplacement] = useState(null);
  const [navItems, setNavItems] = useState(loadNavItems);
  const [tabNames, setTabNames] = useState(() => loadNameOverrides('workhub-tab-names'));
  const [mailAccountNames, setMailAccountNames] = useState(() => loadNameOverrides('workhub-mail-account-names'));
  const [draggedItem, setDraggedItem] = useState(null);
  const [tabContext, setTabContext] = useState(null);
  const [folderDialog, setFolderDialog] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('workhub-theme') === 'light' ? 'light' : 'dark');
  const [visibleMessageIds, setVisibleMessageIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workhub-visible-messaging-apps') || 'null');
      const valid = Array.isArray(saved) ? MESSAGING_APPS.map(app => app.id).filter(id => saved.includes(id)) : [];
      return valid.length ? valid : ['wa-personal'];
    } catch { return ['wa-personal']; }
  });
  const [activeMessageId, setActiveMessageId] = useState(() => {
    const saved = localStorage.getItem('workhub-active-messaging-app');
    return MESSAGING_APPS.some(app => app.id === saved) ? saved : 'wa-personal';
  });
  const [microUrl, setMicroUrl] = useState(() => localStorage.getItem('workhub-microinfluencers-url') || DEFAULT_MICROINFLUENCERS_URL);
  const [microUrlDraft, setMicroUrlDraft] = useState(() => localStorage.getItem('workhub-microinfluencers-url') || DEFAULT_MICROINFLUENCERS_URL);
  const [selectedMailIds, setSelectedMailIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('workhub-selected-mail-accounts') || 'null');
      const valid = Array.isArray(saved) ? saved.filter(id => EMAILS.some(account => account.id === id)) : [];
      return valid.length ? EMAILS.map(account => account.id).filter(id => valid.includes(id)) : EMAILS.map(account => account.id);
    } catch { return EMAILS.map(account => account.id); }
  });
  const [calendarAccount, setCalendarAccount] = useState('gmail-laacade');
  const [folder, setFolder] = useState(() => localStorage.getItem('workhub-folder') || '');
  const [splitDocs, setSplitDocs] = useState(() => {
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('workhub-docs-panes') || '[]'); } catch {}
    return [0, 1, 2, 3].map(index => ({ folder: saved[index]?.folder || localStorage.getItem('workhub-folder') || '', stack: Array.isArray(saved[index]?.stack) ? saved[index].stack : [], entries: [], filter: '', selectedPaths: [], selectionAnchor: '' }));
  });
  const [updateFolder, setUpdateFolder] = useState('');
  const [entries, setEntries] = useState([]);
  const [folderStack, setFolderStack] = useState([]);
  const [selectedPaths, setSelectedPaths] = useState([]);
  const [selectionAnchor, setSelectionAnchor] = useState('');
  const [filter, setFilter] = useState('');
  const clipboardWrite = useRef(Promise.resolve());
  const [documentMenu, setDocumentMenu] = useState(null);
  const [documentStatus, setDocumentStatus] = useState('');
  const documentBusy = useRef(false);
  const [patchError, setPatchError] = useState('');
  const [patchBusy, setPatchBusy] = useState(false);
  const [patchDragActive, setPatchDragActive] = useState(false);
  const [viewError, setViewError] = useState(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const inDesktop = Boolean(window.workhub);

  useEffect(() => window.workhub?.onAttachmentDragStatus?.(setDocumentStatus), []);

  useEffect(() => {
    localStorage.setItem('workhub-theme', theme);
    window.workhub?.setTheme(theme);
  }, [theme]);

  const activeAiTab = aiTabs.find(item => item.id === activeAiTabId) || aiTabs[0] || DEFAULT_AI_WORKSPACE[0];
  const providerAiTabs = aiTabs.filter(item => item.service === tab);
  const providerActiveAiTab = providerAiTabs.find(item => item.id === activeAiTabId) || providerAiTabs[0] || activeAiTab;
  const globalPanels = useMemo(() => normalizeWorkspacePanels(globalPanelState,navItems,aiTabs),[globalPanelState,navItems,aiTabs]);
  function setGlobalPanels(update) {
    setGlobalPanelState(current => {
      const ordered = normalizeWorkspacePanels(current,navItems,aiTabs);
      return normalizeWorkspacePanels(typeof update === 'function' ? update(ordered) : update,navItems,aiTabs);
    });
  }
  const selectedAiTabs = useMemo(() => {
    const ids = globalPanels.length ? globalPanels.filter(panel => panel.section === 'ai').map(panel => panel.sub) : visibleAiTabIds;
    return orderWorkspacePanels(ids.map(sub => ({section:'ai',sub})),navItems,aiTabs).slice(0,workspacePanelLimit(globalPanels.length ? globalPanels : ids.map(sub => ({section:'ai',sub})),aiTabs)).map(panel => aiTabs.find(chat => chat.id === panel.sub)).filter(Boolean);
  },[globalPanels,visibleAiTabIds,navItems,aiTabs]);
  const aiViewTargets = useMemo(() => Object.fromEntries(aiTabs.map(item => [aiViewId(item), item.url || ''])), [aiTabs]);
  const viewTargets = useMemo(() => ({ ...aiViewTargets, microinfluencers: microUrl, ...Object.fromEntries(globalPanels.flatMap((panel, index) => panel.section === 'microinfluencers' ? [[`global-${index}::microinfluencers`, microUrl]] : [])) }), [aiViewTargets, microUrl, globalPanels]);
  useEffect(() => { localStorage.setItem('workhub-microinfluencers-url', microUrl); }, [microUrl]);
  useEffect(() => { localStorage.setItem('workhub-ai-chat-tabs', JSON.stringify(aiTabs)); }, [aiTabs]);
  useEffect(() => { localStorage.setItem('workhub-ai-active-tab', activeAiTab.id); }, [activeAiTab.id]);
  useEffect(() => { localStorage.setItem('workhub-ai-visible-tabs', JSON.stringify(selectedAiTabs.map(item => item.id))); }, [selectedAiTabs]);
  useEffect(() => { localStorage.setItem('workhub-ai-grid-ratios', JSON.stringify(aiGridRatios)); }, [aiGridRatios]);
  useEffect(() => { localStorage.setItem('workhub-selected-mail-accounts', JSON.stringify(selectedMailIds)); }, [selectedMailIds]);
  useEffect(() => { localStorage.setItem('workhub-tab-names', JSON.stringify(tabNames)); }, [tabNames]);
  useEffect(() => { localStorage.setItem('workhub-mail-account-names', JSON.stringify(mailAccountNames)); }, [mailAccountNames]);
  useEffect(() => { localStorage.setItem('workhub-visible-messaging-apps', JSON.stringify(visibleMessageIds)); }, [visibleMessageIds]);
  useEffect(() => { localStorage.setItem('workhub-active-messaging-app', activeMessageId); }, [activeMessageId]);

  useEffect(() => { localStorage.setItem('workhub-global-panels', JSON.stringify(globalPanels)); }, [globalPanels]);
  useEffect(() => {
    localStorage.setItem('workhub-docs-panes', JSON.stringify(splitDocs.map(({ folder: root, stack }) => ({ folder: root, stack }))));
  }, [splitDocs]);

  function panelViewId(panel, index = 0) {
    if (!panel) return null;
    // Keep the same translator document when moving from full view to a split.
    if (panel.section === 'translator') return 'translator';
    if (panel.section === 'messaging') return activeMessageId;
    if (panel.section === 'gmail') return selectedMailIds[0] || 'gmail-laacade';
    if (panel.section === 'calendar') return `calendar-${calendarAccount.replace('gmail-', '')}`;
    if (panel.section === 'facebook' || panel.section === 'linkedin') return panel.section;
    if (panel.section === 'microinfluencers') return 'microinfluencers';
    if (panel.section === 'ai') { const item = aiTabs.find(candidate => candidate.id === panel.sub) || activeAiTab; return aiViewId(item); }
    return null;
  }
  const globalViewIds = useMemo(() => globalPanels.map((panel, index) => panel.section === 'documents' ? null : panelViewId(panel, index)), [globalPanels, activeMessageId, selectedMailIds, calendarAccount, aiTabs, activeAiTab]);
  const mixedGlobalPanels = globalPanels.length > 1 && !(globalPanels.every(panel => panel.section === 'ai'));
  const multiAiGlobal = globalPanels.length > 1 && globalPanels.every(panel => panel.section === 'ai');
  const showPersonalUsage = mixedGlobalPanels || multiAiGlobal ? globalPanels.some(panel => panel.section === 'ai' && aiTabs.find(item => item.id === panel.sub)?.service === 'gpt-personal') : tab === 'gpt-personal';

  const viewIds = useMemo(() => {
    if (tab === 'messaging') return MESSAGING_APPS.map(app => app.id).filter(id => visibleMessageIds.includes(id));
    if (tab === 'gmail') return selectedMailIds;
    if (isAiProvider(tab)) return selectedAiTabs.length ? selectedAiTabs.map(aiViewId) : [aiViewId(providerActiveAiTab)];
    if (tab === 'facebook' || tab === 'linkedin' || tab === 'microinfluencers' || tab === 'translator') return [tab];
    if (tab === 'calendar') return [calendarAccount.replace('gmail-', 'calendar-')];
    return [];
  }, [tab, visibleMessageIds, selectedMailIds, selectedAiTabs, providerActiveAiTab, calendarAccount]);

  useEffect(() => {
    if (!inDesktop) return;
    const update = () => {
      const chrome = document.querySelector('.chrome');
      const overlay = document.querySelector('.overlay-bar, .global-layout-bar');
      const caption = document.querySelector('.remote-label, .mosaic-label, .messaging-mosaic-label');
      const top = (chrome?.getBoundingClientRect().height || 0) + (overlay?.getBoundingClientRect().height || 0) + (caption?.getBoundingClientRect().height || 0);
      const modalOpen = Boolean(folderDialog || aiChatDialog || documentMenu || panelReplacement);
      if (chrome) {
        const globalIds = mixedGlobalPanels && !modalOpen ? globalViewIds : null;
        const aiIds = !modalOpen && (multiAiGlobal ? globalViewIds : isAiProvider(tab) && !mixedGlobalPanels ? viewIds : null);
        window.workhub.layout(modalOpen ? [] : globalIds ? [] : viewIds, top, globalIds, aiGridRatios.x, aiIds, aiGridRatios, viewTargets);
      }
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    const chrome = document.querySelector('.chrome');
    if (chrome) observer.observe(chrome);
    window.addEventListener('resize', update);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); };
  }, [inDesktop, viewIds, layoutKey, folderDialog, aiChatDialog, documentMenu, panelReplacement, globalViewIds, mixedGlobalPanels, multiAiGlobal, tab, viewTargets]);

  useEffect(() => {
    if (!inDesktop || !window.workhub.onSplitRatiosChanged) return;
    return window.workhub.onSplitRatiosChanged(ratios => {
      if (!ratios || !Number.isFinite(ratios.x) || !Number.isFinite(ratios.y)) return;
      setAiGridRatios(current => current.x === ratios.x && current.y === ratios.y && current.x2 === ratios.x2 ? current : ratios);
    });
  }, [inDesktop]);

  useEffect(() => {
    if (!inDesktop) return;
    const offError = window.workhub.onViewError(e => setViewError(e));
    const offReady = window.workhub.onViewReady?.(({ viewId }) => {
      setViewError(current => current?.viewId === viewId ? null : current);
    });
    return () => { offError?.(); offReady?.(); };
  }, [inDesktop]);

  useEffect(() => {
    if (!inDesktop || !window.workhub.onAiViewNavigation) return;
    return window.workhub.onAiViewNavigation(({ viewId, url }) => {
      if (!url) return;
      setAiTabs(current => {
        const item = current.find(candidate => aiViewId(candidate) === viewId);
        if (!item || item.url === url) return current;
        return current.map(candidate => candidate.id === item.id ? { ...candidate, url } : candidate);
      });
    });
  }, [inDesktop]);

  useEffect(() => {
    const path = folderStack.at(-1) || folder;
    if (path && inDesktop) window.workhub.listFolder(path).then(setEntries);
    else setEntries([]);
  }, [folder, folderStack, inDesktop]);

  useEffect(() => {
    if (!folder || !inDesktop) { setUpdateFolder(''); return; }
    let cancelled = false;
    window.workhub.ensurePatchFolder(folder).then(path => {
      if (cancelled) return;
      setUpdateFolder(path || '');
      if (path && folderStack.length === 0) window.workhub.listFolder(folder).then(items => { if (!cancelled) setEntries(items); });
    });
    return () => { cancelled = true; };
  }, [folder, inDesktop]);

  const splitDocPaths = splitDocs.map((doc, index) => doc.stack.at(-1) || doc.folder || folder);
  useEffect(() => {
    if (!inDesktop || !mixedGlobalPanels) return;
    globalPanels.forEach((pane, index) => {
      const slot = Number.isInteger(pane.slot) ? pane.slot : index;
      if (pane.section !== 'documents' || !splitDocPaths[slot]) return;
      const target = splitDocPaths[slot];
      window.workhub.listFolder(target).then(items => setSplitDocs(current => current.map((doc, i) => {
        const currentPath = doc.stack.at(-1) || doc.folder || folder;
        return i === slot && currentPath === target ? { ...doc, entries: items } : doc;
      })));
    });
  }, [inDesktop, mixedGlobalPanels, globalPanels, splitDocPaths[0], splitDocPaths[1], splitDocPaths[2], splitDocPaths[3], folder]);

  function updateSplitDoc(index, patch) {
    setSplitDocs(current => current.map((doc, i) => i === index ? { ...doc, ...patch } : doc));
  }
  function pickFolder(paneIndex = null) {
    if (!inDesktop) return;
    window.workhub.pickFolder().then(value => {
      if (!value) return;
      if (paneIndex !== null) updateSplitDoc(paneIndex, { folder: value, stack: [], entries: [], filter: '' });
      else { setFolder(value); localStorage.setItem('workhub-folder', value); setFolderStack([]); setSelectedPaths([]); setSelectionAnchor(''); }
    });
  }
  async function createDocumentFolder(parent, name, paneIndex = null) {
    const result = await window.workhub.createFolder(parent, name);
    if (!result?.ok) throw new Error(result?.error || 'No se pudo crear la carpeta.');
    const updatedEntries = await window.workhub.listFolder(parent);
    if (paneIndex === null) setEntries(updatedEntries);
    else updateSplitDoc(paneIndex, { entries: updatedEntries, selectedPaths: [], selectionAnchor: '' });
    setDocumentStatus(`Carpeta “${name.trim()}” creada.`);
  }
  function isUpdatePath(path) { return Boolean(updateFolder) && path.replace(/[\\/]+$/,'').toLowerCase() === updateFolder.replace(/[\\/]+$/,'').toLowerCase(); }
  async function dropPatchFiles(event) {
    event.preventDefault();
    setPatchDragActive(false);
    setPatchError('');
    const files = [...(event.dataTransfer?.files || [])].map(file => window.workhub.getPathForFile(file)).filter(Boolean);
    if (!files.length) { setPatchError('No pude leer los archivos soltados. Probá arrastrar el ZIP desde el Explorador de Windows.'); return; }
    const result = await window.workhub.stagePatches(files);
    if (!result?.ok) { setPatchError(result?.error || 'No se pudo importar el ZIP.'); return; }
    setEntries(await window.workhub.listFolder(currentFolder));
  }
  async function applyPatch(file) {
    if (!window.confirm('Workhub se va a cerrar, aplicar este parche y volver a abrirse. ¿Continuar?')) return;
    setPatchError('');
    setPatchBusy(true);
    const result = await window.workhub.applyPatch(file);
    if (!result?.ok) { setPatchError(result?.error || 'No se pudo iniciar el parche.'); setPatchBusy(false); }
  }
  async function refreshDocumentsAfterTransfer() {
    const mainPath = currentFolder;
    const refreshes = [];
    if (mainPath) refreshes.push(window.workhub.listFolder(mainPath).then(setEntries));
    for (let index = 0; index < 4; index++) {
      const docPanel = globalPanels.find((panel, panelIndex) => panel.section === 'documents' && (Number.isInteger(panel.slot) ? panel.slot : panelIndex) === index);
      const path = splitDocPaths[index];
      if (!path || !mixedGlobalPanels || !docPanel) continue;
      refreshes.push(window.workhub.listFolder(path).then(items => setSplitDocs(current => current.map((doc, i) => {
        const currentPath = doc.stack.at(-1) || doc.folder || folder;
        return i === index && currentPath === path ? { ...doc, entries: items } : doc;
      }))));
    }
    await Promise.all(refreshes);
  }
  async function dropDocumentFiles(event, destinationFolder) {
    event.preventDefault();
    if (!inDesktop) return;
    const internalPayload = event.dataTransfer?.getData('application/x-workhub-files') || event.dataTransfer?.getData('text/plain') || '';
    let items = [];
    if (internalPayload.startsWith('workhub-files:')) {
      try { items = JSON.parse(internalPayload.slice('workhub-files:'.length)).filter(item => item?.path); } catch { items = []; }
    }
    if (!items.length) items = [...(event.dataTransfer?.files || [])].map(file => ({ path: window.workhub.getPathForFile(file) })).filter(item => item.path);
    if (!items.length) return;
    const operation = event.ctrlKey ? 'copy' : event.shiftKey ? 'move' : 'auto';
    event.stopPropagation();
    await runDocumentAction(async () => {
      const result = await window.workhub.transferFiles(items, destinationFolder, operation);
      await refreshDocumentsAfterTransfer();
      if (result?.cancelled) { setDocumentStatus('Operación cancelada.'); return; }
      if (!result?.ok) throw new Error(result?.error || 'No se pudieron transferir los elementos.');
      setDocumentStatus(`${result.transferred ?? items.length} elemento(s) transferidos.`);
    }, 'Transfiriendo archivos…');
  }
  async function runDocumentAction(action, message) {
    if (documentBusy.current) return;
    documentBusy.current = true;
    setDocumentStatus(message);
    try { await action(); }
    catch (error) { setDocumentStatus(error.message || 'No se pudo completar la operación.'); }
    finally { documentBusy.current = false; }
  }
  function copyDocumentSelection(items, operation) {
    if (!items.length) return;
    setDocumentStatus(operation === 'move' ? 'Preparando para mover…' : 'Copiando al portapapeles…');
    const pending = clipboardWrite.current.catch(() => {}).then(() => window.workhub.writeFileClipboard(items, operation));
    clipboardWrite.current = pending;
    pending.then(result => setDocumentStatus(result?.ok ? `${items.length} elemento(s) listos para pegar.` : result?.error || 'No se pudo usar el portapapeles.'), error => setDocumentStatus(error.message));
    return pending;
  }
  async function pasteDocumentItems(destinationFolder) {
    return runDocumentAction(async () => {
      const writeResult = await clipboardWrite.current;
      if (writeResult?.ok === false) throw new Error(writeResult.error || 'No se pudo copiar la selección.');
      const clipboard = await window.workhub.readFileClipboard();
      if (clipboard?.error) throw new Error(clipboard.error);
      if (!clipboard?.paths?.length) { setDocumentStatus('No hay archivos en el portapapeles.'); return; }
      const result = await window.workhub.transferFiles(clipboard.paths, destinationFolder, clipboard.operation || 'copy');
      await refreshDocumentsAfterTransfer();
      if (result?.cancelled) { setDocumentStatus('Operación cancelada.'); return; }
      if (!result?.ok) throw new Error(result?.error || 'No se pudieron pegar los archivos.');
      if (clipboard.operation === 'move') await window.workhub.clearFileClipboard();
      setDocumentStatus(`${result.transferred ?? clipboard.paths.length} elemento(s) transferidos.`);
    }, 'Pegando archivos…');
  }
  async function deleteDocumentSelection(items) {
    if (!items.length) return;
    return runDocumentAction(async () => {
      const result = await window.workhub.trashFiles(items);
      await refreshDocumentsAfterTransfer();
      if (result?.cancelled) { setDocumentStatus('Eliminación cancelada.'); return; }
      if (!result?.ok) throw new Error(result?.error || 'No se pudieron eliminar los archivos.');
      setDocumentStatus('Elementos enviados a la Papelera.');
    }, 'Enviando a la Papelera…');
  }
  function saveNav(next) {
    setNavItems(next);
    localStorage.setItem('workhub-tab-structure', JSON.stringify(next));
  }
  function tabName(tabId) {
    return tabNames[tabId] || TABS.find(item => item.id === tabId)?.title || tabId;
  }
  function mailAccountName(account) {
    return mailAccountNames[account.id] || account.short;
  }
  function startNavDrag(type, id, event) {
    const payload = `${type}:${id}`;
    setDraggedItem({ type, id });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', payload);
  }
  function handleNavDrop(targetType, targetId, event) {
    event.preventDefault();
    event.stopPropagation();
    const raw = event.dataTransfer.getData('text/plain');
    const split = raw.indexOf(':');
    const sourceType = split > 0 ? raw.slice(0, split) : draggedItem?.type;
    const sourceId = split > 0 ? raw.slice(split + 1) : draggedItem?.id;
    if (!sourceType || !sourceId || (sourceType === targetType && sourceId === targetId)) return;
    let next = structuredClone(navItems);
    if (sourceType === 'tab' && targetType === 'folder') {
      next = removeTab(next, sourceId);
      const group = next.find(item => item.type === 'folder' && item.id === targetId);
      if (group && !group.children.includes(sourceId)) { group.children.push(sourceId); group.open = true; }
    } else if (sourceType === 'tab' && targetType === 'tab') {
      const targetFolder = next.find(item => item.type === 'folder' && item.children.includes(targetId));
      const sourceFolder = next.find(item => item.type === 'folder' && item.children.includes(sourceId));
      next = removeTab(next, sourceId);
      if (targetFolder && sourceFolder?.id === targetFolder.id) {
        const group = next.find(item => item.type === 'folder' && item.id === targetFolder.id);
        group.children.splice(group.children.indexOf(targetId), 0, sourceId);
      } else if (targetFolder) {
        const group = next.find(item => item.type === 'folder' && item.id === targetFolder.id);
        group.children.splice(group.children.indexOf(targetId), 0, sourceId);
        group.open = true;
      } else {
        const at = next.findIndex(item => item.type === 'tab' && item.id === targetId);
        next.splice(at < 0 ? next.length : at, 0, { type: 'tab', id: sourceId });
      }
    } else if (sourceType === 'tab' && targetType === 'end') {
      next = removeTab(next, sourceId);
      next.push({ type: 'tab', id: sourceId });
    } else if (sourceType === 'folder' && targetType === 'folder') {
      const from = next.findIndex(item => item.type === 'folder' && item.id === sourceId);
      const to = next.findIndex(item => item.type === 'folder' && item.id === targetId);
      if (from >= 0 && to >= 0) next.splice(to, 0, next.splice(from, 1)[0]);
    } else if (sourceType === 'folder' && targetType === 'tab') {
      const from = next.findIndex(item => item.type === 'folder' && item.id === sourceId);
      const to = next.findIndex(item => item.type === 'tab' && item.id === targetId);
      if (from >= 0 && to >= 0) next.splice(to, 0, next.splice(from, 1)[0]);
    } else if (sourceType === 'folder' && targetType === 'end') {
      const from = next.findIndex(item => item.type === 'folder' && item.id === sourceId);
      if (from >= 0) next.push(next.splice(from, 1)[0]);
    }
    saveNav(next);
  }
  function createFolderFromTab(tabId) {
    setFolderDialog({ mode: 'create-tab', name: 'Nueva carpeta', tabId });
  }
  function createEmptyFolder() {
    setFolderDialog({ mode: 'create-empty', name: 'Nueva carpeta' });
  }
  function submitFolderDialog() {
    const name = folderDialog?.name?.trim();
    if (!name) return;
    if (folderDialog.mode === 'create-document') {
      createDocumentFolder(folderDialog.parent, name, folderDialog.paneIndex).then(() => setFolderDialog(null)).catch(error => window.alert(error.message));
      return;
    }
    if (folderDialog.mode === 'rename') {
      saveNav(navItems.map(item => item.type === 'folder' && item.id === folderDialog.folderId ? { ...item, name } : item));
    } else if (folderDialog.mode === 'rename-tab') {
      setTabNames(current => ({ ...current, [folderDialog.tabId]: name }));
    } else if (folderDialog.mode === 'rename-ai-chat') {
      setAiTabs(current => current.map(item => item.id === folderDialog.chatId ? { ...item, name, customName: true } : item));
    } else if (folderDialog.mode === 'rename-mail-account') {
      setMailAccountNames(current => ({ ...current, [folderDialog.accountId]: name }));
    } else if (folderDialog.mode === 'create-tab') {
      const next = removeTab(navItems, folderDialog.tabId);
      next.push({ type: 'folder', id: `folder-${Date.now()}`, name, open: true, children: [folderDialog.tabId] });
      saveNav(next);
    } else {
      saveNav([...navItems, { type: 'folder', id: `folder-${Date.now()}`, name, open: true, children: [] }]);
    }
    setFolderDialog(null);
  }
  function handleTabContext(action, target) {
    setTabContext(null);
    if (action === 'rename') {
      if (target.type === 'tab') setFolderDialog({ mode: 'rename-tab', tabId: target.id, name: tabName(target.id) });
      else if (target.type === 'ai-chat') setFolderDialog({ mode: 'rename-ai-chat', chatId: target.id, name: aiTabs.find(item => item.id === target.id)?.name || '' });
      else if (target.type === 'mail-account') {
        const account = EMAILS.find(item => item.id === target.id);
        if (account) setFolderDialog({ mode: 'rename-mail-account', accountId: target.id, name: mailAccountName(account) });
      } else if (target.type === 'folder') setFolderDialog({ mode: 'rename', name: target.name, folderId: target.id });
      return;
    }
    if (target.type === 'folder') {
      if (action === 'delete') {
        const next = [];
        navItems.forEach(item => item.type === 'folder' && item.id === target.id ? item.children.forEach(id => next.push({ type: 'tab', id })) : next.push(item));
        saveNav(next);
      } else if (action === 'toggle') saveNav(navItems.map(item => item.type === 'folder' && item.id === target.id ? { ...item, open: !item.open } : item));
      return;
    }
    if (action === 'create' && target.type === 'tab') createFolderFromTab(target.id);
    else if (action === 'ungroup') { const next = removeTab(navItems, target.id); next.push({ type: 'tab', id: target.id }); saveNav(next); }
    else if (action.startsWith('move:')) {
      const folderId = action.slice(5); let next = removeTab(navItems, target.id);
      const group = next.find(item => item.type === 'folder' && item.id === folderId);
      if (group) { group.children.push(target.id); group.open = true; saveNav(next); }
    }
  }
  function headerPopupHeight() {
    const chrome = document.querySelector('.chrome');
    const overlay = document.querySelector('.overlay-bar, .global-layout-bar');
    const caption = document.querySelector('.remote-label, .mosaic-label, .messaging-mosaic-label');
    return (chrome?.getBoundingClientRect().height || 0) +
      (overlay?.getBoundingClientRect().height || 0) +
      (caption?.getBoundingClientRect().height || 0) || 130;
  }
  function openTabContext(event, target) {
    event.preventDefault();
    const chromeHeight = headerPopupHeight();
    const canManageTab = target.type === 'tab';
    const isInFolder = canManageTab && navItems.some(item => item.type === 'folder' && item.children.includes(target.id));
    const rows = target.type === 'folder' ? 2 : canManageTab
      ? 2 + navItems.filter(item => item.type === 'folder').length + Number(isInFolder)
      : 1;
    const maxHeight = Math.max(40, chromeHeight - 8);
    const estimatedHeight = Math.min(maxHeight, rows * 36 + 12);
    setTabContext({
      x: Math.max(4, Math.min(event.clientX, window.innerWidth - 294)),
      y: Math.max(4, Math.min(event.clientY, chromeHeight - estimatedHeight - 4)),
      maxHeight,
      target
    });
  }
  function focusMailAccount(accountId) {
    setSelectedMailIds([accountId]);
    setTab('gmail'); setViewError(null); setLayoutKey(n => n + 1);
  }
  function toggleMailAccount(accountId) {
    setSelectedMailIds(current => current.includes(accountId)
      ? (current.length > 1 ? current.filter(id => id !== accountId) : current)
      : EMAILS.map(account => account.id).filter(id => current.includes(id) || id === accountId));
    setTab('gmail'); setViewError(null); setLayoutKey(n => n + 1);
  }
  function selectTab(id) {
    rememberProviderViews();
    if (isAiProvider(id)) {
      const saved = providerViewMemory.current[id];
      const chats = aiTabs.filter(item => item.service === id);
      const remembered = chats.filter(item => Array.isArray(saved) && saved.includes(item.id));
      const targets = remembered.length ? remembered : [chats.find(item => item.id === activeAiTabId) || chats[0]].filter(Boolean);
      // A provider name restores only that provider's last visible chats.
      // Subtab names still focus one chat; checkboxes compose mixed splits.
      if (targets.length) commitWorkspacePanels(targets.map(item => ({section:'ai',sub:item.id})));
    } else setGlobalPanels([{ section: id }]);
    setTab(id); setViewError(null); setLayoutKey(n => n + 1);
    if (id === 'microinfluencers') setTimeout(() => window.workhub?.reloadView('microinfluencers'), 120);
  }
  function applyMicroUrl() {
    const candidate = microUrlDraft.trim();
    if (candidate) {
      try {
        const parsed = new URL(candidate);
        if (!(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) throw new Error();
      } catch { window.alert('Pegá un enlace válido que empiece con https://. Para una prueba local, se admite http://localhost.'); return; }
    }
    setMicroUrl(candidate);
    setLayoutKey(value => value + 1);
    if (candidate === microUrl) {
      const index = globalPanels.findIndex(panel => panel.section === 'microinfluencers');
      const viewId = 'microinfluencers';
      setTimeout(() => window.workhub?.reloadView(viewId), 160);
    }
  }
  function workspacePanelTitle(panel) {
    return panel.section === 'ai' ? (aiTabs.find(chat => chat.id === panel.sub)?.name || 'Chat IA') : panel.section === 'documents' ? `${tabName('documents')} · ${(panel.slot ?? 0)+1}` : tabName(panel.section);
  }
  function currentWorkspacePanels() {
    if (globalPanels.length) return globalPanels;
    if (isAiProvider(tab)) return (selectedAiTabs.length ? selectedAiTabs : [providerActiveAiTab]).map(chat => ({section:'ai',sub:chat.id}));
    return [{section:tab,...(tab === 'documents' ? {slot:0} : {})}];
  }
  function rememberProviderViews() {
    const groups = {};
    for (const panel of currentWorkspacePanels()) {
      const chat = panel.section === 'ai' && aiTabs.find(item => item.id === panel.sub);
      if (chat) (groups[chat.service] ||= []).push(chat.id);
    }
    // Hidden providers retain their own selection, even when visiting Docs.
    Object.assign(providerViewMemory.current, groups);
    localStorage.setItem('workhub-ai-provider-views', JSON.stringify(providerViewMemory.current));
  }
  useEffect(() => { rememberProviderViews(); }, [globalPanels, selectedAiTabs, tab, aiTabs]);
  function commitWorkspacePanels(panels, preferred = null, documentSeed = null) {
    const next = normalizeWorkspacePanels(panels,navItems,aiTabs);
    if (!next.length) return;
    const before = currentWorkspacePanels();
    const singleDocument = before.length === 1 && before[0].section === 'documents' && next.length > 1 ? before[0] : null;
    if (singleDocument || documentSeed) setSplitDocs(current => current.map((doc,index) => {
      if (documentSeed && index === documentSeed.slot) return {...doc,...documentSeed.data};
      if (singleDocument && index === (singleDocument.slot ?? 0)) return {...doc,folder,stack:folderStack,entries,filter,selectedPaths,selectionAnchor};
      return doc;
    }));
    if (next.length === 1 && next[0].section === 'documents' && before.length > 1) {
      const doc = splitDocs[next[0].slot ?? 0];
      if (doc) {setFolder(doc.folder || folder);setFolderStack(doc.stack || []);setEntries(doc.entries || []);setFilter(doc.filter || '');setSelectedPaths(doc.selectedPaths || []);setSelectionAnchor(doc.selectionAnchor || '');}
    }
    setGlobalPanels(next);
    setVisibleAiTabIds(next.filter(panel => panel.section === 'ai').map(panel => panel.sub));
    const focus = preferred && next.some(panel => workspacePanelKey(panel) === workspacePanelKey(preferred)) ? preferred : next.at(-1);
    if (focus.section === 'ai') {
      setActiveAiTabId(focus.sub);
      setTab(aiTabs.find(chat => chat.id === focus.sub)?.service || 'gpt-personal');
    } else setTab(focus.section);
    setViewError(null); setLayoutKey(n => n+1);
  }
  function requestWorkspacePanel(target, documentSeed = null) {
    const result = planWorkspacePanelSelection(currentWorkspacePanels(),target,null,aiTabs);
    if (result.needsReplacement) { setPanelReplacement({target,documentSeed}); return; }
    commitWorkspacePanels(result.panels,target,documentSeed);
  }
  function confirmPanelReplacement(replaceKey) {
    if (!panelReplacement) return;
    const {target,documentSeed} = panelReplacement;
    const result = planWorkspacePanelSelection(currentWorkspacePanels(),target,replaceKey,aiTabs);
    setPanelReplacement(null);
    commitWorkspacePanels(result.panels,target,documentSeed);
  }
  function toggleGlobalPanel(section, sub = null) {
    const used = new Set(globalPanels.filter(panel => panel.section === 'documents').map(panel => panel.slot));
    const existing = globalPanels.find(panel => panel.section === section);
    const target = existing || {section,...(section === 'ai' ? {sub:sub || activeAiTab.id} : {}),...(section === 'documents' ? {slot:[0,1,2,3].find(slot => !used.has(slot)) ?? 0} : {})};
    requestWorkspacePanel(target);
  }
  function toggleNavPanel(section) {
    if (isAiProvider(section)) {
      const target = aiTabs.find(item => item.service === section && item.id === activeAiTabId) || aiTabs.find(item => item.service === section);
      if (target) toggleAiChatVisible(target.id);
      return;
    }
    if (section !== 'ai') { toggleGlobalPanel(section); return; }
    const currentAi = globalPanels.filter(panel => panel.section === 'ai');
    if (currentAi.length) {
      const remaining = globalPanels.filter(panel => panel.section !== 'ai');
      setGlobalPanels(remaining);
      setVisibleAiTabIds([activeAiTab.id]);
      const last = remaining.at(-1); setTab(last?.section === 'ai' ? (aiTabs.find(item => item.id === last.sub)?.service || 'gpt-personal') : (last?.section || 'gpt-personal'));
    } else { toggleGlobalPanel('ai', activeAiTab.id); setVisibleAiTabIds([activeAiTab.id]); }
    setViewError(null); setLayoutKey(n => n + 1);
  }
  function addDocumentsPanel() {
    const panels = currentWorkspacePanels();
    const existing = panels.find(panel => panel.section === 'documents');
    const used = new Set(panels.filter(panel => panel.section === 'documents').map(panel => panel.slot ?? 0));
    const slot = [0,1,2,3].find(value => !used.has(value));
    if (slot == null) return;
    const source = existing && panels.length > 1 ? splitDocs[existing.slot ?? 0] : {folder:folder || currentFolder,stack:folderStack};
    const documentSeed = {slot,data:{folder:source?.folder || currentFolder,stack:[...(source?.stack || [])],entries:[],filter:'',selectedPaths:[],selectionAnchor:''}};
    requestWorkspacePanel({section:'documents',slot},documentSeed);
  }
  function closeDocumentsPanel(slot) {
    const remaining = globalPanels.filter((panel, index) => !(panel.section === 'documents' && (Number.isInteger(panel.slot) ? panel.slot : index) === slot));
    if (!remaining.length) return;
    if (remaining.length === 1 && remaining[0].section === 'documents') {
      const remainingSlot = Number.isInteger(remaining[0].slot) ? remaining[0].slot : globalPanels.findIndex(panel => panel.section === 'documents');
      const doc = splitDocs[remainingSlot];
      if (doc) {
        setFolder(doc.folder || folder);
        setFolderStack(doc.stack || []);
        setEntries(doc.entries || []);
        setFilter(doc.filter || '');
        setSelectedPaths(doc.selectedPaths || []);
        setSelectionAnchor(doc.selectionAnchor || '');
        if (doc.folder || folder) localStorage.setItem('workhub-folder', doc.folder || folder);
      }
      setGlobalPanels([{ section: 'documents' }]);
      setTab('documents');
    } else {
      setGlobalPanels(remaining);
      if (tab === 'documents' && !remaining.some(panel => panel.section === 'documents')) {
        const last = remaining.at(-1);
        setTab(last.section === 'ai' ? aiTabs.find(chat => chat.id === last.sub)?.service || 'gpt-personal' : last.section);
      }
    }
    setViewError(null); setLayoutKey(n => n + 1);
  }
  function focusAiChat(id) {
    const item = aiTabs.find(chat => chat.id === id);
    setActiveAiTabId(id);
    setVisibleAiTabIds([id]);
    setAiDialogError('');
    setGlobalPanels([{ section: 'ai', sub: id }]);
    setTab(item?.service || 'gpt-personal');
    setViewError(null);
  }
  function focusMessageApp(id) {
    setActiveMessageId(id);
    setVisibleMessageIds([id]);
    setGlobalPanels([{ section: 'messaging' }]);
    setTab('messaging');
    setViewError(null);
    setLayoutKey(n => n + 1);
  }
  function toggleMessageVisible(id) {
    const selected = visibleMessageIds;
    let next = selected;
    if (selected.includes(id)) {
      if (selected.length > 1) next = selected.filter(item => item !== id);
    } else if (selected.length < 3) next = [...selected, id];
    setVisibleMessageIds(next);
    setActiveMessageId(selected.includes(id) ? (next.includes(activeMessageId) ? activeMessageId : next[0]) : id);
    setGlobalPanels([{ section: 'messaging' }]);
    setTab('messaging');
    setViewError(null);
    setLayoutKey(n => n + 1);
  }
  function toggleAiChatVisible(id) {
    requestWorkspacePanel({section:'ai',sub:id});
  }
  function openAiChatDialog() {
    const app = AI_APPS.find(item => item.id === tab) || AI_APPS[0];
    setAiDialogError('');
    setAiChatDialog({ service: app.id, name: `${app.short} ${aiTabs.filter(item => item.service === app.id).length + 1}`, url: '' });
  }
  function createAiChat(event) {
    event?.preventDefault();
    if (!aiChatDialog) return;
    const app = AI_APPS.find(item => item.id === aiChatDialog.service) || AI_APPS[0];
    if (aiTabs.filter(item => item.service === app.id).length >= 8) { setAiDialogError('Esta IA ya tiene ocho subpestañas abiertas. Cerrá una para agregar otra.'); return; }
    const inputUrl = aiChatDialog.url.trim();
    const url = inputUrl || (app.id === 'ia-nico' ? 'https://portal-colegas.vercel.app/login' : app.id === 'gemini-personal' ? 'https://gemini.google.com/app?hl=es-419' : 'https://chatgpt.com/');
    try {
      const parsed = new URL(url);
      const allowedHost = app.id === 'ia-nico' ? parsed.hostname === 'portal-colegas.vercel.app' : app.id === 'gemini-personal' ? parsed.hostname === 'gemini.google.com' : parsed.hostname === 'chatgpt.com';
      if (parsed.protocol !== 'https:' || !allowedHost) throw new Error();
    } catch { setAiDialogError(app.id === 'ia-nico' ? 'Usá un enlace HTTPS de portal-colegas.vercel.app.' : app.id === 'gemini-personal' ? 'Usá un enlace HTTPS de gemini.google.com.' : 'Usá un enlace HTTPS de chatgpt.com.'); return; }
    const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const name = aiChatDialog.name.trim() || `${app.short} ${aiTabs.filter(item => item.service === app.id).length + 1}`;
    const item = { id, service: app.id, name, url, customName: true };
    setAiTabs(current => [...current, item]);
    setAiChatDialog(null);
    focusAiChat(id);
    setTab(app.id);
  }
  function renameAiChat(item) {
    const name = window.prompt('Nombre de esta subpestaña', item.name);
    if (name?.trim()) setAiTabs(current => current.map(candidate => candidate.id === item.id ? { ...candidate, name: name.trim(), customName: true } : candidate));
  }
  function reorderAiChatTabs(sourceId, targetId, insertAfter) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setAiTabs(current => {
      const sourceIndex = current.findIndex(item => item.id === sourceId);
      const targetIndex = current.findIndex(item => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      if (current[sourceIndex].service !== current[targetIndex].service) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(sourceIndex, 1);
      let destination = reordered.findIndex(item => item.id === targetId);
      if (destination < 0) return current;
      if (insertAfter) destination++;
      reordered.splice(destination, 0, moved);
      return reordered;
    });
  }
  function closeAiChat(item) {
    const providerTabs = aiTabs.filter(candidate => candidate.service === item.service);
    if (providerTabs.length === 1) {
      const replacement = { ...(DEFAULT_AI_WORKSPACE.find(candidate => candidate.service === item.service) || DEFAULT_AI_WORKSPACE[0]), id: `chat-${Date.now()}-${item.service}` };
      window.workhub?.closeAiView(aiViewId(item));
      setActiveAiTabId(replacement.id); setVisibleAiTabIds([replacement.id]);
      setAiTabs(current => [...current.filter(candidate => candidate.id !== item.id), replacement]);
      setGlobalPanels(current => current.map(pane => pane.section === 'ai' && pane.sub === item.id ? { ...pane, sub: replacement.id } : pane));
      return;
    }
    const next = aiTabs.filter(candidate => candidate.id !== item.id);
    const fallback = next.find(candidate => candidate.service === item.service) || next[0];
    window.workhub?.closeAiView(aiViewId(item));
    setAiTabs(next);
    setActiveAiTabId(current => current === item.id ? fallback.id : current);
    setVisibleAiTabIds(current => {
      const remaining = current.filter(id => id !== item.id && next.some(candidate => candidate.id === id));
      return remaining;
    });
    setGlobalPanels(current => current.map(pane => pane.section === 'ai' && pane.sub === item.id ? { ...pane, sub: fallback.id } : pane));
  }
  async function reloadPanel(viewId, login = false) {
    setViewError(null);
    const result = await window.workhub?.reloadView(viewId, login);
    if (result && !result.ok) window.alert('No se pudo cargar el panel: ' + result.error);
  }
  function refreshVisible() {
    setViewError(null);
    (mixedGlobalPanels ? globalViewIds.filter(Boolean) : viewIds).forEach(id => reloadPanel(id));
    setLayoutKey(n => n + 1);
  }
  function formatSize(size) {
    if (size == null) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size/1024).toFixed(0)} KB`;
    return `${(size/1024/1024).toFixed(1)} MB`;
  }
  function iconFor(item) {
    if (item.directory) return Folder;
    const ext = item.name.split('.').pop().toLowerCase();
    if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return Image;
    if (['doc','docx','txt','pdf','md'].includes(ext)) return FileText;
    if (['xls','xlsx','csv'].includes(ext)) return Table2;
    if (['mp4','mov','mkv'].includes(ext)) return Film;
    return FileIcon;
  }
  const currentFolder = folderStack.at(-1) || folder;
  const currentTab = TABS.find(t => t.id === tab);
  const CurrentIcon = currentTab?.icon || PanelsTopLeft;
  function renderDocumentsPane(paneIndex = null) {
    const doc = paneIndex === null ? null : splitDocs[paneIndex];
    const activeFolder = doc ? (doc.stack.at(-1) || doc.folder || folder) : currentFolder;
    const activeStack = doc ? doc.stack : folderStack;
    const activeEntries = doc ? doc.entries : entries;
    const activeFilter = doc ? doc.filter : filter;
    const selected = doc ? (doc.selectedPaths || []) : selectedPaths;
    const anchor = doc ? (doc.selectionAnchor || '') : selectionAnchor;
    const visibleEntries = activeEntries.filter(item => item.name.toLowerCase().includes(activeFilter.toLowerCase()));
    const setActiveStack = updater => {
      if (paneIndex === null) { setFolderStack(updater); setSelectedPaths([]); setSelectionAnchor(''); }
      else setSplitDocs(current => current.map((item, i) => i === paneIndex ? { ...item, stack: typeof updater === 'function' ? updater(item.stack) : updater, selectedPaths: [], selectionAnchor: '' } : item));
    };
    const setActiveEntries = updater => paneIndex === null ? setEntries(updater) : setSplitDocs(current => current.map((item, i) => i === paneIndex ? { ...item, entries: typeof updater === 'function' ? updater(item.entries) : updater } : item));
    const setActiveFilter = value => { paneIndex === null ? (setFilter(value), setSelectedPaths([]), setSelectionAnchor('')) : updateSplitDoc(paneIndex, { filter: value, selectedPaths: [], selectionAnchor: '' }); };
    const setSelection = (paths, nextAnchor = anchor) => paneIndex === null ? (setSelectedPaths(paths), setSelectionAnchor(nextAnchor)) : updateSplitDoc(paneIndex, { selectedPaths: paths, selectionAnchor: nextAnchor });
    const folderPicker = () => pickFolder(paneIndex);
    const refreshFolder = () => window.workhub.listFolder(activeFolder).then(setActiveEntries);
    const changeFolder = path => { setActiveStack(stack => [...stack, path]); };
    const goBack = () => setActiveStack(stack => stack.slice(0, -1));
    const goToProjects = () => {
      setActiveStack([]);
      setActiveFilter('');
      setSelection([],'');
    };
    const selectedItems = () => visibleEntries.filter(item => selected.includes(item.path));
    const displayFolder = (() => {
      if (!activeFolder.startsWith('zip://')) return activeFolder;
      const marker = activeFolder.indexOf('!/');
      if (marker < 0) return activeFolder;
      try {
        const archivePath = decodeURIComponent(activeFolder.slice(6, marker));
        const inner = activeFolder.slice(marker + 2).split('/').filter(Boolean).map(part => decodeURIComponent(part)).join('\\');
        return inner ? `${archivePath}  ›  ${inner}` : `${archivePath}  ›  (ZIP)`;
      } catch { return activeFolder; }
    })();
    const handleSelect = (event, item) => {
      const current = selected;
      if (event.shiftKey && anchor) {
        const from = visibleEntries.findIndex(entry => entry.path === anchor);
        const to = visibleEntries.findIndex(entry => entry.path === item.path);
        if (from >= 0 && to >= 0) {
          const range = visibleEntries.slice(Math.min(from, to), Math.max(from, to) + 1).map(entry => entry.path);
          setSelection(event.ctrlKey || event.metaKey ? [...new Set([...current, ...range])] : range, anchor);
        } else setSelection([item.path], item.path);
      } else if (event.ctrlKey || event.metaKey) {
        const next = current.includes(item.path) ? current.filter(value => value !== item.path) : [...current, item.path];
        setSelection(next, item.path);
      } else setSelection([item.path], item.path);
      event.currentTarget.focus();
    };
    const handleDocumentKeys = event => {
      if ((event.target instanceof HTMLInputElement) || (event.target instanceof HTMLTextAreaElement)) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault(); setFolderDialog({ mode: 'create-document', name: 'Nueva carpeta', parent: activeFolder, paneIndex });
      } else if (modifier && event.key.toLowerCase() === 'a') {
        event.preventDefault(); setSelection(visibleEntries.map(item => item.path), visibleEntries[0]?.path || '');
      } else if (modifier && ['c','x'].includes(event.key.toLowerCase())) {
        event.preventDefault(); copyDocumentSelection(selectedItems(), event.key.toLowerCase() === 'x' ? 'move' : 'copy');
      } else if (modifier && event.key.toLowerCase() === 'v') {
        event.preventDefault(); pasteDocumentItems(activeFolder);
      } else if (event.key === 'Delete') {
        event.preventDefault(); deleteDocumentSelection(selectedItems());
      } else if (event.key === 'Enter' && selected.length === 1) {
        event.preventDefault(); const item = visibleEntries.find(entry => entry.path === selected[0]);
        if (item?.directory) changeFolder(item.path); else if (item) window.workhub.openFile(item.path);
      }
    };
    const onDropOver = event => {
      const types = [...(event.dataTransfer?.types || [])];
      if (event.dataTransfer?.files?.length || types.includes('Files') || types.includes('application/x-workhub-files')) {
        event.preventDefault();
        if (event.ctrlKey) event.dataTransfer.dropEffect = 'copy';
        else if (event.shiftKey) event.dataTransfer.dropEffect = 'move';
        else {
          const internal = types.includes('application/x-workhub-files');
          const drive = value => String(value || '').match(/^[a-z]:/i)?.[0]?.toLowerCase() || String(value || '').match(/^\\\\[^\\]+\\[^\\]+/)?.[0]?.toLowerCase() || '';
          const sourcePath = event.dataTransfer.files[0] ? window.workhub.getPathForFile(event.dataTransfer.files[0]) : '';
          const sameDrive = internal || (drive(sourcePath) && drive(sourcePath) === drive(activeFolder));
          event.dataTransfer.dropEffect = sameDrive ? 'move' : 'copy';
        }
      }
    };
    const rowDragStart = (event, item) => {
      const items = selected.includes(item.path) ? selectedItems() : [item];
      if (!selected.includes(item.path)) setSelection([item.path], item.path);
      const hasAiDropTarget = globalPanels.some(panel => panel.section === 'ai');
      if (hasAiDropTarget) {
        const unsupported = items.some(entry => entry.directory || entry.path.startsWith('zip://'));
        if (unsupported) {
          event.preventDefault();
          setDocumentStatus('Para adjuntar, elegí archivos normales; primero extraé el contenido de un ZIP.');
          return;
        }
        try {
          const result = window.workhub.beginAttachmentDrag(items.map(({ path }) => path));
          if (!result?.token) throw new Error(result?.error || 'No se pudo preparar el arrastre.');
          event.dataTransfer.setData('application/x-workhub-attachment', result.token);
          event.dataTransfer.setData('text/plain', `workhub-attachment:${result.token}`);
          // Preserve transfers between Documents panes when an AI is also visible.
          event.dataTransfer.setData('application/x-workhub-files', `workhub-files:${JSON.stringify(items.map(({ path, directory }) => ({ path, directory: Boolean(directory) })))}`);
          event.dataTransfer.effectAllowed = 'copyMove';
          setDocumentStatus('Soltá el archivo sobre el chat para adjuntarlo.');
        } catch (error) {
          event.preventDefault();
          setDocumentStatus(error.message || 'No se pudo preparar el arrastre.');
        }
        return;
      }
      const payload = JSON.stringify(items.map(({ path, directory }) => ({ path, directory: Boolean(directory) })));
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('application/x-workhub-files', `workhub-files:${payload}`);
      event.dataTransfer.setData('text/plain', `workhub-files:${payload}`);
    };
    const showDocumentMenu = (event, item = null) => {
      event.preventDefault(); event.stopPropagation();
      const items = item ? (selected.includes(item.path) ? selectedItems() : [item]) : selectedItems();
      if (item && !selected.includes(item.path)) setSelection([item.path], item.path);
      setDocumentMenu({ x: Math.min(event.clientX, window.innerWidth - 230), y: Math.min(event.clientY, window.innerHeight - 245), items, folder: activeFolder, paneIndex });
    };
    return <div className="documents-page" tabIndex={0} onKeyDownCapture={handleDocumentKeys} onMouseDown={event => { if (!event.target.closest('input,button,[role="button"]')) event.currentTarget.focus({ preventScroll: true }); }} onContextMenu={showDocumentMenu}>
      <aside className="file-sidebar"><div className="side-overline">ESPACIO DE TRABAJO</div><button className={`side-selected ${activeStack.length ? '' : 'at-root'}`} aria-current={activeStack.length ? undefined : 'page'} title="Volver a la carpeta principal de proyectos" onClick={goToProjects}><FolderOpen size={17}/> Proyectos</button><div className="side-note"><HardDrive size={16}/><span>Acceso a una carpeta local de este equipo</span></div><div className="side-security"><ShieldCheck size={16}/><span>Los archivos se abren desde su ubicación original. No se copian a la app.</span></div></aside>
      <section className="file-content" onDragOver={onDropOver} onDrop={event=>dropDocumentFiles(event,activeFolder)}>
        <div className="file-heading"><div><div className="breadcrumb">MI ESPACIO <span>/</span> DOCUMENTOS{isUpdatePath(activeFolder) && <><span>/</span> ACTUALIZACION</>}</div><h1>{isUpdatePath(activeFolder) ? 'Actualizaciones de Workhub' : 'Carpeta de proyectos'}</h1><p>{isUpdatePath(activeFolder) ? 'Soltá aquí el ZIP del parche o guardalo en esta carpeta. Después elegí Aplicar y reiniciar.' : 'Explorá, seleccioná y organizá tus archivos.'}</p></div><button className="primary-button" onClick={folderPicker}><FolderOpen size={16}/>{(doc?.folder || folder) ? 'Cambiar carpeta' : 'Elegir carpeta'}</button></div>
        {!(doc?.folder || folder) ? <div className="empty-folder"><div className="empty-icon"><FolderOpen size={28}/></div><h2>Elegí tu carpeta de proyectos</h2><p>Cuando la crees, seleccionála acá. Workhub recordará esta ubicación para la próxima vez.</p><button className="primary-button" onClick={folderPicker}>Seleccionar carpeta</button></div> : <>
          <div className="path-row"><button className="back-button" onClick={goBack} disabled={!activeStack.length}><ArrowLeft size={16}/></button><div className="path-text"><FolderOpen size={15}/><span title={displayFolder}>{displayFolder}</span></div><div className="searchbox"><Search size={15}/><input placeholder="Buscar en esta carpeta" value={activeFilter} onChange={e=>setActiveFilter(e.target.value)}/></div><span className="file-selection-count">{selected.length ? `${selected.length} seleccionados` : ''}</span><button className="icon-button" disabled={!selected.length} onClick={()=>copyDocumentSelection(selectedItems(),'copy')} title="Copiar (Ctrl+C)"><Copy size={15}/></button><button className="icon-button" disabled={!selected.length} onClick={()=>copyDocumentSelection(selectedItems(),'move')} title="Cortar (Ctrl+X)"><Scissors size={15}/></button><button className="icon-button" onClick={()=>pasteDocumentItems(activeFolder)} title="Pegar (Ctrl+V)"><ClipboardPaste size={15}/></button><button className="icon-button" onClick={refreshFolder} title="Actualizar"><RefreshCw size={15}/></button></div>
          {patchError && <div className="patch-error" role="alert">{patchError}</div>}
          <div className={`file-table ${isUpdatePath(activeFolder) ? 'is-update-folder' : ''}`} tabIndex={0} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.focus();}}>
            <div className="file-table-head"><span>Nombre</span><span>Tipo</span><span>{isUpdatePath(activeFolder)?'Acción':'Tamaño'}</span></div>
            {visibleEntries.map(item=>{const Icon=iconFor(item);const patchFile=isUpdatePath(activeFolder)&&!item.directory&&item.name.toLowerCase().endsWith('.zip');return <div className={`file-row ${selected.includes(item.path)?'selected':''}`} role="button" aria-selected={selected.includes(item.path)} tabIndex={0} draggable onDragStart={event=>rowDragStart(event,item)} onContextMenu={event=>showDocumentMenu(event,item)} onDragOver={onDropOver} onDrop={event=>{event.stopPropagation();dropDocumentFiles(event,item.directory && !item.archive ? item.path : activeFolder);}} key={item.path} onDoubleClick={()=>item.directory?changeFolder(item.path):window.workhub.openFile(item.path)} onClick={event=>handleSelect(event,item)} onKeyDown={event=>{if(event.key===' '){event.preventDefault();handleSelect({...event,ctrlKey:true,currentTarget:event.currentTarget},item);}}}><span className="file-name"><Icon size={18} className={item.directory?'folder-color':''}/>{item.name}</span><span>{item.directory?'Carpeta':item.name.split('.').pop().toUpperCase()}</span><span>{patchFile?<button className="patch-apply-button" disabled={patchBusy} onClick={event=>{event.stopPropagation();applyPatch(item.path);}}>Aplicar y reiniciar</button>:item.directory?'—':formatSize(item.size)}</span></div>;})}
            {visibleEntries.length===0&&<div className="no-files">{isUpdatePath(activeFolder)?'Soltá aquí el ZIP de actualización.':'Esta carpeta está vacía.'}</div>}
          </div>
          <div className="document-status" role="status">{documentStatus}</div><div className="file-footnote">Seleccioná varios elementos con Ctrl o Shift. Ctrl+C copia, Ctrl+X corta y Ctrl+V pega. Arrastrá para mover según las reglas de Windows; los archivos dentro de un ZIP se extraen al soltarlos en otra carpeta.</div>
        </>}
      </section>
    </div>;
  }

  return <div className="app-shell" data-theme={theme}>
    <header className="chrome">
      <div className="titlebar">
        <div className="brand"><img className="brand-mark workhub-brand-icon" src="/workhub.png" alt=""/><span>work<span className="brand-light">hub</span></span><span className="private-chip"><ShieldCheck size={12}/> PRIVADO</span></div>
        <div className="titlebar-actions">
          <button className="theme-toggle" onClick={() => window.workhub?.updateDesktop?.()} title="Seleccionar un parche ZIP de Workhub"><RefreshCw size={13}/><span>Actualizar</span></button>
          <button className="theme-toggle" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`} title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}>{theme === 'dark' ? <Moon size={13}/> : <Sun size={13}/>}<span>{theme === 'dark' ? 'Dark' : 'Light'}</span></button>
          <div className="window-controls"><button aria-label="Minimizar" onClick={() => window.workhub?.windowControl('minimize')}>−</button><button aria-label="Maximizar" onClick={() => window.workhub?.windowControl('maximize')}>□</button><button className="close-window" aria-label="Cerrar" onClick={() => window.workhub?.windowControl('close')}>×</button></div>
        </div>
      </div>
      <nav className="tabs" aria-label="Secciones" onDragOver={event => event.preventDefault()} onDrop={event => handleNavDrop('end', '', event)} onContextMenu={event => { if (event.target === event.currentTarget) { event.preventDefault(); createEmptyFolder(); } }}>
        {navItems.flatMap(item => item.type === 'tab' ? [{ type: 'tab', id: item.id }] : [{ type: 'folder', id: item.id, name: item.name, open: item.open, children: item.children }, ...(item.open ? item.children.map(id => ({ type: 'tab', id, parent: item.id })) : [])]).map(node => {
          if (node.type === 'folder') return <button key={node.id} type="button" draggable className={`tab folder-tab ${node.open ? 'folder-open' : ''} ${node.children?.some(id => id === tab) ? 'contains-active' : ''}`} onClick={() => handleTabContext('toggle', navItems.find(item => item.type === 'folder' && item.id === node.id))} onContextMenu={event => openTabContext(event, { type: 'folder', ...node })} onDragStart={event => startNavDrag('folder', node.id, event)} onDragOver={event => event.preventDefault()} onDrop={event => handleNavDrop('folder', node.id, event)} onDragEnd={() => setDraggedItem(null)} title={`${node.name} · clic para abrir/cerrar · clic derecho para opciones`}><Folder size={16}/><span>{node.name}</span><ChevronDown size={12} className="folder-chevron"/></button>;
          const item = TABS.find(entry => entry.id === node.id); if (!item) return null; const Icon = item.icon; const shownName = tabName(item.id);
          const checked = isAiProvider(item.id)
            ? (globalPanels.some(panel => panel.section !== 'ai')
              ? globalPanels.some(panel => panel.section === 'ai' && aiTabs.find(chat => chat.id === panel.sub)?.service === item.id)
              : selectedAiTabs.some(chat => chat.service === item.id))
            : globalPanels.some(panel => panel.section === item.id);
          return <div key={item.id} className={`tab-entry ${node.parent ? 'nested-entry' : ''}`}>
            <button type="button" draggable className={`tab ${tab === item.id ? 'active' : ''} ${node.parent ? 'nested-tab' : ''}`} onClick={() => selectTab(item.id)} onContextMenu={event => openTabContext(event, { type: 'tab', id: item.id })} onDragStart={event => startNavDrag('tab', item.id, event)} onDragOver={event => event.preventDefault()} onDrop={event => handleNavDrop('tab', item.id, event)} onDragEnd={() => setDraggedItem(null)} title={`${shownName}${node.parent ? ' · en carpeta' : ''} · clic para abrir · clic derecho para cambiar el nombre`}><Icon size={16} strokeWidth={2}/><span>{shownName}</span>{tab === item.id && <i/>}</button>
            <button type="button" className={`tab-check ${checked ? 'checked' : ''}`} aria-label={`${checked ? 'Quitar' : 'Agregar'} ${shownName} ${checked ? 'de' : 'a'} la vista`} aria-pressed={checked} title={`${checked ? 'Quitar' : 'Agregar'} ${shownName} ${checked ? 'de' : 'a'} la vista dividida`} onClick={() => toggleNavPanel(item.id)}>{checked ? '✓' : ''}</button>
            {item.id === 'documents' && checked && <button type="button" className="tab-check tab-add-view" aria-label="Agregar otra vista de Documentos" title="Agregar otra vista de Documentos" onClick={addDocumentsPanel}><Plus size={11}/></button>}
          </div>;
        })}
        <button className="add-tab" title="Crear carpeta" onClick={createEmptyFolder}><FolderPlus size={16}/></button>
        <div className="tabbar-utilities">
          {inDesktop && <span className="session-status"><span/> Sesiones guardadas en este equipo</span>}
          <button className="icon-button" title="Recargar páginas visibles" onClick={refreshVisible}><RefreshCw size={15}/></button>
        </div>
      </nav>
      {tabContext && <div className="tab-context-backdrop" onClick={() => setTabContext(null)} onContextMenu={event => { event.preventDefault(); setTabContext(null); }}><div className="tab-context-menu" style={{ left: tabContext.x, top: tabContext.y, maxHeight: tabContext.maxHeight }} onClick={event => event.stopPropagation()}>
        <button onClick={() => handleTabContext('rename', tabContext.target)}><Pencil size={14}/>Cambiar nombre</button>
        {tabContext.target.type === 'folder' ? <button onClick={() => handleTabContext('delete', tabContext.target)}><Trash2 size={14}/>Eliminar carpeta y dejar pestañas afuera</button> : tabContext.target.type === 'tab' ? <><button onClick={() => handleTabContext('create', tabContext.target)}><FolderPlus size={14}/>Crear carpeta con esta pestaña</button>{navItems.filter(item => item.type === 'folder').map(group => <button key={group.id} onClick={() => handleTabContext(`move:${group.id}`, tabContext.target)}><Folder size={14}/>Mover a {group.name}</button>)}{navItems.some(item => item.type === 'folder' && item.children.includes(tabContext.target.id)) && <button onClick={() => handleTabContext('ungroup', tabContext.target)}><ExternalLink size={14}/>Sacar de la carpeta</button>}</> : null}
      </div></div>}
      {viewError && <div className="error-banner" role="alert"><span>No se pudo cargar {aiTabs.find(item => aiViewId(item) === viewError.viewId)?.name || viewError.id || 'la página'} ({viewError.code}). {viewError.desc || ''}</span>{viewError.viewId && <button onClick={() => window.workhub.reloadView(viewError.viewId)}>Reintentar</button>}<button aria-label="Cerrar aviso de error" onClick={() => setViewError(null)}>×</button></div>}
    </header>

    {folderDialog && createPortal(<div className="folder-dialog-backdrop header-dialog-backdrop" style={{height:headerPopupHeight()}} onMouseDown={event => { if (event.target === event.currentTarget) setFolderDialog(null); }}><form className="folder-dialog header-folder-dialog" onSubmit={event => { event.preventDefault(); submitFolderDialog(); }}><label htmlFor="folder-name">{folderDialog.mode.startsWith('rename') ? 'Cambiar nombre' : 'Crear carpeta'}</label><input id="folder-name" autoFocus maxLength={40} value={folderDialog.name} onChange={event => setFolderDialog({ ...folderDialog, name: event.target.value })} onKeyDown={event => event.stopPropagation()} /><div><button type="button" onClick={() => setFolderDialog(null)}>Cancelar</button><button type="submit" disabled={!folderDialog.name.trim()}>{folderDialog.mode.startsWith('rename') ? 'Guardar' : 'Crear'}</button></div></form></div>, document.body)}

    {panelReplacement && createPortal(<div className="folder-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPanelReplacement(null); }}>
      <section className="folder-dialog panel-replacement-dialog" role="dialog" aria-modal="true" aria-labelledby="replace-panel-title" aria-describedby="replace-panel-description" onKeyDown={event => {
        if (event.key === 'Escape') {event.preventDefault();setPanelReplacement(null);}
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          const first = buttons[0], last = buttons.at(-1);
          if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus();}
          else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus();}
        }
        event.stopPropagation();
      }}>
        <h2 id="replace-panel-title">¿Qué vista querés reemplazar?</h2>
        <p id="replace-panel-description">Para abrir <strong>{workspacePanelTitle(panelReplacement.target)}</strong>, elegí qué vista reemplazar. Su pestaña quedará guardada.</p>
        <div className="panel-replacement-options">{workspaceReplacementOptions(currentWorkspacePanels(),panelReplacement.target,aiTabs).map((panel,index) => <button type="button" autoFocus={index === 0} key={workspacePanelKey(panel)} onClick={() => confirmPanelReplacement(workspacePanelKey(panel))}><span>{index+1}</span>{workspacePanelTitle(panel)}</button>)}</div>
        <div><button type="button" onClick={() => setPanelReplacement(null)}>Cancelar</button></div>
      </section>
    </div>,document.body)}

    {aiChatDialog && createPortal(<div className="folder-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setAiChatDialog(null); }}><form className="folder-dialog ai-chat-dialog" onSubmit={createAiChat}>
      <label>Agregar subpestaña de IA</label>
      <span className="ai-dialog-caption">Se agregará dentro de {AI_APPS.find(app => app.id === aiChatDialog.service)?.short}. Cada subpestaña conserva su propio chat y navegación. Máximo ocho por IA.</span>
      <input autoFocus maxLength={50} value={aiChatDialog.name} onChange={event => setAiChatDialog(current => ({ ...current, name: event.target.value }))} placeholder="Nombre, por ejemplo: Microinfluencers" aria-label="Nombre de la subpestaña" />
      <input value={aiChatDialog.url} onChange={event => setAiChatDialog(current => ({ ...current, url: event.target.value }))} placeholder="Enlace de un chat/proyecto existente (opcional)" aria-label="Enlace de chat existente" />
      <span className="ai-dialog-caption">Sin enlace abre una vista nueva. Para un proyecto, podés abrirlo desde la barra lateral de la IA y Workhub conservará la última dirección usada.</span>
      {aiDialogError && <span className="ai-dialog-error" role="alert">{aiDialogError}</span>}
      <div><button type="button" onClick={() => setAiChatDialog(null)}>Cancelar</button><button type="submit">Abrir subpestaña</button></div>
    </form></div>, document.body)}

    {documentMenu && createPortal(<div className="document-menu-backdrop" onMouseDown={() => setDocumentMenu(null)} onContextMenu={event => { event.preventDefault(); setDocumentMenu(null); }}><div className="document-menu" role="menu" style={{left:documentMenu.x,top:documentMenu.y}} onMouseDown={event=>event.stopPropagation()}>
      <button role="menuitem" disabled={documentMenu.folder.startsWith('zip://')} onClick={()=>{setFolderDialog({mode:'create-document',name:'Nueva carpeta',parent:documentMenu.folder,paneIndex:documentMenu.paneIndex});setDocumentMenu(null);}}>Nueva carpeta <span>Ctrl+Mayús+N</span></button>
      <div className="document-menu-separator"/>
      <button role="menuitem" disabled={!documentMenu.items.length} onClick={()=>{copyDocumentSelection(documentMenu.items,'copy');setDocumentMenu(null);}}>Copiar <span>Ctrl+C</span></button>
      <button role="menuitem" disabled={!documentMenu.items.length} onClick={()=>{copyDocumentSelection(documentMenu.items,'move');setDocumentMenu(null);}}>Cortar <span>Ctrl+X</span></button>
      <button role="menuitem" onClick={()=>{pasteDocumentItems(documentMenu.folder);setDocumentMenu(null);}}>Pegar <span>Ctrl+V</span></button>
      <button role="menuitem" disabled={!documentMenu.items.length || documentMenu.items.some(item=>item.path.startsWith('zip://'))} onClick={()=>{deleteDocumentSelection(documentMenu.items);setDocumentMenu(null);}}>Eliminar <span>Supr · Papelera</span></button>
    </div></div>,document.body)}
    {mixedGlobalPanels ? <>
      <section className={`global-layout-bar ${showPersonalUsage ? 'global-layout-with-usage' : ''}`}><span>{globalPanels.length} paneles seleccionados</span>{globalPanels.map((panel, panelIndex) => panel.section === 'ai' && <label key={`ai-choice-${panelIndex}`}>Chat IA {globalPanels.filter(item => item.section === 'ai').length > 1 ? globalPanels.filter(item => item.section === 'ai').findIndex(item => item === panel) + 1 : ''}<select value={panel.sub || activeAiTab.id} onChange={event => { const id = event.target.value; const chat = aiTabs.find(item => item.id === id); setGlobalPanels(current => current.map((item, index) => index === panelIndex ? { ...item, sub: id } : item)); setActiveAiTabId(id); if (chat) setTab(chat.service); }} aria-label={`Chat de IA en el panel ${panelIndex + 1}`}>{aiTabs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}{globalPanels.some(panel => panel.section === 'ai') && <label className="add-ai-panel">Agregar chat IA<select value={activeAiTab.id} onChange={event => { setActiveAiTabId(event.target.value); const chat = aiTabs.find(item => item.id === event.target.value); if (chat) setTab(chat.service); }} aria-label="Elegir chat de IA para agregar">{aiTabs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button type="button" disabled={globalPanels.some(panel => panel.section === 'ai' && panel.sub === activeAiTab.id)} onClick={() => toggleAiChatVisible(activeAiTab.id)} aria-label="Agregar chat de IA seleccionado" title="Agregar este chat como otro panel"><Plus size={14}/></button></label>}{globalPanels.some(panel => panel.section === 'microinfluencers') && <div className="micro-url-controls"><input aria-label="Enlace de vista previa de Microinfluencers" value={microUrlDraft} onChange={event => setMicroUrlDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyMicroUrl(); } }} placeholder="Pegá el enlace de vista previa"/><button type="button" onClick={applyMicroUrl} title="Guardar enlace y recargar la vista"><RefreshCw size={13}/></button><small>390 × 844</small></div>}{showPersonalUsage ? <PersonalUsageStrip/> : <span>Marcá o desmarcá pestañas para cambiar la vista · arrastrá los divisores para ajustar</span>}</section>
      <main className={`split-stage split-stage-${globalPanels.length}`} style={{ gridTemplateColumns: globalPanels.length === 3 ? `minmax(0, ${aiGridRatios.x}fr) minmax(0, ${aiGridRatios.x2-aiGridRatios.x}fr) minmax(0, ${100-aiGridRatios.x2}fr)` : globalPanels.length >= 2 ? `minmax(0, ${aiGridRatios.x}fr) minmax(0, ${100-aiGridRatios.x}fr)` : 'minmax(0,1fr)', gridTemplateRows:'minmax(0,1fr)' }}>
        {globalPanels.map((pane, index) => {
          const title = pane.section === 'ai' ? (aiTabs.find(item => item.id === pane.sub)?.name || tabName('ai')) : pane.section === 'documents' ? `${tabName('documents')} · ${index + 1}` : tabName(pane.section);
          const docSlot = Number.isInteger(pane.slot) ? pane.slot : index;
          return <section className={`split-pane ${pane.section === 'documents' ? 'split-documents' : ''}`} key={`${pane.section}-${pane.sub || pane.slot || ''}-${index}`} aria-label={title}>
            <div className="global-panel-name"><span>{title}</span>{pane.section === 'documents' && globalPanels.length > 1 && <button type="button" className="global-panel-close" onClick={() => closeDocumentsPanel(docSlot)} aria-label={`Cerrar ${title}`} title={`Cerrar ${title}`}>×</button>}</div>
            {pane.section === 'documents' ? renderDocumentsPane(docSlot) : !inDesktop ? <div className="preview-notice"><div className="notice-icon"><Columns2 size={20}/></div><div><strong>Vista disponible en Workhub de escritorio</strong><p>Iniciá la app para mostrar este servicio.</p></div></div> : null}
          </section>;
        })}
      </main>
    </> : <>
    {tab === 'messaging' && <section className="overlay-bar ai-bar ai-chat-bar messaging-chat-bar">
      <div className="ai-chat-tabs" role="group" aria-label="Servicios de mensajería visibles">
        {MESSAGING_APPS.map(app => {
          const Icon = app.icon;
          const checked = visibleMessageIds.includes(app.id);
          return <div className={`ai-chat-tab ${activeMessageId === app.id ? 'active' : ''} ${checked ? 'checked' : ''}`} key={app.id}>
            <button type="button" className="ai-chat-check" aria-label={`${checked ? 'Quitar' : 'Agregar'} ${app.name} ${checked ? 'de' : 'a'} la vista`} aria-pressed={checked} title={checked ? 'Visible en la cuadrícula' : 'Marcar para mostrar en la cuadrícula'} onClick={() => toggleMessageVisible(app.id)}>{checked ? '✓' : ''}</button>
            <button type="button" className="ai-chat-open" onClick={() => focusMessageApp(app.id)} title={`Mostrar solo ${app.name}`}><Icon size={13}/><span>{app.name}</span></button>
          </div>;
        })}
      </div>
      <div className="ai-layout-tools"><span className="ai-visible-count">{visibleMessageIds.length} / 3</span></div>
    </section>}

    {tab === 'gmail' && <section className="overlay-bar mail-bar">
      <div className="mail-identities" role="group" aria-label="Cuentas de correo visibles">{EMAILS.map(account => {
        const checked = selectedMailIds.includes(account.id);
        return <div key={account.id} className={`mail-account-entry ${checked ? 'selected' : ''}`} onContextMenu={event => openTabContext(event, { type: 'mail-account', id: account.id })}>
          <button type="button" className={`mail-chip ${selectedMailIds.length === 1 && checked ? 'chosen' : ''}`} onClick={() => focusMailAccount(account.id)} title={`Mostrar solo ${account.email} · clic derecho para cambiar el nombre`}><span className="mail-avatar" style={{background:account.color}}>{mailAccountName(account).slice(0,1)}</span><span>{mailAccountName(account)}</span></button>
          <button type="button" className={`mail-account-check ${checked ? 'checked' : ''}`} aria-label={`${checked ? 'Quitar' : 'Agregar'} ${account.email} de la vista`} aria-pressed={checked} title={`${checked ? 'Quitar' : 'Agregar'} ${account.email} ${checked ? 'de' : 'a'} la vista`} onClick={() => toggleMailAccount(account.id)}>{checked ? '✓' : ''}</button>
        </div>;
      })}</div>
      <span className="bar-hint mail-hint">{selectedMailIds.length} de 6 cuentas visibles · tocá el nombre para ver solo esa cuenta</span>
      <button className="text-button" onClick={() => setSelectedMailIds(EMAILS.map(account => account.id))} disabled={selectedMailIds.length === EMAILS.length}><LayoutGrid size={15}/> Todas</button>
    </section>}

    {isAiProvider(tab) && <section className="overlay-bar ai-bar ai-chat-bar">
      <div className="ai-chat-tabs" role="group" aria-label={`Subpestañas de ${AI_APPS.find(app => app.id === tab)?.short || 'IA'}`}>
        {providerAiTabs.map(item => {
          const app = AI_APPS.find(candidate => candidate.id === item.service) || AI_APPS[0];
          const Icon = app.icon;
          const checked = selectedAiTabs.some(selected => selected.id === item.id);
          const dropBefore = aiDropTarget?.id === item.id && !aiDropTarget.after;
          const dropAfter = aiDropTarget?.id === item.id && aiDropTarget.after;
          return <div className={`ai-chat-tab ${activeAiTab.id === item.id ? 'active' : ''} ${checked ? 'checked' : ''} ${draggedAiTabId === item.id ? 'dragging' : ''} ${dropBefore ? 'drop-before' : ''} ${dropAfter ? 'drop-after' : ''}`} key={item.id} draggable onContextMenu={event => openTabContext(event, { type: 'ai-chat', id: item.id })} onDragStart={event => {
            if (event.target.closest('.ai-chat-check,.ai-chat-close')) { event.preventDefault(); return; }
            event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id);
            setDraggedAiTabId(item.id); setAiDropTarget(null);
          }} onDragOver={event => {
            if (!draggedAiTabId || draggedAiTabId === item.id) return;
            event.preventDefault(); event.dataTransfer.dropEffect = 'move';
            const bounds = event.currentTarget.getBoundingClientRect();
            const nextTarget = { id: item.id, after: event.clientX >= bounds.left + bounds.width / 2 };
            setAiDropTarget(current => current?.id === nextTarget.id && current?.after === nextTarget.after ? current : nextTarget);
          }} onDrop={event => {
            event.preventDefault();
            const sourceId = draggedAiTabId || event.dataTransfer.getData('text/plain');
            const bounds = event.currentTarget.getBoundingClientRect();
            reorderAiChatTabs(sourceId, item.id, event.clientX >= bounds.left + bounds.width / 2);
            setDraggedAiTabId(null); setAiDropTarget(null);
          }} onDragEnd={() => { setDraggedAiTabId(null); setAiDropTarget(null); }} title="Arrastrá para cambiar el orden">
            <button className="ai-chat-check" aria-label={`${checked ? 'Quitar de la vista múltiple' : 'Agregar a la vista múltiple'}: ${item.name}`} aria-pressed={checked} title={checked ? 'Visible en la cuadrícula' : 'Marcar para mostrar en la cuadrícula'} onClick={() => toggleAiChatVisible(item.id)}>{checked ? '✓' : ''}</button>
            <button className="ai-chat-open" onClick={() => focusAiChat(item.id)} onDoubleClick={event => { event.stopPropagation(); renameAiChat(item); }} title="Clic para abrir · clic derecho o doble clic para cambiar el nombre"><Icon size={13}/><span>{item.name}</span></button>
            <button className="ai-chat-close" aria-label={`Cerrar ${item.name}`} title="Cerrar subpestaña" onClick={() => closeAiChat(item)}>×</button>
          </div>;
        })}
        <button className="ai-add-chat" title="Crear chat nuevo o abrir uno existente" onClick={openAiChatDialog}><Plus size={15}/><span>Agregar chat</span></button>
      </div>
      <div className="ai-layout-tools">
        {showPersonalUsage && <PersonalUsageStrip/>}
        <span className="ai-visible-count" title={`${selectedAiTabs.length} / ${workspacePanelLimit(currentWorkspacePanels(),aiTabs)} visibles · ${providerAiTabs.length} / 8 chats`}>{selectedAiTabs.length}/{workspacePanelLimit(currentWorkspacePanels(),aiTabs)} · {providerAiTabs.length}/8</span>
      </div>
    </section>}

    {tab === 'calendar' && <section className="overlay-bar calendar-bar">
      <label className="ai-select"><span className="slot-label">CUENTA</span><span className="select-wrap"><select value={calendarAccount} onChange={event => { setCalendarAccount(event.target.value); setViewError(null); }} aria-label="Cuenta de Calendario">{EMAILS.map(account => <option key={account.id} value={account.id}>{account.short} · {account.email}</option>)}</select><ChevronDown size={14}/></span></label>
      <span className="bar-hint">Para ver reuniones juntas, activá los calendarios vinculados en el menú de Google Calendar.</span>
    </section>}

    {tab === 'microinfluencers' && <section className="overlay-bar micro-preview-bar"><Smartphone size={15}/><span>Vista móvil</span><div className="micro-url-controls"><input aria-label="Enlace de vista previa de Microinfluencers" value={microUrlDraft} onChange={event => setMicroUrlDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyMicroUrl(); } }} placeholder="Pegá el enlace de vista previa"/><button type="button" onClick={applyMicroUrl} title="Guardar enlace y recargar"><RefreshCw size={14}/></button><small>390 × 844</small></div></section>}
    {tab === 'documents' ? renderDocumentsPane() : <main className={`remote-stage stage-${tab} ${tab === 'microinfluencers' ? 'micro-preview-stage' : ''}`}>
      {!inDesktop && <div className="preview-notice"><div className="notice-icon"><CurrentIcon size={20}/></div><div><strong>La vista de servicios aparece en la app de escritorio</strong><p>Esta pantalla es una previsualización. Iniciá la app para conectar WhatsApp, Telegram, Gmail y tus cuentas de IA.</p></div><span className="preview-pill">VISTA PREVIA</span></div>}
      {tab === 'gmail' && <div className="mosaic-label">VISTA CONJUNTA <span>· {selectedMailIds.length} {selectedMailIds.length === 1 ? 'cuenta' : 'cuentas'}</span></div>}
      {tab === 'messaging' && <div className="messaging-mosaic-label">{viewIds.map(id=>{const app=MESSAGING_APPS.find(a=>a.id===id);const Icon=app.icon;return <div className="ai-panel-label" key={id}><Icon size={14}/><span>{app.short}</span></div>})}</div>}
      {inDesktop && tab !== 'documents' && <div className="remote-background"/>}
    </main>}
    </>}
    <footer className="statusbar"><span><span className="green-dot"/> Workhub funciona localmente en este equipo</span><span>v{APP_VERSION} · Escritorio privado</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
