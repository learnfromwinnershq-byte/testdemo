"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import bookDataJson from "../public/books/white-paper/book.json";
import audioManifestJson from "../public/books/white-paper/audio/manifest.json";

type Role = "child" | "parent";
type ChildView = "shelf" | "player";

type BookSentence = { id: string; text: string };
type BookChapter = {
  id: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  characterCount: number;
  estimatedSeconds: number;
  sentences: BookSentence[];
};
type BookData = {
  id: string;
  title: string;
  author: string;
  pageCount: number;
  sourceFile: string;
  chapters: BookChapter[];
};
type TimelineCue = BookSentence & { startMs: number; endMs: number };
type TimelineFile = { chapterId: string; title: string; durationMs: number; cues: TimelineCue[] };

const bookData = bookDataJson as BookData;
const audioManifest = audioManifestJson as { chapters: Record<string, { durationMs: number; sentenceCount: number }> };
const chapters = bookData.chapters;
const progressKey = (chapterId: string) => `tingye-progress-${chapterId}-ms`;
const publishedKey = "tingye-demo-published";

function assetPath(path: string) {
  const base = typeof window !== "undefined" && window.location.pathname.startsWith("/learn/a2-tingye")
    ? "/learn/a2-tingye"
    : "";
  return `${base}/${path.replace(/^\//, "")}`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(1, Math.round((seconds % 3600) / 60));
  return hours ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
}

function chapterDuration(chapter: BookChapter) {
  return (audioManifest.chapters[chapter.id]?.durationMs ?? chapter.estimatedSeconds * 1000) / 1000;
}

function AppMark() {
  return <div className="brand" aria-label="听叶家庭粤语听书"><span className="brand-mark" aria-hidden="true">听</span><span><strong>听叶</strong><small>家庭粤语听书</small></span></div>;
}

export function ListeningApp() {
  const [role, setRole] = useState<Role>("child");
  const [childView, setChildView] = useState<ChildView>("shelf");
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [published, setPublished] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(publishedKey);
    if (saved !== null) setPublished(saved === "true");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(assetPath("sw.js")).catch(() => undefined);
  }, []);

  function switchRole(next: Role) {
    setRole(next);
    if (next === "child") setChildView("shelf");
  }

  return <div className="app-shell">
    <header className="topbar">
      <AppMark />
      <nav className="role-switch" aria-label="切换使用身份"><button className={role === "child" ? "active" : ""} onClick={() => switchRole("child")}>孩子听书</button><button className={role === "parent" ? "active" : ""} onClick={() => switchRole("parent")}>家长管理</button></nav>
      <div className="profile-chip"><span aria-hidden="true">林</span><div><strong>{role === "child" ? "小林" : "林妈妈"}</strong><small>{role === "child" ? "今天听了 12 分钟" : "家庭管理员"}</small></div></div>
    </header>

    {role === "child" ? childView === "shelf"
      ? <ChildShelf published={published} onContinue={() => { setSelectedChapter(0); setChildView("player"); }} />
      : <Player chapterIndex={selectedChapter} onSelectChapter={setSelectedChapter} onBack={() => setChildView("shelf")} />
      : <ParentStudio published={published} setPublished={(value) => {
        setPublished(value);
        window.localStorage.setItem(publishedKey, String(value));
        setToast(value ? "已发布到孩子书架" : "已从孩子书架撤下");
        window.setTimeout(() => setToast(""), 2600);
      }} />}
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </div>;
}

