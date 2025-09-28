import React, { useEffect, useMemo, useRef, useState } from 'react';
import { topics as seedTopics, prompts as seedPrompts } from '../lib/prompts';
import type { Topic, Prompt, Attachment, LogEntry, Settings, HistoryItem } from '../lib/types';
import { redactPII } from '../lib/redact';

type Msg = { role: 'system'|'user'|'assistant'; content: string };

function uid(prefix='id') { return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }
function ts() { return new Date().toLocaleString(); }

/** simple profile records stored in localStorage */
type ProfileMeta = { id: string; name: string };

const PROFILES_KEY = 'teacher_ai_profiles_v1';
const STATE_KEY = (pid: string) => `teacher_ai_state_profile_${pid}`;

export default function Home() {
  // ---------- profiles ----------
  const [profiles, setProfiles] = useState<ProfileMeta[]>([]);
  const [profileId, setProfileId] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');

  // ---------- app state (per profile) ----------
  const [topics, setTopics] = useState<Topic[]>(seedTopics);                 // empty by default now
  const [prompts, setPrompts] = useState<Prompt[]>(seedPrompts);             // four global defaults
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  const [settings, setSettings] = useState<Settings>({ curriculum: '', grade: '' });

  const [contextNotes, setContextNotes] = useState<string>('');
  const [links, setLinks] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [output, setOutput] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [redact, setRedact] = useState<boolean>(true);
  const [allowNames, setAllowNames] = useState<boolean>(false);

  // create topic inputs
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');

  // create prompt inputs (global)
  const [showCreatePrompt, setShowCreatePrompt] = useState(false);
  const [newPromptLabel, setNewPromptLabel] = useState('');
  const [newPromptTemplate, setNewPromptTemplate] = useState('Can you write a MCQ for {{topic}} using the article in the {{context}}?');

  // inline editing for existing prompts
  const [editingPromptId, setEditingPromptId] = useState<string>('');
  const [editLabel, setEditLabel] = useState<string>('');
  const [editTemplate, setEditTemplate] = useState<string>('');

  // selection edit (canvas-like)
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionInstr, setSelectionInstr] = useState('');
  const [selectionRange, setSelectionRange] = useState<{start:number; end:number}|null>(null);

  // messages for API
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'system', content: 'You are a helpful teaching assistant. Follow teacher instructions faithfully and keep answers concise and classroom-appropriate.' }
  ]);

  // ---------- load profiles and pick one ----------
  useEffect(()=>{
    const listRaw = localStorage.getItem(PROFILES_KEY);
    let list: ProfileMeta[] = [];
    if (listRaw) { try { list = JSON.parse(listRaw)||[]; } catch {} }
    if (list.length === 0) {
      // bootstrap default profile
      const p: ProfileMeta = { id: uid('profile'), name: 'My Profile' };
      localStorage.setItem(PROFILES_KEY, JSON.stringify([p]));
      setProfiles([p]);
      setProfileId(p.id);
      setProfileName(p.name);
      // ensure state stored
      const initState = {
        topics: seedTopics,
        prompts: seedPrompts,
        selectedTopic: '',
        settings: { curriculum: '', grade: '' },
        contextNotes: '',
        links: '',
        attachments: [],
        output: '',
        logs: [],
        history: [],
        messages: [
          { role: 'system', content: 'You are a helpful teaching assistant. Follow teacher instructions faithfully and keep answers concise and classroom-appropriate.' }
        ],
        redact: true,
        allowNames: false
      };
      localStorage.setItem(STATE_KEY(p.id), JSON.stringify(initState));
    } else {
      setProfiles(list);
      setProfileId(list[0].id);
      setProfileName(list[0].name);
    }
  }, []);

  // load state for selected profile
  useEffect(()=>{
    if (!profileId) return;
    const raw = localStorage.getItem(STATE_KEY(profileId));
    if (raw) {
      try {
        const s = JSON.parse(raw);
        setTopics(s.topics || []);
        setPrompts(s.prompts || seedPrompts);
        setSelectedTopic(s.selectedTopic || '');
        setSettings(s.settings || { curriculum:'', grade:'' });
        setContextNotes(s.contextNotes || '');
        setLinks(s.links || '');
        setAttachments(s.attachments || []);
        setOutput(s.output || '');
        setLogs(s.logs || []);
        setHistory(s.history || []);
        setMessages(s.messages || [{ role:'system', content:'You are a helpful teaching assistant. Follow teacher instructions faithfully and keep answers concise and classroom-appropriate.' }]);
        setRedact(s.redact ?? true);
        setAllowNames(s.allowNames ?? false);
      } catch {}
    }
  }, [profileId]);

  // persist state to the active profile
  useEffect(()=>{
    if (!profileId) return;
    const s = {
      topics, prompts, selectedTopic, settings,
      contextNotes, links, attachments, output, logs, history,
      messages, redact, allowNames
    };
    localStorage.setItem(STATE_KEY(profileId), JSON.stringify(s));
  }, [profileId, topics, prompts, selectedTopic, settings, contextNotes, links, attachments, output, logs, history, messages, redact, allowNames]);

  // ---------- helpers ----------
  function addLog(kind: LogEntry['kind'], detail: string) {
    setLogs(l => [{ id: uid('log'), at: Date.now(), kind, detail }, ...l]);
  }

  function buildPromptContext() {
    const lines = contextNotes.split('\n').map(s=>s.trim()).filter(Boolean);
    const kv: Record<string,string> = {};
    for (const line of lines) {
      const m = line.match(/^([a-zA-Z ]+):\s*(.+)$/);
      if (m) kv[m[1].toLowerCase()] = m[2];
    }
    const linkList = links.split(/\s|,|;+/).map(s=>s.trim()).filter(Boolean).join(', ');
    const fileTexts = attachments.filter(a=>a.kind==='text').map(a=>`[${a.name}] ${a.content.slice(0,1200)}`).join('\n');

    const selected = topics.find(t=>t.id===selectedTopic);
    const topicText = selected?.title || kv['topic'] || kv['subject'] || 'your class topic';

    const context = [
      'NOTES:', contextNotes || '(none)',
      'LINKS:', linkList || '(none)',
      attachments.length ? 'ATTACHMENTS (snippets):' : 'ATTACHMENTS: (none)',
      fileTexts || ''
    ].join('\n');

    return {
      context,
      topicText,
      curriculum: settings.curriculum || 'unspecified curriculum',
      grade: settings.grade || 'unspecified grade',
      level: kv['level'] || 'unspecified',
      goals: kv['goals'] || 'unspecified',
      task: kv['task'] || 'the described task',
      subject: kv['subject'] || kv['topic'] || 'the subject'
    };
  }

  function applyTemplate(template: string, base: ReturnType<typeof buildPromptContext>) {
    return template
      .replace(/{{topic}}/g, base.topicText)
      .replace(/{{context}}/g, base.context)
      .replace(/{{curriculum}}/g, base.curriculum)
      .replace(/{{grade}}/g, base.grade)
      // support legacy placeholders too
      .replace('{{topicText}}', base.topicText)
      .replace('{{level}}', base.level)
      .replace('{{goals}}', base.goals)
      .replace('{{task}}', base.task)
      .replace('{{subject}}', base.subject);
  }

  async function callAI(userContent: string) {
    const prepared = redact ? redactPII(userContent) : userContent;
    const withNames = allowNames ? prepared : prepared.replace(/\b[A-Z][a-z]+\b/g, ()=>'[NAME]');

    const newMessages: Msg[] = [
      { role: 'system', content: 'Safety: If content seems to include student names/PII, generalize it unless explicitly allowed.'},
      ...messages,
      { role: 'user', content: withNames }
    ];

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages })
    });
    const data = await res.json();
    const text = data?.content || '[no content]';
    setMessages(m => [...m, { role:'user', content: withNames }, { role:'assistant', content: text }]);
    return text;
  }

  async function runPrompt(p: Prompt) {
    const base = buildPromptContext();
    const filled = applyTemplate(p.template, base);
    const userText = `Use the following instruction for the teacher:\n${filled}\n\nContext:\n${base.context}`;
    const text = await callAI(userText);
    setOutput(text);
    addLog('generate', `Generated with “${p.label}” at ${ts()}`);

    setHistory(h => [
      { id: uid('h'), at: Date.now(), kind: 'generate', promptLabel: p.label, inputPreview: filled.slice(0,180), output: text },
      ...h
    ]);
  }

  async function onChatSend() {
    if (!chatInput.trim()) return;
    const base = buildPromptContext();
    const userText = `Refine the current output per this request: ${chatInput}\n\nCurrent Output:\n${output}\n\nAdditional Context:\n${base.context}`;
    const text = await callAI(userText);
    setOutput(text);
    addLog('chat', `Refinement: “${chatInput.slice(0,120)}” at ${ts()}`);
    setChatInput('');

    setHistory(h => [
      { id: uid('h'), at: Date.now(), kind: 'chat', inputPreview: chatInput.slice(0,180), output: text },
      ...h
    ]);
  }

  // selection (canvas-like) refine
  function onEditorSelect() {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start) {
      setSelectionRange({start, end});
    } else {
      setSelectionRange(null);
    }
  }

  async function runSelectionEdit() {
    if (!selectionRange || !selectionInstr.trim()) return;
    const { start, end } = selectionRange;
    const selected = output.slice(start, end);
    const base = buildPromptContext();
    const userText = `Rewrite or edit the SELECTED TEXT according to the teacher's instruction.\nInstruction: ${selectionInstr}\n\nSELECTED TEXT:\n${selected}\n\nBroader context (may help but do not repeat it):\n${base.context}\nReturn ONLY the revised text, no extra commentary.`;
    const edited = await callAI(userText);

    const newOutput = output.slice(0,start) + edited + output.slice(end);
    setOutput(newOutput);
    addLog('edit', `Selection edited at ${ts()}`);
    setSelectionInstr('');
    setSelectionRange(null);

    setHistory(h => [
      { id: uid('h'), at: Date.now(), kind: 'selection', inputPreview: selectionInstr.slice(0,180), output: newOutput },
      ...h
    ]);
  }

  function onAttachFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(file=>{
      if (file.type === 'application/pdf') {
        const id = uid('att');
        setAttachments(a => [{ id, name: file.name, kind:'text', content: '(PDF attached – not uploaded; not parsed in MVP)' }, ...a]);
        addLog('attach', `Attached PDF (local only): ${file.name}`);
      } else if (file.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const id = uid('att');
          setAttachments(a => [{ id, name: file.name, kind:'text', content: String(reader.result||'') }, ...a]);
          addLog('attach', `Attached text file: ${file.name}`);
        };
        reader.readAsText(file);
      } else {
        const id = uid('att');
        setAttachments(a => [{ id, name: file.name, kind:'text', content: '(Unsupported file type in MVP)' }, ...a]);
        addLog('attach', `Attempted attach (unsupported type): ${file.name}`);
      }
    });
  }

  // --- add topic ---
  function addTopic() {
    const title = newTopicTitle.trim();
    if (!title) return;
    const t: Topic = { id: uid('topic'), title, description: newTopicDesc.trim() || undefined };
    setTopics(prev => [t, ...prev]);
    setSelectedTopic(t.id);
    setNewTopicTitle('');
    setNewTopicDesc('');
    addLog('edit', `Added topic “${t.title}”`);
  }

  // --- add prompt (global) ---
  function addPrompt() {
    const label = newPromptLabel.trim();
    const template = newPromptTemplate.trim();
    if (!label || !template) return;
    const p: Prompt = { id: uid('btn'), label, template };
    setPrompts(prev => [p, ...prev]);
    setShowCreatePrompt(false);
    setNewPromptLabel('');
    setNewPromptTemplate('Can you write a MCQ for {{topic}} using the article in the {{context}}?');
    addLog('edit', `Created button “${p.label}”`);
  }

  // --- edit existing prompt ---
  function startEditPrompt(p: Prompt) {
    setEditingPromptId(p.id);
    setEditLabel(p.label);
    setEditTemplate(p.template);
  }
  function saveEditPrompt() {
    if (!editingPromptId) return;
    setPrompts(prev => prev.map(p => p.id===editingPromptId ? { ...p, label: editLabel.trim() || p.label, template: editTemplate.trim() || p.template } : p));
    addLog('edit', `Edited button “${editLabel}”`);
    setEditingPromptId('');
    setEditLabel('');
    setEditTemplate('');
  }
  function cancelEditPrompt() {
    setEditingPromptId('');
  }

  // --- profiles actions ---
  function createProfile() {
    const name = window.prompt('Profile name (e.g., “Grade 6 MYP”):', 'New Profile') || '';
    if (!name.trim()) return;
    const p: ProfileMeta = { id: uid('profile'), name: name.trim() };
    const next = [p, ...profiles];
    setProfiles(next);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    // init state for new profile
    const initState = {
      topics: [],
      prompts: seedPrompts, // start with the four defaults
      selectedTopic: '',
      settings: { curriculum: '', grade: '' },
      contextNotes: '',
      links: '',
      attachments: [],
      output: '',
      logs: [],
      history: [],
      messages: [
        { role: 'system', content: 'You are a helpful teaching assistant. Follow teacher instructions faithfully and keep answers concise and classroom-appropriate.' }
      ],
      redact: true,
      allowNames: false
    };
    localStorage.setItem(STATE_KEY(p.id), JSON.stringify(initState));
    setProfileId(p.id); setProfileName(p.name);
    addLog('profile', `Created profile “${p.name}”`);
  }

  function switchProfile(id: string) {
    setProfileId(id);
    const meta = profiles.find(x=>x.id===id);
    if (meta) setProfileName(meta.name);
    addLog('profile', `Switched to profile “${meta?.name || id}”`);
  }

  // ---------- UI ----------
  const selectionVisible = selectionRange !== null;

  return (
    <div className="app">
      <header className="header">
        <strong>Teacher AI — Privacy-First MVP</strong>
        <span className="badge">Profiles</span>
        <select
          className="select"
          value={profileId}
          onChange={(e)=>switchProfile(e.target.value)}
          style={{maxWidth:240}}
        >
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="prompt-btn" onClick={createProfile}>＋ New Profile</button>

        <div className="row" style={{marginLeft:'auto'}}>
          <label className="switch">
            <input type="checkbox" checked={redact} onChange={(e)=>{ setRedact(e.target.checked); addLog('privacy', `Redaction ${e.target.checked ? 'enabled' : 'disabled'} at ${ts()}`); }} />
            Redact PII
          </label>
          <label className="switch">
            <input type="checkbox" checked={allowNames} onChange={(e)=>{ setAllowNames(e.target.checked); addLog('privacy', `Allow student names = ${e.target.checked} at ${ts()}`); }} />
            Allow student names
          </label>
        </div>
      </header>

      {/* Left: settings + topics */}
      <aside className="sidebar">
        <div className="section-title">Class settings</div>
        <div className="panel">
          <label className="small">Curriculum</label>
          <select className="select" value={settings.curriculum} onChange={(e)=>setSettings(s=>({ ...s, curriculum: e.target.value }))}>
            <option value="">— Select curriculum —</option>
            <option value="IB PYP">IB PYP</option>
            <option value="IB MYP">IB MYP</option>
            <option value="IB DP">IB DP</option>
            <option value="Cambridge IGCSE">Cambridge IGCSE</option>
            <option value="Cambridge A Levels">Cambridge A Levels</option>
            <option value="US Common Core">US Common Core</option>
            <option value="NGSS">NGSS</option>
            <option value="UK National Curriculum">UK National Curriculum</option>
            <option value="Australian Curriculum">Australian Curriculum</option>
            <option value="CBSE">CBSE</option>
            <option value="ICSE">ICSE</option>
            <option value="Other">Other</option>
          </select>
          <div style={{height:8}} />
          <label className="small">Grade</label>
          <select className="select" value={settings.grade} onChange={(e)=>setSettings(s=>({ ...s, grade: e.target.value }))}>
            <option value="">— Select grade —</option>
            {Array.from({length:13}).map((_,i)=> <option key={i} value={i===0?'K':String(i)}>{i===0?'K':``Grade ${i}` ``}</option>)}
          </select>
        </div>

        <div className="section-title">Add Topic</div>
        <div className="panel">
          <input
            className="input"
            placeholder="Topic title (e.g., Ecosystems unit, Vocabulary Week 3)"
            value={newTopicTitle}
            onChange={(e)=>setNewTopicTitle(e.target.value.slice(0,10000))}
            maxLength={10000}
          />
          <div style={{height:8}} />
          <textarea
            className="textarea"
            placeholder="Optional description or notes for this topic…"
            value={newTopicDesc}
            onChange={(e)=>setNewTopicDesc(e.target.value.slice(0,10000))}
            maxLength={10000}
          />
          <div className="actions">
            <button className="prompt-btn" onClick={addTopic}>Add Topic</button>
          </div>
          <div className="help">Max 10,000 chars.</div>
        </div>

        <div className="section-title">Topics</div>
        <div>
          {topics.map(t => (
            <div key={t.id}
                 className={"topic " + (t.id===selectedTopic ? 'active' : '')}
                 onClick={()=>setSelectedTopic(t.id)}>
              <div>{t.title}</div>
              {t.description && <div className="small">{t.description}</div>}
            </div>
          ))}
          {topics.length===0 && <div className="small">No topics yet—add one above.</div>}
        </div>

        <hr className="sep" />
        <div className="section-title">Change Log</div>
        <div className="log">
          {logs.length===0 && <div className="small">No changes yet.</div>}
          {logs.map(l => (
            <div key={l.id} style={{marginBottom:8}}>
              <div><strong>{new Date(l.at).toLocaleTimeString()}</strong> – <em>{l.kind}</em></div>
              <div className="small">{l.detail}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Center: Context & Output (with selection edit) */}
      <main className="center">
        <div className="editor-wrap">
          <div className="section-title">Context (notes & links)</div>
          <textarea className="context" placeholder="Example:\nSubject: Ecosystems\nLevel: Grade 6\nGoals: food webs, energy transfer\nTask: create poster\n\nAdd any notes here..."
                    value={contextNotes} onChange={e=>setContextNotes(e.target.value)} />
          <div style={{height:8}} />
          <input placeholder="Paste links separated by space/comma/newline" value={links} onChange={e=>setLinks(e.target.value)} style={{width:'100%', padding:'10px', border:'1px solid var(--border)', borderRadius:8}} />
          <div className="attachments">Attach files (text/PDF read locally): <input type="file" multiple onChange={(e)=>onAttachFiles(e.target.files)} /></div>
        </div>

        <div className="editor-wrap">
          <div className="section-title">Output (editable)</div>
          <textarea
            ref={editorRef}
            className="editor"
            value={output}
            onChange={(e)=>{ setOutput(e.target.value); }}
            onBlur={()=>addLog('edit', `Edited output at ${ts()}`)}
            onSelect={onEditorSelect}
          />
          {selectionRange && (
            <div className="panel" style={{marginTop:8}}>
              <div className="small" style={{marginBottom:6}}>Selection tools — type an instruction and run on the highlighted text.</div>
              <input className="input" placeholder="e.g., Simplify this paragraph and keep key terms." value={selectionInstr} onChange={(e)=>setSelectionInstr(e.target.value)} />
              <div className="actions">
                <button className="prompt-btn" onClick={runSelectionEdit}>Ask AI for selection</button>
                <button className="prompt-btn" onClick={()=>{ setSelectionInstr(''); setSelectionRange(null); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="chat">
          <input placeholder="Ask for edits or add details..." value={chatInput} onChange={e=>setChatInput(e.target.value)} />
          <button onClick={onChatSend}>Send</button>
        </div>
      </main>

      {/* Right: Global Buttons + Create/Edit + History */}
      <aside className="rightbar">
        <div className="section-title">Buttons (Global)</div>

        <div className="panel">
          {!showCreatePrompt && (
            <button className="prompt-btn" onClick={()=>setShowCreatePrompt(true)}>＋ Create New Button</button>
          )}
          {showCreatePrompt && (
            <>
              <input className="input" placeholder="Button label (e.g., Make MCQ)"
                     value={newPromptLabel} onChange={(e)=>setNewPromptLabel(e.target.value.slice(0,200))} maxLength={200} />
              <div style={{height:8}} />
              <textarea
                className="textarea"
                placeholder="Write the prompt template here… Use {{topic}}, {{context}}, {{curriculum}}, and {{grade}} where needed."
                value={newPromptTemplate}
                onChange={(e)=>setNewPromptTemplate(e.target.value.slice(0,10000))}
                maxLength={10000}
              />
              <div className="tokenbar">
                <span className="token" onClick={()=>setNewPromptTemplate(v => (v? v + ' ' : '') + '{{topic}}')}>Insert {'{{topic}}'}</span>
                <span className="token" onClick={()=>setNewPromptTemplate(v => (v? v + ' ' : '') + '{{context}}')}>Insert {'{{context}}'}</span>
                <span className="token" onClick={()=>setNewPromptTemplate(v => (v? v + ' ' : '') + '{{curriculum}}')}>Insert {'{{curriculum}}'}</span>
                <span className="token" onClick={()=>setNewPromptTemplate(v => (v? v + ' ' : '') + '{{grade}}')}>Insert {'{{grade}}'}</span>
              </div>
              <div className="help">You can call the selected topic, full context, curriculum, and grade inside your prompt template.</div>
              <div className="actions">
                <button className="prompt-btn" onClick={addPrompt}>Save Button</button>
                <button className="prompt-btn" onClick={()=>setShowCreatePrompt(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>

        <div>
          {prompts.map(p => (
            <div key={p.id} style={{marginBottom:8}}>
              {editingPromptId !== p.id ? (
                <>
                  <button className="prompt-btn" onClick={()=>runPrompt(p)}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div style={{fontWeight:600}}>{p.label}</div>
                      <button
                        className="badge"
                        type="button"
                        onClick={(e)=>{ e.stopPropagation(); startEditPrompt(p); }}
                      >✎ Edit</button>
                    </div>
                    <div className="small">{p.template.slice(0,120)}...</div>
                  </button>
                </>
              ) : (
                <div className="panel">
                  <input className="input" value={editLabel} onChange={(e)=>setEditLabel(e.target.value)} />
                  <div style={{height:8}} />
                  <textarea className="textarea" value={editTemplate} onChange={(e)=>setEditTemplate(e.target.value)} />
                  <div className="help">Use {'{{topic}}'}, {'{{context}}'}, {'{{curriculum}}'}, {'{{grade}}'} inside your prompt.</div>
                  <div className="actions">
                    <button className="prompt-btn" onClick={saveEditPrompt}>Save</button>
                    <button className="prompt-btn" onClick={cancelEditPrompt}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {prompts.length===0 && <div className="small">No buttons yet—create one above.</div>}
        </div>

        <hr className="sep" />
        <div className="section-title">History</div>
        <div className="log" style={{maxHeight:'35vh'}}>
          {history.length===0 && <div className="small">No history yet.</div>}
          {history.map(h => (
            <div key={h.id} style={{marginBottom:8}}>
              <div><strong>{new Date(h.at).toLocaleTimeString()}</strong> – <em>{h.kind}</em> {h.promptLabel ? `(${h.promptLabel})` : ''}</div>
              <div className="small">{h.inputPreview}</div>
              <div className="actions">
                <button className="prompt-btn" onClick={()=>setOutput(h.output)}>Load into editor</button>
              </div>
            </div>
          ))}
        </div>

        <hr className="sep" />
        <div className="small">
          Tip: In any prompt template you can reference <code>{'{{topic}}'}</code>, <code>{'{{context}}'}</code>, <code>{'{{curriculum}}'}</code>, and <code>{'{{grade}}'}</code>.
        </div>
      </aside>
    </div>
  );
}