function ChildShelf({ published, onContinue }: { published: boolean; onContinue: () => void }) {
  const [savedMs, setSavedMs] = useState(0);
  useEffect(() => setSavedMs(Number(window.localStorage.getItem(progressKey(chapters[0].id)) ?? 0)), []);
  const percent = Math.min(100, Math.round(savedMs / (chapterDuration(chapters[0]) * 10)));
  const totalSeconds = chapters.reduce((sum, chapter) => sum + chapterDuration(chapter), 0);

  return <main className="child-home">
    <section className="welcome-row"><div><p className="eyebrow">星期一 · 晚上好</p><h1>想继续听哪个故事？</h1><p>慢慢听，每一句都算数。</p></div><div className="week-card"><strong>本周 48 分钟</strong><div className="week-bars" aria-label="本周收听记录"><i /><i /><i className="tall" /><i /><i className="today" /><i /><i /></div><span>比上周多听了 12 分钟</span></div></section>
    <section aria-labelledby="continue-title">
      <div className="section-heading"><div><p className="eyebrow">正在收听</p><h2 id="continue-title">继续上次的故事</h2></div><button className="text-button">收听记录</button></div>
      {published ? <article className="featured-book">
        <div className="cover-wrap"><img src={assetPath("books/white-paper/cover.png")} alt="《法医秦明：白卷》封面" /><span>家长已发布</span></div>
        <div className="featured-copy"><div className="book-meta"><span>法医小说</span><span>较强内容</span><span>全书 {chapters.length} 章</span></div><h3>{bookData.title}</h3><p className="author">{bookData.author} · 粤语朗读</p><blockquote>“这个世界上最爱我的人，却也最让我窒息。”</blockquote><div className="progress-line"><span style={{ width: `${Math.max(percent, 4)}%` }} /></div><div className="progress-copy"><span>{savedMs ? `引子已听 ${percent}%` : "尚未开始"}</span><span>全书约 {formatDuration(totalSeconds)}</span></div><button className="primary large" onClick={onContinue}><span aria-hidden="true">▶</span>{savedMs ? `从 ${formatTime(savedMs / 1000)} 继续` : "开始收听"}</button></div>
        <div className="privacy-note"><span aria-hidden="true">●</span><p><strong>只有家人看得到</strong><br />这本书不会公开，也不能下载原文件。</p></div>
      </article> : <div className="empty-shelf"><span aria-hidden="true">⌁</span><h3>书架还在等一本故事</h3><p>家长发布后，会自动出现在这里。</p></div>}
    </section>
    <section className="shelf-section" aria-labelledby="shelf-title"><div className="section-heading"><div><p className="eyebrow">我的书架</p><h2 id="shelf-title">家里的故事</h2></div><span className="soft-count">1 本</span></div><div className="shelf-note">全书正文已经生成，粤语音频按章完成后即可收听；不含搜索、排行和广告。</div></section>
  </main>;
}

function Player({ onBack, chapterIndex, onSelectChapter }: { onBack: () => void; chapterIndex: number; onSelectChapter: (index: number) => void }) {
  const chapter = chapters[chapterIndex];
  const audioRef = useRef<HTMLAudioElement>(null);
  const cueRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastSavedRef = useRef(0);
  const [timeline, setTimeline] = useState<TimelineCue[]>([]);
  const [audioReady, setAudioReady] = useState(false);
  const [availableIds, setAvailableIds] = useState<Set<string>>(new Set(Object.keys(audioManifest.chapters)));
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(chapterDuration(chapter));
  const [speed, setSpeed] = useState(1);
  const [showChapters, setShowChapters] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);

  const activeIndex = useMemo(() => {
    if (!timeline.length) return -1;
    const ms = currentTime * 1000;
    const found = timeline.findIndex((cue) => ms >= cue.startMs && ms < cue.endMs);
    return found < 0 ? Math.max(0, timeline.length - 1) : found;
  }, [currentTime, timeline]);

  useEffect(() => {
    let cancelled = false;
    let retry: number | undefined;
    setTimeline([]); setAudioReady(false); setPlaying(false); setCurrentTime(0); setDuration(chapterDuration(chapter));
    async function loadTimeline() {
      try {
        const response = await fetch(assetPath(`books/white-paper/audio/${chapter.id}.cues.json`), { cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as TimelineFile;
          if (!cancelled) {
            setTimeline(data.cues); setDuration(data.durationMs / 1000); setAudioReady(true);
            setAvailableIds((ids) => new Set(ids).add(chapter.id));
          }
          return;
        }
      } catch { /* generation may still be running */ }
      if (!cancelled) retry = window.setTimeout(loadTimeline, 8000);
    }
    void loadTimeline();
    return () => { cancelled = true; if (retry) window.clearTimeout(retry); };
  }, [chapter.id, chapter.estimatedSeconds]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(chapters.map(async (item) => {
      try { const response = await fetch(assetPath(`books/white-paper/audio/${item.id}.cues.json`), { method: "HEAD", cache: "no-store" }); return response.ok ? item.id : null; } catch { return null; }
    })).then((ids) => { if (!cancelled) setAvailableIds(new Set(ids.filter((id): id is string => Boolean(id)))); });
    return () => { cancelled = true; };
  }, [chapter.id]);

  useEffect(() => {
    if (!audioReady || !audioRef.current) return;
    const saved = Number(window.localStorage.getItem(progressKey(chapter.id)) ?? 0);
    if (saved > 0 && saved < duration * 1000) audioRef.current.currentTime = saved / 1000;
    setCurrentTime(audioRef.current.currentTime);
  }, [audioReady, chapter.id]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioReady]);

  useEffect(() => { if (activeIndex >= 0) cueRefs.current[timeline[activeIndex]?.id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [activeIndex, timeline]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !audioReady) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: chapter.title, artist: `${bookData.author} · 粤语朗读`, album: "听叶家庭书架", artwork: [{ src: assetPath("books/white-paper/cover.png"), sizes: "1024x1320", type: "image/png" }] });
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [["play", () => audioRef.current?.play()], ["pause", () => audioRef.current?.pause()], ["seekbackward", () => seek(-15)], ["seekforward", () => seek(15)]];
    handlers.forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* enhancement */ } });
    return () => handlers.forEach(([action]) => { try { navigator.mediaSession.setActionHandler(action, null); } catch { /* enhancement */ } });
  }, [audioReady, chapter.id, chapter.title]);

  useEffect(() => { if (!sleepEndsAt) return; const timer = window.setTimeout(() => audioRef.current?.pause(), Math.max(0, sleepEndsAt - Date.now())); return () => window.clearTimeout(timer); }, [sleepEndsAt]);
  useEffect(() => { const save = () => window.localStorage.setItem(progressKey(chapter.id), String(Math.round((audioRef.current?.currentTime ?? 0) * 1000))); window.addEventListener("pagehide", save); return () => { save(); window.removeEventListener("pagehide", save); }; }, [chapter.id]);

  function persist(time: number, force = false) { const ms = Math.round(time * 1000); if (force || Math.abs(ms - lastSavedRef.current) >= 5000) { window.localStorage.setItem(progressKey(chapter.id), String(ms)); lastSavedRef.current = ms; } }
  async function togglePlay() { const audio = audioRef.current; if (!audioReady || !audio) return; if (audio.paused) await audio.play(); else audio.pause(); }
  function seek(seconds: number) { const audio = audioRef.current; if (!audioReady || !audio) return; audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), audio.duration || duration); }
  function jumpToCue(index: number, autoPlay = true) { const audio = audioRef.current; const cue = timeline[Math.min(Math.max(index, 0), timeline.length - 1)]; if (!audioReady || !audio || !cue) return; audio.currentTime = cue.startMs / 1000; setCurrentTime(audio.currentTime); if (autoPlay) void audio.play(); }
  function chooseSleep(minutes: number) { setSleepMinutes(minutes); setSleepEndsAt(minutes ? Date.now() + minutes * 60_000 : null); }

  return <main className="player-page">
    {audioReady && <audio key={chapter.id} ref={audioRef} src={assetPath(`books/white-paper/audio/${chapter.id}.mp3`)} preload="metadata" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => { setPlaying(true); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing"; }} onPause={(event) => { setPlaying(false); persist(event.currentTarget.currentTime, true); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused"; }} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); persist(event.currentTarget.currentTime); }} onEnded={() => { setPlaying(false); window.localStorage.setItem(progressKey(chapter.id), "0"); }} />}
    <div className="player-topline"><button className="back-button" onClick={onBack} aria-label="返回书架">←</button><div><p>{bookData.title}</p><strong>{chapter.title}</strong></div><button className="chapter-button" onClick={() => setShowChapters(true)}>目录 <span aria-hidden="true">☷</span></button></div>
    <div className="player-grid">
      <aside className="now-playing-card"><img src={assetPath("books/white-paper/cover.png")} alt={`《${bookData.title}》封面`} /><p className="eyebrow">当前章节</p><h1>{chapter.title}</h1><p>第 {chapter.pageStart}–{chapter.pageEnd} 页 · {chapter.sentences.length} 句</p><div className="content-advisory"><span aria-hidden="true">!</span><p><strong>较强内容</strong><br />本书含死亡和案件描写，已经过家长确认。</p></div><div className="listen-setting"><span>文字显示</span><div><button className="active">原文</button></div></div><label className="sleep-select">定时关闭<select value={sleepMinutes} onChange={(event) => chooseSleep(Number(event.target.value))}><option value={0}>不开启</option><option value={10}>10 分钟</option><option value={20}>20 分钟</option><option value={30}>30 分钟</option><option value={60}>60 分钟</option></select></label></aside>
      <section className="transcript-panel" aria-label="同步正文"><header><div><p className="eyebrow">逐句跟读</p><h2>{audioReady ? "点击任一句，从这里开始听" : "本章全文已生成"}</h2></div><span className={`sync-badge ${audioReady ? "" : "pending"}`}><i />{audioReady ? "字幕已同步" : "粤语音频生成中"}</span></header>{!audioReady && <div className="audio-pending"><strong>正文现在可以阅读</strong><span>配音完成后本页会自动变为可播放，无需刷新。</span></div>}<div className="transcript-scroll">{(timeline.length ? timeline : chapter.sentences).map((sentence, index) => <button key={sentence.id} ref={(node) => { cueRefs.current[sentence.id] = node; }} className={`sentence ${index === activeIndex ? "active" : ""} ${!audioReady ? "read-only" : ""}`} onClick={() => jumpToCue(index)} aria-disabled={!audioReady} aria-label={audioReady ? `从第${index + 1}句开始播放` : `第${index + 1}句`}><span className="sentence-number">{String(index + 1).padStart(2, "0")}</span><span>{sentence.text}</span>{index === activeIndex && <i className="playing-bars" aria-label="正在播放"><b /><b /><b /></i>}</button>)}</div></section>
    </div>
    <div className="player-controls" aria-label="播放器控制"><div className="timeline-row"><span>{formatTime(currentTime)}</span><input aria-label="播放进度" disabled={!audioReady} type="range" min="0" max={duration || 1} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={(event) => { const audio = audioRef.current; if (audio) audio.currentTime = Number(event.target.value); }} style={{ "--played": `${Math.min(100, (currentTime / (duration || 1)) * 100)}%` } as React.CSSProperties} /><span>{formatTime(duration)}</span></div><div className="control-row"><label className="speed-control"><span>语速</span><select value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); if (audioRef.current) audioRef.current.playbackRate = value; }}><option value={0.6}>0.6×</option><option value={0.8}>0.8×</option><option value={1}>1.0×</option><option value={1.2}>1.2×</option><option value={1.5}>1.5×</option></select></label><div className="main-controls"><button disabled={!audioReady} onClick={() => jumpToCue(activeIndex - 1, false)} aria-label="上一句">◀|</button><button disabled={!audioReady} onClick={() => seek(-15)} aria-label="后退15秒"><span>↶</span><small>15</small></button><button disabled={!audioReady} className="play-button" onClick={togglePlay} aria-label={playing ? "暂停" : "播放"}>{playing ? "Ⅱ" : "▶"}</button><button disabled={!audioReady} onClick={() => seek(15)} aria-label="前进15秒"><span>↷</span><small>15</small></button><button disabled={!audioReady} onClick={() => jumpToCue(activeIndex + 1, false)} aria-label="下一句">|▶</button></div><div className="lock-note"><span aria-hidden="true">◉</span><p><strong>锁屏可继续</strong><small>使用系统音频播放</small></p></div></div></div>
    {showChapters && <ChapterDrawer currentIndex={chapterIndex} availableIds={availableIds} onSelect={(index) => { onSelectChapter(index); setShowChapters(false); }} onClose={() => setShowChapters(false)} />}
  </main>;
}

function ChapterDrawer({ currentIndex, availableIds, onSelect, onClose }: { currentIndex: number; availableIds: Set<string>; onSelect: (index: number) => void; onClose: () => void }) {
  return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="chapter-drawer" role="dialog" aria-modal="true" aria-label="章节目录" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="eyebrow">全书目录</p><h2>{bookData.title}</h2></div><button onClick={onClose} aria-label="关闭目录">×</button></header><p className="drawer-note">全书 {chapters.length} 章正文、粤语音频和逐句字幕均已生成，可以直接选择收听。</p><div className="drawer-list">{chapters.map((chapter, index) => <button key={chapter.id} className={index === currentIndex ? "active" : ""} onClick={() => onSelect(index)}><span>{String(index + 1).padStart(2, "0")}</span><p><strong>{chapter.title}</strong><small>第 {chapter.pageStart} 页 · {formatDuration(chapterDuration(chapter))}</small></p><i>{index === currentIndex ? "正在查看" : availableIds.has(chapter.id) ? "可播放" : "载入中"}</i></button>)}</div></aside></div>;
}

function ParentStudio({ published, setPublished }: { published: boolean; setPublished: (value: boolean) => void }) {
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [chapterEdits, setChapterEdits] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadName, setUploadName] = useState(bookData.sourceFile);
  const [uploadStatus, setUploadStatus] = useState("文字层检查通过");
  const selected = chapters[selectedChapter];
  const text = chapterEdits[selected.id] ?? selected.sentences.map((sentence) => sentence.text).join("\n\n");

  function handleUpload(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; setUploadName(file.name); if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setUploadStatus("请选择 PDF 文件"); return; } if (file.size > 50 * 1024 * 1024) { setUploadStatus("文件超过首版 50MB 限制"); return; } setUploadStatus("文件检查通过，等待文字解析"); }
  function publishBook() { setPublished(true); setHasChanges(false); }
  const publishLabel = !published ? "直接发布到孩子书架" : hasChanges ? "保存修改并更新书架" : "已发布到孩子书架";

  return <main className="parent-page">
    <section className="parent-heading"><div><p className="eyebrow">家庭内容中心</p><h1>准备一本新听书</h1><p>全书文字已经准备好，可以直接发布；发现问题时再校对或试听。</p></div><div className="secure-chip"><span aria-hidden="true">●</span><p><strong>家庭私有</strong><small>仅家长与已绑定的孩子可见</small></p></div></section>
    <div className="workflow"><div className="done"><span>1</span><p><strong>检查文件</strong><small>已完成</small></p></div><i /><div className="done"><span>2</span><p><strong>解析文字</strong><small>{bookData.pageCount} 页</small></p></div><i /><div className="done"><span>3</span><p><strong>全书分章</strong><small>{chapters.length} 章</small></p></div><i /><div className={published ? "done" : "current"}><span>4</span><p><strong>直接发布</strong><small>{published ? "已发布" : "现在可发布"}</small></p></div></div>
    <div className="parent-layout"><aside className="book-inspector"><section className="panel upload-panel"><div className="panel-title"><div><p className="eyebrow">源文件</p><h2>PDF 检查</h2></div><span className="status ok">通过</span></div><label className="upload-box"><input type="file" accept="application/pdf" onChange={handleUpload} /><span aria-hidden="true">⇧</span><p><strong>{uploadName}</strong><small>点击可重新选择 PDF</small></p></label><ul className="file-facts"><li><span>文件</span><strong>7.3 MB</strong></li><li><span>页数</span><strong>{bookData.pageCount} 页</strong></li><li><span>文字层</span><strong>{uploadStatus}</strong></li><li><span>OCR</span><strong>不需要</strong></li></ul></section><section className="panel source-book"><img src={assetPath("books/white-paper/cover.png")} alt={`《${bookData.title}》封面`} /><div><span className="status neutral">全书已解析</span><h3>{bookData.title}</h3><p>{bookData.author} · {chapters.length} 章</p><small>{bookData.chapters.reduce((sum, chapter) => sum + chapter.characterCount, 0).toLocaleString()} 字</small></div></section></aside>
      <section className="review-workspace panel"><header className="review-header"><div><p className="eyebrow">可选校改</p><h2>{selected.title}</h2><p>来源第 {selected.pageStart}–{selected.pageEnd} 页 · 不修改也可以直接发布</p></div><div><button className="secondary">查看 PDF 原页</button><span className={`status ${hasChanges ? "warning" : "neutral"}`}>{hasChanges ? "有未发布修改" : "无需确认"}</span><button className="primary header-publish" disabled={published && !hasChanges} onClick={publishBook}>{publishLabel}</button></div></header><div className="review-body"><div className="chapter-list"><p>已识别 {chapters.length} 个章节</p>{chapters.map((chapter, index) => <button key={chapter.id} className={selectedChapter === index ? "active" : ""} onClick={() => setSelectedChapter(index)}><span>{index + 1}</span><p><strong>{chapter.title}</strong><small>第 {chapter.pageStart} 页</small></p><i>●</i></button>)}</div><div className="editor-area"><div className="editor-toolbar"><span>原文 · 简体中文</span><div><button title="撤销">↶</button><button title="重做">↷</button></div></div><textarea aria-label="章节正文" value={text} onChange={(event) => { setChapterEdits((edits) => ({ ...edits, [selected.id]: event.target.value })); setHasChanges(true); }} /><div className="editor-footer"><span>{text.replace(/\s/g, "").length.toLocaleString()} 字 · {selected.sentences.length} 句</span><span>{hasChanges ? "保存更新后，只重新生成修改过的内容" : "只有发现问题时才需要修改"}</span></div></div></div></section>
    </div>
    <section className="release-panel panel"><div className="release-copy"><p className="eyebrow">默认直接发布</p><h2>全书已经准备好，试听不是必需步骤</h2><p>点击发布即可把当前版本放进孩子书架。之后如果发现文字、停顿或读音有问题，随时回来修改并更新。</p></div><div className="release-options"><div><span aria-hidden="true">✓</span><p><strong>全书 {chapters.length} 章已生成</strong><small>{chapters.reduce((sum, chapter) => sum + chapter.sentences.length, 0).toLocaleString()} 句正文、音频和字幕均已完成。</small></p></div><div><span aria-hidden="true">✎</span><p><strong>有问题再修改</strong><small>只重新处理修改过的内容，不影响其他章节。</small></p></div></div><div className="content-reminder"><span aria-hidden="true">!</span><p><strong>内容提示</strong><small>本书包含死亡、尸体、家庭冲突和未成年人心理等较强内容。发布即表示家长已了解并确认适龄性。</small></p></div><div className="voice-summary"><span className="voice-avatar" aria-hidden="true">声</span><p><strong>全书粤语音频已完成</strong><small>共约 {formatDuration(chapters.reduce((sum, chapter) => sum + chapterDuration(chapter), 0))}，可以任选章节试听。</small></p><button className="secondary" onClick={() => { const audio = new Audio(assetPath("books/white-paper/audio/intro.mp3")); void audio.play(); }}>可选试听引子</button></div><div className="release-actions"><p><span className="status ok">无需试听或逐章通过</span><small>发布后仍可修改，并把更新同步到孩子书架。</small></p><button className={published ? "secondary danger" : "secondary"} onClick={() => setPublished(false)} disabled={!published}>从书架撤下</button><button className="primary" disabled={published && !hasChanges} onClick={publishBook}>{publishLabel}</button></div></section>
  </main>;
}
