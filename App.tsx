
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Plus, MessageSquare, Trash2, Menu, Sparkles, LogOut, RefreshCcw, Settings, Globe, AlertCircle, Paperclip, X, Facebook, Instagram, Palette, Check, Code, Calculator, Copy, ChevronRight, Maximize2, Minimize2, FileText, Wrench, FileSearch, Image as ImageIcon, PenTool, LineChart, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { ChatSession, Message, UserProfile, Gender, ApiProvider, CanvasBlock, CanvasType } from './types';
import { streamChatResponse, checkApiHealth, getPoolStatus, adminResetPool, getLastNodeError, getActiveKey } from './services/aiService';
import { generateImage, getRemainingImageGenerations, getImageDailyLimit } from './services/imageService';
import { analyzeConversation, selfAssessResponse, deepReflection, loadUserContextFromFirebase, extractAndSaveKnowledge } from './services/userLearningService';
import { parseFile, detectFileType, getFileTypeLabel } from './services/fileParserService';
import { processAdminCommand } from './services/adminCommandService';
import { parseGraphBlock, render2DGraph, render3DGraph, GraphConfig } from './services/mathGraphService';
import * as db from './services/firebaseService';
import { useTheme } from './ThemeContext';
import { themes, themeNames, ThemeName } from './themes';

const App: React.FC = () => {
  const { currentTheme, theme, setTheme } = useTheme();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiStatusText, setApiStatusText] = useState<string>('Ready');
  const [connectionHealth, setConnectionHealth] = useState<'perfect' | 'error'>('perfect');
  const [poolInfo, setPoolInfo] = useState({ total: 0, active: 0, exhausted: 0 });
  const [lastErrorDiagnostic, setLastErrorDiagnostic] = useState<string>("None");
  
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 4>(1);
  const [tempAge, setTempAge] = useState<string>('');
  const [tempGender, setTempGender] = useState<Gender | null>(null);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [customProviderInput, setCustomProviderInput] = useState<ApiProvider>('chatgpt');
  
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<{ text: string, fileName: string, fileType: string } | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [feedbackMessages, setFeedbackMessages] = useState<any[]>([]);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [feedbackReplyTo, setFeedbackReplyTo] = useState<string | null>(null);
  const [feedbackReplyInput, setFeedbackReplyInput] = useState('');
  
  // Direct messaging state
  const [dmView, setDmView] = useState<'feedback' | 'conversations' | 'chat'>('feedback');
  const [dmConversations, setDmConversations] = useState<any[]>([]);
  const [dmChatMessages, setDmChatMessages] = useState<any[]>([]);
  const [dmChatWith, setDmChatWith] = useState('');
  const [dmInput, setDmInput] = useState('');
  const [dmNewEmail, setDmNewEmail] = useState('');
  const [dmError, setDmError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Canvas state (S-code / S-math / S-word / S-graph)
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>([]);
  const [canvasActiveIndex, setCanvasActiveIndex] = useState(0);
  const [canvasFullscreen, setCanvasFullscreen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // S-word editing state
  const [wordEditMode, setWordEditMode] = useState(false);
  const [wordEditContent, setWordEditContent] = useState('');

  // S-graph interactive state
  const [graphZoom, setGraphZoom] = useState(1);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [graphRotation, setGraphRotation] = useState({ angleX: 0.6, angleY: 0.8 });
  const [graphDragging, setGraphDragging] = useState(false);
  const [graphDragStart, setGraphDragStart] = useState({ x: 0, y: 0 });
  const graphCanvasRef = useRef<HTMLCanvasElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userProfile ? db.isAdmin(userProfile.email) : false;
  const isUserDebi = userProfile ? db.isDebi(userProfile.email) : false;

  const c = theme.colors;

  /**
   * Parses AI response text to extract code blocks and math blocks.
   * Returns the cleaned text (without code/math) and extracted CanvasBlocks.
   */
  const parseCanvasBlocks = (text: string): { cleanText: string; blocks: CanvasBlock[] } => {
    const blocks: CanvasBlock[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    let cleanText = text;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const lang = (match[1] || '').toLowerCase().trim();
      const content = match[2].trim();
      if (!content) continue;

      if (lang === 'math') {
        blocks.push({
          type: 'math',
          content,
          title: 'S-math: Solution',
        });
      } else if (lang === 'explain') {
        blocks.push({
          type: 'explain',
          content,
          title: 'S-explain: Analysis',
        });
      } else if (lang === 'word') {
        blocks.push({
          type: 'word',
          content,
          title: 'S-word: Document',
        });
      } else if (lang === 'graph') {
        blocks.push({
          type: 'graph',
          content,
          title: 'S-graph: Visualization',
        });
      } else {
        const langLabel = lang || 'code';
        blocks.push({
          type: 'code',
          content,
          language: lang || undefined,
          title: `S-code: ${langLabel.charAt(0).toUpperCase() + langLabel.slice(1)}`,
        });
      }
    }

    // Remove the code blocks from the display text, leaving only explanation text
    if (blocks.length > 0) {
      cleanText = text.replace(codeBlockRegex, '').trim();
      // If only whitespace/empty remains after removal, provide a default message
      if (!cleanText) {
        cleanText = blocks[0].type === 'code' 
          ? 'Here is the code:' 
          : 'Here is the solution:';
      }
    }

    return { cleanText, blocks };
  };

  /** Opens the canvas panel with the given blocks */
  const openCanvas = (blocks: CanvasBlock[]) => {
    setCanvasBlocks(blocks);
    setCanvasActiveIndex(0);
    setCanvasOpen(true);
  };

  // Graph rendering effect
  useEffect(() => {
    if (!canvasOpen || !canvasBlocks[canvasActiveIndex] || canvasBlocks[canvasActiveIndex].type !== 'graph') return;
    const canvas = graphCanvasRef.current;
    if (!canvas) return;

    // Set canvas size to match container
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth * (window.devicePixelRatio || 1);
      canvas.height = container.clientHeight * (window.devicePixelRatio || 1);
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }

    const graphConfig = parseGraphBlock(canvasBlocks[canvasActiveIndex].content);
    const graphColors = {
      bg: c.bgPrimary,
      grid: c.textMuted,
      axis: c.textSecondary,
      text: c.textPrimary,
    };

    if (graphConfig.is3D) {
      render3DGraph(canvas, graphConfig, graphColors, graphRotation, graphZoom);
    } else {
      render2DGraph(canvas, graphConfig, graphColors, graphPan, graphZoom);
    }
  }, [canvasOpen, canvasActiveIndex, canvasBlocks, graphZoom, graphPan, graphRotation, c]);

  /** Copy canvas content to clipboard */
  const copyCanvasContent = (index: number) => {
    const block = canvasBlocks[index];
    if (block) {
      navigator.clipboard.writeText(block.content).then(() => {
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
      });
    }
  };

  /** Render markdown-formatted text for chat bubbles */
  const renderMarkdown = (text: string, isUser: boolean): React.ReactNode => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    
    const formatInline = (line: string, key: string): React.ReactNode => {
      // Process inline formatting: bold, italic, inline code, LaTeX-style math
      const parts: React.ReactNode[] = [];
      // Regex for: ***bold italic***, **bold**, *italic*, `code`, \(...\) math
      const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\\\((.+?)\\\)|\\\[(.+?)\\\])/g;
      let lastIndex = 0;
      let match;
      let idx = 0;
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index));
        if (match[2]) parts.push(<strong key={`${key}-${idx}`}><em>{match[2]}</em></strong>);
        else if (match[3]) parts.push(<strong key={`${key}-${idx}`}>{match[3]}</strong>);
        else if (match[4]) parts.push(<em key={`${key}-${idx}`}>{match[4]}</em>);
        else if (match[5]) parts.push(<code key={`${key}-${idx}`} className="px-1.5 py-0.5 rounded text-sm" style={{ backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : c.bgTertiary, color: isUser ? '#fff' : c.accent }}>{match[5]}</code>);
        else if (match[6]) parts.push(<span key={`${key}-${idx}`} className="font-mono font-bold px-1" style={{ color: isUser ? '#fff' : c.accent }}>{match[6]}</span>);
        else if (match[7]) parts.push(<div key={`${key}-${idx}`} className="font-mono font-bold py-1 text-center" style={{ color: isUser ? '#fff' : c.accent }}>{match[7]}</div>);
        lastIndex = match.index + match[0].length;
        idx++;
      }
      if (lastIndex < line.length) parts.push(line.slice(lastIndex));
      return parts.length > 0 ? parts : line;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty lines -> spacing
      if (!trimmed) {
        elements.push(<div key={i} className="h-2" />);
        continue;
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        elements.push(<div key={i} className="font-bold text-base mt-3 mb-1" style={{ color: isUser ? '#fff' : c.accent }}>{formatInline(trimmed.slice(4), `h3-${i}`)}</div>);
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(<div key={i} className="font-black text-base mt-4 mb-1" style={{ color: isUser ? '#fff' : c.accent }}>{formatInline(trimmed.slice(3), `h2-${i}`)}</div>);
        continue;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(<div key={i} className="font-black text-lg mt-4 mb-2" style={{ color: isUser ? '#fff' : c.accent }}>{formatInline(trimmed.slice(2), `h1-${i}`)}</div>);
        continue;
      }

      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={i} className="flex gap-2 pl-2 my-0.5">
            <span className="mt-2 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: isUser ? 'rgba(255,255,255,0.6)' : c.accent }} />
            <span>{formatInline(trimmed.slice(2), `li-${i}`)}</span>
          </div>
        );
        continue;
      }

      // Numbered list
      const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.+)/);
      if (numMatch) {
        elements.push(
          <div key={i} className="flex gap-2 pl-2 my-0.5">
            <span className="font-bold shrink-0" style={{ color: isUser ? 'rgba(255,255,255,0.7)' : c.accent }}>{numMatch[1]}.</span>
            <span>{formatInline(numMatch[2], `num-${i}`)}</span>
          </div>
        );
        continue;
      }

      // Separator
      if (/^[-=_]{3,}$/.test(trimmed)) {
        elements.push(<hr key={i} className="my-3 opacity-30" />);
        continue;
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        elements.push(
          <div key={i} className="border-l-2 pl-3 my-1 italic opacity-80" style={{ borderColor: isUser ? 'rgba(255,255,255,0.4)' : c.accent }}>
            {formatInline(trimmed.slice(2), `bq-${i}`)}
          </div>
        );
        continue;
      }

      // Regular paragraph
      elements.push(<div key={i} className="my-0.5">{formatInline(trimmed, `p-${i}`)}</div>);
    }

    return elements;
  };

  /** Language display name mapping */
  const langDisplayName = (lang?: string): string => {
    if (!lang) return 'Code';
    const map: Record<string, string> = {
      python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript',
      java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go',
      rust: 'Rust', ruby: 'Ruby', php: 'PHP', swift: 'Swift',
      kotlin: 'Kotlin', html: 'HTML', css: 'CSS', sql: 'SQL',
      bash: 'Bash', shell: 'Shell', json: 'JSON', xml: 'XML',
      yaml: 'YAML', dart: 'Dart', r: 'R', matlab: 'MATLAB',
      scala: 'Scala', perl: 'Perl', lua: 'Lua', haskell: 'Haskell',
    };
    return map[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, isLoading]);

  useEffect(() => {
    const bootApp = async () => {
      const localProfileStr = localStorage.getItem('utsho_profile');
      if (localProfileStr) {
        const localProfile = JSON.parse(localProfileStr) as UserProfile;
        setUserProfile(localProfile);
        setCustomKeyInput(localProfile.customApiKey || '');
        setCustomProviderInput(localProfile.customApiProvider || 'chatgpt');
        
        if (!localProfile.age || !localProfile.gender || localProfile.age === 0) {
          setOnboardingStep(2);
        } else {
          setOnboardingStep(4);
        }
        
        if (db.isDatabaseEnabled()) {
          try {
            const cloudProfile = await db.getUserProfile(localProfile.email);
            if (cloudProfile) {
              setUserProfile(cloudProfile);
              setCustomKeyInput(cloudProfile.customApiKey || '');
              localStorage.setItem('utsho_profile', JSON.stringify(cloudProfile));
            }
            const cloudSessions = await db.getSessions(localProfile.email);
            setSessions(cloudSessions);
            if (cloudSessions.length > 0) setActiveSessionId(cloudSessions[0].id);
          } catch (e) {
            console.error("Cloud boot error:", e);
          }
        }
        // Load learned user context from Firebase (merges with localStorage)
        loadUserContextFromFirebase(localProfile.email).catch(console.error);
        await performHealthCheck(localProfile);
      }
    };
    bootApp();
    const interval = setInterval(() => {
      setPoolInfo(getPoolStatus());
      const err = getLastNodeError();
      if (err !== "None") {
        setLastErrorDiagnostic(err.length > 80 ? err.substring(0, 80) + "..." : err);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleGoogleLogin = async () => {
    const googleUser = await db.loginWithGoogle();
    if (googleUser) {
      const cloud = await db.getUserProfile(googleUser.email);
      if (cloud && cloud.age > 0) {
        setUserProfile(cloud);
        setCustomKeyInput(cloud.customApiKey || '');
        localStorage.setItem('utsho_profile', JSON.stringify(cloud));
        setOnboardingStep(4);
        const s = await db.getSessions(googleUser.email);
        setSessions(s);
        if (s.length > 0) setActiveSessionId(s[0].id); else createNewSession(googleUser.email);
        // Load learned context from Firebase on login
        loadUserContextFromFirebase(googleUser.email).catch(console.error);
      } else {
        setUserProfile(googleUser);
        setOnboardingStep(2);
      }
    }
  };

  const finalizePersonalization = async () => {
    if (!userProfile || !tempGender || !tempAge) return;
    const final: UserProfile = { ...userProfile, age: parseInt(tempAge) || 20, gender: tempGender };
    setUserProfile(final);
    localStorage.setItem('utsho_profile', JSON.stringify(final));
    if (db.isDatabaseEnabled()) await db.saveUserProfile(final);
    setOnboardingStep(4);
    if (sessions.length === 0) createNewSession(final.email);
    await performHealthCheck(final);
  };

  const performHealthCheck = async (profile?: UserProfile) => {
    setApiStatusText('Verifying...');
    const { healthy, error } = await checkApiHealth(profile || userProfile || undefined);
    setConnectionHealth(healthy ? 'perfect' : 'error');
    setApiStatusText(healthy ? 'Synced' : 'Node Issue');
    setPoolInfo(getPoolStatus());
    if (error && error !== "ping") setLastErrorDiagnostic(error.substring(0, 80));
  };

  const handleResetPool = () => {
    adminResetPool();
    performHealthCheck();
  };

  const handleUpgrade = async () => {
    if ('serviceWorker' in navigator) {
      setApiStatusText("Checking for updates...");
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          } else {
            setApiStatusText("Already up to date");
            setTimeout(() => setApiStatusText("Synced"), 2000);
          }
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error("Upgrade error:", err);
        setApiStatusText("Update failed");
      }
    } else {
      window.location.reload();
    }
  };

  const saveSettings = async () => {
    if (!userProfile) return;
    const updated = { ...userProfile, customApiKey: customKeyInput.trim(), customApiProvider: customProviderInput };
    setUserProfile(updated);
    localStorage.setItem('utsho_profile', JSON.stringify(updated));
    if (db.isDatabaseEnabled()) await db.saveUserProfile(updated);
    setIsSettingsOpen(false);
    await performHealthCheck(updated);
  };

  const createNewSession = (emailOverride?: string) => {
    const sid = crypto.randomUUID();
    const newSession = { id: sid, title: 'New Chat', messages: [], createdAt: new Date() };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(sid);
    if (db.isDatabaseEnabled()) db.saveSession(emailOverride || userProfile!.email, newSession).catch(console.error);
  };

  const handleSendMessage = async () => {
    if (!userProfile) return;
    
    if ((!inputText.trim() && !selectedImage && !selectedDocument) || isLoading || !activeSessionId) return;
    
    // Build message content: if a document is attached, prepend its content
    let messageContent = inputText;
    if (selectedDocument) {
      const docPrefix = `[Attached file: ${selectedDocument.fileName}]\n\n${selectedDocument.text}\n\n`;
      messageContent = inputText.trim() 
        ? `${docPrefix}User's question: ${inputText}` 
        : `${docPrefix}Please analyze this document.`;
    }
    
    const userMsg: Message = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      content: messageContent, 
      timestamp: new Date(),
      imagePart: selectedImage || undefined,
      imageUrl: imagePreview || undefined,
      documentName: selectedDocument?.fileName || undefined
    };
    
    const currentSession = sessions.find(s => s.id === activeSessionId)!;
    const history = [...currentSession.messages, userMsg];
    const isFirstMessage = currentSession.messages.length === 0;
    const titleHint = selectedDocument ? selectedDocument.fileName : (userMsg.content.slice(0, 30) || "Image Analysis");
    const newTitle = isFirstMessage ? titleHint : currentSession.title;
    
    setInputText('');
    setSelectedImage(null);
    setImagePreview(null);
    setSelectedDocument(null);
    setIsLoading(true);
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: history, title: newTitle } : s));

    if (db.isDatabaseEnabled()) {
      db.updateSessionMessages(userProfile.email, activeSessionId, history, newTitle).catch(console.error);
    }

    // Check for commands (admin commands + user commands like /feedback)
    if (inputText.trim().startsWith('/')) {
      const cmdResult = await processAdminCommand(inputText.trim(), isAdmin, userProfile.email, userProfile.name);
      if (cmdResult.handled) {
        const systemMsg: Message = { id: crypto.randomUUID(), role: 'model', content: cmdResult.response, timestamp: new Date() };
        const updatedMessages = [...history, systemMsg];
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updatedMessages } : s));
        if (db.isDatabaseEnabled()) db.updateSessionMessages(userProfile.email, activeSessionId, updatedMessages).catch(console.error);
        setIsLoading(false);
        return;
      }
    }

    // Check for image generation request
    const lowerInput = inputText.toLowerCase();
    // Words that indicate this is NOT an image request (code/text generation)
    const notImageWords = /\b(code|function|program|script|algorithm|class|variable|array|loop|api|html|css|bug|error|fix|debug|compile|syntax|database|sql|json|server|endpoint)\b/;
    const isNotImage = notImageWords.test(lowerInput);
    // Simple triggers: /command, "generate X", "draw X", "create X", etc.
    const imageCommandPattern = /^\/(draw|image|imagine|paint|generate)\b/;
    // Any message starting with a creative verb (most intuitive)
    const imageStartPattern = /^\s*(generate|create|draw|paint|make|imagine|render|sketch|design)\s+(a |an |the |me |my )?\s*\w/i;
    // Messages mentioning image/picture/photo with any context
    const imageWordPattern = /\b(image|picture|photo|illustration|drawing|painting|wallpaper|portrait|artwork|pic)\b/;
    // Bangla triggers
    const imageBanglaPattern = /ছবি|আঁকো|তৈরি করো|বানাও|জেনারেট/;
    const isImageRequest = !isNotImage && (
      imageCommandPattern.test(lowerInput) ||
      imageStartPattern.test(lowerInput) ||
      imageWordPattern.test(lowerInput) ||
      imageBanglaPattern.test(lowerInput)
    );

    if (isImageRequest) {
      // Check rate limit before attempting generation
      const remaining = getRemainingImageGenerations(userProfile.email);
      if (remaining <= 0) {
        setIsLoading(false);
        const limitMsg: Message = {
          id: crypto.randomUUID(),
          role: 'model',
          content: `You've reached your daily image generation limit (${getImageDailyLimit()} images per day). Your limit will reset tomorrow. Try again then!`,
          timestamp: new Date()
        };
        const updatedMessages = [...history, limitMsg];
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updatedMessages } : s));
        if (db.isDatabaseEnabled()) db.updateSessionMessages(userProfile.email, activeSessionId, updatedMessages, newTitle).catch(console.error);
        setApiStatusText("Daily Limit Reached");
        return;
      }

      setApiStatusText(`Generating image... (${remaining - 1} left today)`);
      
      const imagePrompt = inputText
        // Strip slash commands
        .replace(/^\/(draw|image|imagine|paint|generate)\s*/i, '')
        // Strip "generate/create/draw a image/picture of" patterns
        .replace(/^(generate|create|draw|paint|make|produce|render|design|imagine|sketch)\s+(a |an |the |me |my )?\s*(image|picture|photo|illustration|art|artwork|painting|drawing|pic|portrait|wallpaper|poster|scene|landscape|graphic)\s*(of|for|with|showing|depicting)?\s*/i, '')
        // Strip standalone verb starts like "Generate the beautiful Moon" -> "the beautiful Moon"
        .replace(/^(generate|create|draw|paint|make|imagine|render|sketch|design)\s+(a |an |the |me |my )?\s*/i, '')
        // Strip image/picture word when it appears as subject: "a picture of sunset" -> "sunset"
        .replace(/^(a |an |the )?(image|picture|photo|illustration|drawing|painting|pic|portrait|artwork)\s*(of|for|with|showing|depicting)?\s*/i, '')
        // Strip Bangla triggers
        .replace(/(ছবি আঁকো|ছবি তৈরি করো|একটি ছবি|ছবি বানাও|ছবি দাও|ছবি জেনারেট|ছবি)\s*/gi, '')
        .trim() || "A beautiful landscape";
      const imageUrl = await generateImage(imagePrompt, userProfile.email);

      if (imageUrl) {
        setIsLoading(false);
        const newRemaining = getRemainingImageGenerations(userProfile.email);
        const imageMsg: Message = { 
          id: crypto.randomUUID(), 
          role: 'model', 
          content: `Here is your generated image for: "${imagePrompt}"\n(${newRemaining}/${getImageDailyLimit()} generations remaining today)`, 
          timestamp: new Date(),
          imageUrl: imageUrl
        };
        const updatedMessages = [...history, imageMsg];
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updatedMessages } : s));
        if (db.isDatabaseEnabled()) db.updateSessionMessages(userProfile.email, activeSessionId, updatedMessages, newTitle).catch(console.error);
        setApiStatusText("Image Generated");
        return;
      } else {
        setIsLoading(false);
        const errorMsg: Message = { 
          id: crypto.randomUUID(), 
          role: 'model', 
          content: "Sorry, I couldn't generate that image right now. Please try again later.", 
          timestamp: new Date() 
        };
        const updatedMessages = [...history, errorMsg];
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updatedMessages } : s));
        setApiStatusText("Error Generating Image");
        return;
      }
    }

    await streamChatResponse(
      history,
      userProfile,
      (chunk) => {},
      (fullText, sources, imageUrl) => {
        setIsLoading(false);
        const parts = fullText.split('[SPLIT]').map(p => p.trim()).filter(p => p.length > 0);
        let allCanvasBlocks: CanvasBlock[] = [];
        const newMessages: Message[] = parts.map((p, i) => {
          const { cleanText, blocks } = parseCanvasBlocks(p);
          if (blocks.length > 0) allCanvasBlocks = [...allCanvasBlocks, ...blocks];
          return {
            id: crypto.randomUUID(),
            role: 'model' as const,
            content: cleanText,
            timestamp: new Date(),
            sources: i === parts.length - 1 ? sources : undefined,
            imageUrl: i === 0 ? imageUrl : undefined,
            canvasBlocks: blocks.length > 0 ? blocks : undefined,
          };
        });
        // Auto-open canvas if code/math blocks were found
        if (allCanvasBlocks.length > 0) {
          openCanvas(allCanvasBlocks);
        }
        
        const updatedMessages = [...history, ...newMessages];
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updatedMessages } : s));
        if (db.isDatabaseEnabled()) db.updateSessionMessages(userProfile.email, activeSessionId, updatedMessages, newTitle).catch(console.error);
        setPoolInfo(getPoolStatus());
        setApiStatusText("Synced");

        // Background: self-training pipeline
        const learningKey = getActiveKey(userProfile);
        if (learningKey) {
          // 1. Analyze conversation to learn about the user
          analyzeConversation(updatedMessages, userProfile, learningKey).catch(() => {});
          // 2. Self-assess response quality and generate improvement notes
          selfAssessResponse(updatedMessages, userProfile, learningKey).catch(() => {});
          // 3. Periodic deep reflection to synthesize all learnings
          deepReflection(userProfile, learningKey).catch(() => {});
          // 4. Extract useful knowledge from conversations to global knowledge base
          extractAndSaveKnowledge(updatedMessages, userProfile, learningKey).catch(() => {});
        }
      },
      (err) => {
        setIsLoading(false);
        const errMsg = err.message || "Connection Error";
        setLastErrorDiagnostic(errMsg);
        const errorMsg: Message = { id: crypto.randomUUID(), role: 'model', content: `Failure: ${errMsg}`, timestamp: new Date() };
        const finalMessages = [...history, errorMsg];
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: finalMessages } : s));
        if (db.isDatabaseEnabled()) db.updateSessionMessages(userProfile.email, activeSessionId, finalMessages, newTitle).catch(console.error);
        setApiStatusText("Pool Error");
      },
      (status) => setApiStatusText(status)
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileType = detectFileType(file);
    
    if (fileType === 'image') {
      // Handle images as before (for vision model)
      const reader = new FileReader();
      reader.onloadend = () => {
        const originalBase64 = reader.result as string;
        const dataOnly = originalBase64.split(',')[1];
        setSelectedImage({ data: dataOnly, mimeType: file.type || 'image/jpeg' });
        setImagePreview(originalBase64);
        setSelectedDocument(null);
      };
      reader.readAsDataURL(file);
    } else {
      // Handle documents (PDF, DOCX, TXT, etc.)
      try {
        setApiStatusText("Parsing file...");
        const parsed = await parseFile(file);
        setSelectedDocument({ text: parsed.text, fileName: parsed.fileName, fileType: getFileTypeLabel(parsed.fileType) });
        setSelectedImage(null);
        setImagePreview(null);
        setApiStatusText("File ready");
      } catch (err) {
        console.error("FILE_PARSE_ERROR:", err);
        alert("Failed to parse this file. Please try a different file.");
        setApiStatusText("Parse error");
      }
    }
    
    // Reset file input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to send DM and handle @utsho mentions
  const sendDmMessage = async (text: string) => {
    if (!text.trim() || !userProfile || !dmChatWith) return;
    
    // Send the user's message
    await db.sendDirectMessage(userProfile.email, userProfile.name, dmChatWith, text.trim());
    const userMsg = { id: `msg_${Date.now()}`, from: userProfile.email.toLowerCase(), fromName: userProfile.name, to: dmChatWith, message: text.trim(), createdAt: new Date(), read: false };
    setDmChatMessages((prev: any) => [...prev, userMsg]);
    setDmInput('');
    
    // Check for @utsho mention
    if (/@utsho/i.test(text)) {
      const question = text.replace(/@utsho/gi, '').trim() || 'hi';
      const apiKey = getActiveKey(userProfile);
      if (apiKey) {
        try {
          // Get AI response
          const { streamChatResponse: _ , ...rest } = await import('./services/aiService');
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1', dangerouslyAllowBrowser: true });
          const response = await client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are Utsho, a helpful AI assistant. Someone mentioned you in a direct message conversation. Give a brief, helpful response. Keep it short and conversational.' },
              { role: 'user', content: question }
            ],
            max_tokens: 300,
            temperature: 0.8,
          });
          const aiReply = response.choices[0]?.message?.content || "Hey! How can I help?";
          
          // Send AI response as a message from "utsho-ai"
          await db.sendDirectMessage('utsho-ai@utsho.ai', 'Utsho AI', dmChatWith, aiReply);
          await db.sendDirectMessage('utsho-ai@utsho.ai', 'Utsho AI', userProfile.email, aiReply);
          setDmChatMessages((prev: any) => [...prev, { id: `msg_${Date.now()}_ai`, from: 'utsho-ai@utsho.ai', fromName: 'Utsho AI', to: dmChatWith, message: aiReply, createdAt: new Date(), read: false }]);
        } catch (err) {
          console.error("DM @utsho error:", err);
        }
      }
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // --- Theme Picker Component ---
  const ThemePicker: React.FC = () => (
    <div className="space-y-3">
      <label className="text-xs font-bold uppercase tracking-widest pl-1" style={{ color: c.textMuted }}>
        <Palette size={12} className="inline mr-1.5" style={{ color: c.accent }} />
        THEME
      </label>
      <div className="grid grid-cols-3 gap-2">
        {themeNames.map((name) => {
          const t = themes[name];
          const isActive = currentTheme === name;
          return (
            <button
              key={name}
              onClick={() => setTheme(name)}
              className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-bold text-xs transition-all"
              style={{
                backgroundColor: isActive ? c.accentSubtle : c.bgTertiary,
                borderColor: isActive ? c.accent : c.borderPrimary,
                color: isActive ? c.accent : c.textSecondary,
              }}
            >
              {isActive && (
                <div className="absolute top-1 right-1">
                  <Check size={10} style={{ color: c.accent }} />
                </div>
              )}
              <div
                className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                style={{
                  backgroundColor: t.colors.bgPrimary,
                  borderColor: t.colors.accent,
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: t.colors.accent }}
                />
              </div>
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (onboardingStep === 1) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: c.bgPrimary }}>
      <div className="w-full max-w-md border rounded-[3rem] p-12 shadow-2xl space-y-8 text-center animate-in fade-in duration-500" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}>
        <div className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-white floating-ai shadow-lg" style={{ backgroundColor: c.accent, boxShadow: `0 10px 30px ${c.accentShadow}` }}><Sparkles size={40} /></div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tighter" style={{ color: c.textPrimary }}>UTSHO AI</h1>
          <p className="text-sm font-medium" style={{ color: c.textMuted }}>Your Personal AI Assistant</p>
        </div>
        <button onClick={handleGoogleLogin} className="w-full font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all" style={{ backgroundColor: c.buttonPrimary, color: c.buttonPrimaryText }}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="" /> Sign in with Google
        </button>
      </div>
    </div>
  );

  if (onboardingStep === 2) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: c.bgPrimary }}>
      <div className="w-full max-w-md border rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in fade-in zoom-in duration-300" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black" style={{ color: c.textPrimary }}>Personalize Utsho</h2>
          <p className="text-sm" style={{ color: c.textMuted }}>Tell me about yourself for better service.</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest pl-1" style={{ color: c.textMuted }}>Gender</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTempGender('male')} className="py-4 rounded-2xl border-2 font-bold transition-all" style={{ backgroundColor: tempGender === 'male' ? c.accent : c.bgTertiary, borderColor: tempGender === 'male' ? c.accent : c.borderPrimary, color: tempGender === 'male' ? '#fff' : c.textSecondary }}>Male</button>
              <button onClick={() => setTempGender('female')} className="py-4 rounded-2xl border-2 font-bold transition-all" style={{ backgroundColor: tempGender === 'female' ? '#db2777' : c.bgTertiary, borderColor: tempGender === 'female' ? '#ec4899' : c.borderPrimary, color: tempGender === 'female' ? '#fff' : c.textSecondary }}>Female</button>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest pl-1" style={{ color: c.textMuted }}>Age</label>
            <input type="number" value={tempAge} onChange={e => setTempAge(e.target.value)} placeholder="e.g. 24" className="w-full border p-4 rounded-2xl outline-none font-bold" style={{ backgroundColor: c.bgInput, borderColor: c.borderPrimary, color: c.textPrimary }} />
          </div>
          <button onClick={finalizePersonalization} disabled={!tempGender || !tempAge} className="w-full font-bold py-4 rounded-2xl active:scale-95 transition-all" style={{ backgroundColor: (!tempGender || !tempAge) ? c.bgTertiary : c.buttonPrimary, color: (!tempGender || !tempAge) ? c.textMuted : c.buttonPrimaryText, cursor: (!tempGender || !tempAge) ? 'not-allowed' : 'pointer' }}>Save & Continue</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen font-['Hind_Siliguri',_sans-serif]" style={{ backgroundColor: c.bgPrimary, color: c.textPrimary }}>
      {isToolsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
          <div className="border rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-6" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-widest" style={{ color: c.accent }}>AI Tools</h3>
              <button onClick={() => setIsToolsOpen(false)} style={{ color: c.textMuted }}><X size={20} /></button>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => { setIsToolsOpen(false); setInputText('Write code for: '); }}
                className="w-full flex gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left"
                style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}
              >
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 shrink-0"><Code size={24} /></div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: c.textPrimary }}>S-code</h4>
                  <p className="text-xs" style={{ color: c.textMuted }}>Generate, debug, and explain code in any language with a dedicated canvas.</p>
                </div>
              </button>

              <button 
                onClick={() => { setIsToolsOpen(false); setInputText('Write a document about: '); }}
                className="w-full flex gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left"
                style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}
              >
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0"><PenTool size={24} /></div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: c.textPrimary }}>S-word</h4>
                  <p className="text-xs" style={{ color: c.textMuted }}>Write essays, stories, articles, letters & documents in a rich canvas editor. Edit inline.</p>
                </div>
              </button>

              <button 
                onClick={() => { setIsToolsOpen(false); setInputText('Solve this math problem: '); }}
                className="w-full flex gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left"
                style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}
              >
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 shrink-0"><Calculator size={24} /></div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: c.textPrimary }}>S-math</h4>
                  <p className="text-xs" style={{ color: c.textMuted }}>Solve complex equations with step-by-step visual solutions.</p>
                </div>
              </button>

              <button 
                onClick={() => { setIsToolsOpen(false); setInputText('Plot a graph of: '); }}
                className="w-full flex gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left"
                style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}
              >
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 shrink-0"><LineChart size={24} /></div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: c.textPrimary }}>S-graph</h4>
                  <p className="text-xs" style={{ color: c.textMuted }}>Interactive 2D & 3D math graphing like Desmos. Plot functions, equations & surfaces.</p>
                </div>
              </button>

              <button 
                onClick={() => { setIsToolsOpen(false); setInputText('Analyze this in detail: '); }}
                className="w-full flex gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left"
                style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}
              >
                <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-500 shrink-0"><FileSearch size={24} /></div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: c.textPrimary }}>S-explain</h4>
                  <p className="text-xs" style={{ color: c.textMuted }}>Deep analysis of documents (PDF, DOCX) and images in a professional report format.</p>
                </div>
              </button>

              <button 
                onClick={() => { setIsToolsOpen(false); setInputText('Generate an image of: '); }}
                className="w-full flex gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-left"
                style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}
              >
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500 shrink-0"><ImageIcon size={24} /></div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: c.textPrimary }}>Image Gen</h4>
                  <p className="text-xs" style={{ color: c.textMuted }}>Create high-quality images from text prompts using advanced models.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
           <div className="border p-8 rounded-3xl w-full max-w-md space-y-6 shadow-2xl" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}>
              <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: c.accent }}><Settings size={20} /> Settings</h3>
              
              <ThemePicker />

              <div className="space-y-2">
                 <label className="text-xs font-bold" style={{ color: c.textMuted }}>AI PROVIDER (FOR CUSTOM KEY)</label>
                 <div className="grid grid-cols-2 gap-2">
                   {([
                     { id: 'chatgpt' as ApiProvider, label: 'ChatGPT' },
                     { id: 'gemini' as ApiProvider, label: 'Gemini' },
                     { id: 'deepseek' as ApiProvider, label: 'DeepSeek' },
                     { id: 'grok' as ApiProvider, label: 'Grok' },
                   ]).map(p => (
                     <button
                       key={p.id}
                       onClick={() => setCustomProviderInput(p.id)}
                       className="py-2.5 rounded-xl border-2 font-bold text-xs transition-all"
                       style={{
                         backgroundColor: customProviderInput === p.id ? c.accentSubtle : c.bgTertiary,
                         borderColor: customProviderInput === p.id ? c.accent : c.borderPrimary,
                         color: customProviderInput === p.id ? c.accent : c.textSecondary,
                       }}
                     >
                       {customProviderInput === p.id && <Check size={10} className="inline mr-1" />}
                       {p.label}
                     </button>
                   ))}
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-bold" style={{ color: c.textMuted }}>YOUR PERSONAL API KEY (OPTIONAL)</label>
                 <input type="password" value={customKeyInput} onChange={e => setCustomKeyInput(e.target.value)} placeholder="Paste your API key here..." className="w-full border p-4 rounded-xl outline-none text-sm" style={{ backgroundColor: c.bgInput, borderColor: c.borderPrimary, color: c.textPrimary }} />
                 <p className="text-[10px] italic" style={{ color: c.textMuted }}>If left blank, Utsho will use the shared community pool.</p>
              </div>
              <div className="flex gap-3">
                 <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 font-bold border rounded-xl transition-colors" style={{ borderColor: c.borderPrimary, color: c.textSecondary, backgroundColor: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.bgTertiary)} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>Cancel</button>
                 <button onClick={saveSettings} className="flex-1 py-3 font-bold rounded-xl transition-colors" style={{ backgroundColor: c.accent, color: '#fff', boxShadow: `0 4px 14px ${c.accentShadow}` }}>Save</button>
              </div>
           </div>
        </div>
      )}

      {isFeedbackOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
          <div className="border rounded-3xl w-full max-w-lg shadow-2xl flex flex-col" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary, maxHeight: '85vh' }}>
            {/* Header with tabs */}
            <div className="border-b" style={{ borderColor: c.borderPrimary }}>
              <div className="flex items-center justify-between p-4 pb-0">
                <h3 className="text-lg font-bold" style={{ color: c.accent }}>Messages</h3>
                <button onClick={() => { setIsFeedbackOpen(false); setFeedbackReplyTo(null); setDmView('feedback'); }} className="p-1 transition-colors hover:text-red-400" style={{ color: c.textMuted }}><X size={20} /></button>
              </div>
              <div className="flex gap-1 px-4 pt-3">
                <button onClick={() => setDmView('feedback')} className="px-4 py-2 text-xs font-bold rounded-t-xl transition-colors" style={{ backgroundColor: dmView === 'feedback' ? c.bgTertiary : 'transparent', color: dmView === 'feedback' ? c.accent : c.textMuted }}>{isAdmin ? 'Inbox' : 'Admin'}</button>
                <button onClick={async () => { setDmView('conversations'); if (db.isDatabaseEnabled()) { const convs = await db.getUserConversations(userProfile!.email); setDmConversations(convs); } }} className="px-4 py-2 text-xs font-bold rounded-t-xl transition-colors" style={{ backgroundColor: dmView === 'conversations' || dmView === 'chat' ? c.bgTertiary : 'transparent', color: dmView === 'conversations' || dmView === 'chat' ? c.accent : c.textMuted }}>Direct Messages</button>
              </div>
            </div>

            {/* FEEDBACK TAB */}
            {dmView === 'feedback' && (<>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '200px' }}>
                {feedbackMessages.length === 0 ? (
                  <div className="text-center py-8" style={{ color: c.textMuted }}>
                    <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{isAdmin ? 'No feedback yet.' : 'Send a message to the admin!'}</p>
                  </div>
                ) : feedbackMessages.map((msg: any) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        {isAdmin && <div className="text-[10px] font-bold mb-1" style={{ color: c.textMuted }}>{msg.fromName} {!msg.read && <span style={{ color: '#ef4444' }}>NEW</span>}</div>}
                        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm" style={{ backgroundColor: c.bgTertiary, color: c.textPrimary }}>{msg.message}</div>
                      </div>
                    </div>
                    {msg.reply && <div className="flex justify-end"><div className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white" style={{ backgroundColor: c.accent }}>{msg.reply}</div></div>}
                    {isAdmin && !msg.reply && <button onClick={() => { setFeedbackReplyTo(msg.id); setFeedbackReplyInput(''); }} className="text-[10px] font-bold ml-2" style={{ color: c.accent }}>Reply</button>}
                    {isAdmin && feedbackReplyTo === msg.id && (
                      <div className="flex gap-2 ml-4">
                        <input value={feedbackReplyInput} onChange={e => setFeedbackReplyInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && feedbackReplyInput.trim()) { db.replyToFeedback(msg.id, feedbackReplyInput.trim()); setFeedbackMessages(feedbackMessages.map((m: any) => m.id === msg.id ? { ...m, reply: feedbackReplyInput.trim(), read: true } : m)); setFeedbackReplyTo(null); }}} placeholder="Reply..." className="flex-1 px-3 py-2 rounded-xl text-sm outline-none border" style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary, color: c.textPrimary }} autoFocus />
                        <button onClick={() => { if (feedbackReplyInput.trim()) { db.replyToFeedback(msg.id, feedbackReplyInput.trim()); setFeedbackMessages(feedbackMessages.map((m: any) => m.id === msg.id ? { ...m, reply: feedbackReplyInput.trim(), read: true } : m)); setFeedbackReplyTo(null); }}} className="p-2 rounded-xl text-white" style={{ backgroundColor: c.accent }}><Send size={14} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!isAdmin && (
                <div className="p-4 border-t flex gap-2" style={{ borderColor: c.borderPrimary }}>
                  <input value={feedbackInput} onChange={e => setFeedbackInput(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter' && feedbackInput.trim()) { const id = `fb_${Date.now()}`; const newMsg = { id, fromEmail: userProfile!.email.toLowerCase(), fromName: userProfile!.name, message: feedbackInput.trim(), createdAt: new Date(), read: false }; await db.saveFeedback(newMsg); setFeedbackMessages((prev: any) => [...prev, newMsg]); setFeedbackInput(''); }}} placeholder="Message admin..." className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none border" style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary, color: c.textPrimary }} />
                  <button onClick={async () => { if (feedbackInput.trim()) { const id = `fb_${Date.now()}`; const newMsg = { id, fromEmail: userProfile!.email.toLowerCase(), fromName: userProfile!.name, message: feedbackInput.trim(), createdAt: new Date(), read: false }; await db.saveFeedback(newMsg); setFeedbackMessages((prev: any) => [...prev, newMsg]); setFeedbackInput(''); }}} className="p-3 rounded-2xl transition-all active:scale-90" style={{ backgroundColor: feedbackInput.trim() ? c.accent : c.bgTertiary, color: feedbackInput.trim() ? '#fff' : c.textMuted }}><Send size={18} /></button>
                </div>
              )}
            </>)}

            {/* DM CONVERSATIONS LIST */}
            {dmView === 'conversations' && (
              <div className="flex-1 overflow-y-auto" style={{ minHeight: '200px' }}>
                {/* New conversation input */}
                <div className="p-4 border-b space-y-2" style={{ borderColor: c.borderPrimary }}>
                  <div className="flex gap-2">
                    <input value={dmNewEmail} onChange={e => { setDmNewEmail(e.target.value); setDmError(''); }} placeholder="Enter user's email to chat..." className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none border" style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary, color: c.textPrimary }} />
                    <button onClick={async () => {
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
                      if (!dmNewEmail.trim() || !emailRegex.test(dmNewEmail.trim())) { setDmError('Enter a valid email address'); return; }
                      if (dmNewEmail.toLowerCase().trim() === userProfile!.email.toLowerCase()) { setDmError('Cannot message yourself'); return; }
                      // Common typo check
                      const domain = dmNewEmail.split('@')[1]?.toLowerCase();
                      if (domain && (domain === 'gmai.com' || domain === 'gmial.com' || domain === 'gamil.com' || domain === 'gmal.com')) { setDmError('Did you mean @gmail.com?'); return; }
                      try {
                        setDmChatWith(dmNewEmail.trim().toLowerCase());
                        const msgs = await db.getConversationMessages(userProfile!.email, dmNewEmail.trim());
                        setDmChatMessages(msgs);
                        setDmView('chat');
                        setDmNewEmail('');
                        setDmError('');
                      } catch (err: any) {
                        setDmError('Failed to open chat: ' + (err.message || 'unknown error'));
                      }
                    }} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: c.accent }}>Chat</button>
                  </div>
                  {dmError && <p className="text-xs text-red-400 pl-1">{dmError}</p>}
                </div>
                {/* Conversation list */}
                {dmConversations.length === 0 ? (
                  <div className="text-center py-8" style={{ color: c.textMuted }}>
                    <p className="text-sm">No conversations yet. Enter an email above to start chatting!</p>
                  </div>
                ) : dmConversations.map((conv: any) => (
                  <button key={conv.id} onClick={async () => { setDmChatWith(conv.otherEmail); const msgs = await db.getConversationMessages(userProfile!.email, conv.otherEmail); setDmChatMessages(msgs); setDmView('chat'); }} className="w-full flex items-center gap-3 p-4 border-b transition-colors text-left" style={{ borderColor: c.borderPrimary }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = c.bgTertiary)} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: c.accent }}>{conv.otherEmail[0].toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: c.textPrimary }}>{conv.otherEmail}</div>
                      <div className="text-xs truncate" style={{ color: c.textMuted }}>{conv.lastMessage}</div>
                    </div>
                    <div className="text-[9px]" style={{ color: c.textMuted }}>{conv.lastMessageAt instanceof Date ? conv.lastMessageAt.toLocaleDateString() : ''}</div>
                  </button>
                ))}
              </div>
            )}

            {/* DM CHAT VIEW */}
            {dmView === 'chat' && (<>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: c.borderPrimary }}>
                <button onClick={async () => { setDmView('conversations'); if (db.isDatabaseEnabled()) { const convs = await db.getUserConversations(userProfile!.email); setDmConversations(convs); } }} className="p-1" style={{ color: c.textMuted }}>&larr;</button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: c.accent }}>{dmChatWith[0]?.toUpperCase()}</div>
                <div className="text-sm font-bold" style={{ color: c.textPrimary }}>{dmChatWith}</div>
              </div>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ minHeight: '200px' }}>
                {dmChatMessages.length === 0 ? (
                  <div className="text-center py-8" style={{ color: c.textMuted }}><p className="text-sm">Start the conversation!</p></div>
                ) : dmChatMessages.map((msg: any) => {
                  const isMe = msg.from === userProfile!.email.toLowerCase();
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm max-w-[75%] ${isMe ? 'rounded-tr-sm text-white' : 'rounded-tl-sm'}`} style={{ backgroundColor: isMe ? c.accent : c.bgTertiary, color: isMe ? '#fff' : c.textPrimary }}>
                        {msg.message}
                        <div className={`text-[9px] mt-1 ${isMe ? 'text-white/60' : ''}`} style={isMe ? {} : { color: c.textMuted }}>{msg.createdAt instanceof Date ? msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Send message */}
              <div className="p-4 border-t flex gap-2" style={{ borderColor: c.borderPrimary }}>
                <input value={dmInput} onChange={e => setDmInput(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter' && dmInput.trim()) { await sendDmMessage(dmInput); }}} placeholder="Type a message... (mention @utsho for AI help)" className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none border" style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary, color: c.textPrimary }} />
                <button onClick={async () => { if (dmInput.trim()) { await sendDmMessage(dmInput); }}} className="p-3 rounded-2xl transition-all active:scale-90" style={{ backgroundColor: dmInput.trim() ? c.accent : c.bgTertiary, color: dmInput.trim() ? '#fff' : c.textMuted }}><Send size={18} /></button>
              </div>
            </>)}
          </div>
        </div>
      )}

      <aside className={`fixed md:relative z-50 inset-y-0 left-0 w-72 border-r flex flex-col transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}>
        <div className="p-4 flex flex-col gap-4">
          <button onClick={() => createNewSession()} className="py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95" style={{ backgroundColor: c.buttonPrimary, color: c.buttonPrimaryText }}><Plus size={18} /> New Chat</button>
          
          {isAdmin ? (
          <div className="border rounded-[2rem] shadow-2xl space-y-4 p-4" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}>
             <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: c.borderPrimary }}>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: c.textMuted }}>
                   POOL HEALTH
                </div>
                <button onClick={handleResetPool} className="transition-colors" style={{ color: c.textMuted }}><RefreshCcw size={12} /></button>
             </div>
             
             <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: c.textMuted }}>AVAILABLE NODES</span>
                  <span className="text-[10px] font-black text-emerald-400">{poolInfo.active}/{poolInfo.total}</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: c.bgTertiary }}>
                  <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(poolInfo.active / Math.max(1, poolInfo.total)) * 100}%` }} />
                </div>
             </div>

             <div className="pt-2 border-t" style={{ borderColor: c.borderPrimary }}>
                <div className="text-[9px] font-black text-center py-1 rounded-lg truncate" style={{ color: connectionHealth === 'error' ? '#f87171' : c.statusBarText, backgroundColor: connectionHealth === 'error' ? 'rgba(248,113,113,0.05)' : c.statusBar }}>
                  {apiStatusText.toUpperCase()} {isLoading && "..."}
                </div>
             </div>
          </div>
          ) : (
          <div className="border rounded-2xl p-3 flex items-center justify-center" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}>
             <div className="text-[9px] font-black text-center py-1 rounded-lg truncate" style={{ color: connectionHealth === 'error' ? '#f87171' : c.statusBarText, backgroundColor: connectionHealth === 'error' ? 'rgba(248,113,113,0.05)' : c.statusBar, padding: '4px 12px' }}>
               {connectionHealth === 'error' ? 'RECONNECTING...' : 'ONLINE'} {isLoading && "..."}
             </div>
          </div>
          )}

          <div className="flex items-center justify-between px-3 py-2 rounded-xl border" style={{ backgroundColor: c.bgHover, borderColor: c.borderPrimary }}>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: c.textMuted }}>Tools</span>
            <button onClick={() => setIsToolsOpen(true)} className="transition-colors" style={{ color: c.textMuted }}><Wrench size={14} /></button>
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border" style={{ backgroundColor: c.bgHover, borderColor: c.borderPrimary }}>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: c.textMuted }}>Settings</span>
            <button onClick={() => setIsSettingsOpen(true)} className="transition-colors" style={{ color: c.textMuted }}><Settings size={14} /></button>
          </div>
          <button 
            onClick={async () => { 
              setIsFeedbackOpen(true); 
              if (db.isDatabaseEnabled()) {
                try {
                  if (isAdmin) {
                    const all = await db.getAllFeedback();
                    setFeedbackMessages(all);
                  } else {
                    const replies = await db.getUserFeedbackReplies(userProfile!.email);
                    const myFeedback = (await db.getAllFeedback()).filter(f => f.fromEmail === userProfile!.email.toLowerCase());
                    setFeedbackMessages(myFeedback.length > 0 ? myFeedback : replies.map((r: any, i: number) => ({ id: `r${i}`, fromName: 'You', message: r.message, reply: r.reply, repliedAt: r.repliedAt, read: true, createdAt: new Date() })));
                  }
                } catch(e) { console.error(e); }
              }
            }}
            className="flex items-center justify-between px-3 py-2 rounded-xl border transition-colors"
            style={{ backgroundColor: c.bgHover, borderColor: c.borderPrimary }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: c.textMuted }}>
              {isAdmin ? 'Inbox' : 'Contact Admin'}
            </span>
            <MessageSquare size={14} style={{ color: c.textMuted }} />
          </button>
          
          <button 
            onClick={handleUpgrade}
            className="flex items-center justify-between px-3 py-2 rounded-xl border transition-all active:scale-95"
            style={{ backgroundColor: c.bgHover, borderColor: c.borderPrimary }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: c.textMuted }}>
              Upgrade App
            </span>
            <RefreshCcw size={14} style={{ color: c.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide">
          {sessions.map(s => (
            <div key={s.id} onClick={() => { setActiveSessionId(s.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }} className="group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border" style={{ backgroundColor: activeSessionId === s.id ? c.bgTertiary : 'transparent', color: activeSessionId === s.id ? c.textPrimary : c.textMuted, borderColor: activeSessionId === s.id ? c.borderSecondary : 'transparent', boxShadow: activeSessionId === s.id ? '0 4px 14px rgba(0,0,0,0.15)' : 'none' }}>
              <MessageSquare size={16} style={{ color: activeSessionId === s.id ? c.accent : undefined }} /> 
              <div className="flex-1 truncate text-sm font-medium">{s.title}</div>
              <button onClick={(e) => { e.stopPropagation(); db.deleteSession(userProfile!.email, s.id); setSessions(prev => prev.filter(x => x.id !== s.id)); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex flex-col gap-3" style={{ borderColor: c.borderPrimary, backgroundColor: `${c.bgSecondary}cc` }}>
          <div className="flex items-center gap-3">
            <img src={userProfile?.picture} className="w-9 h-9 rounded-full border" style={{ borderColor: c.borderPrimary }} alt="" />
            <div className="flex-1 truncate text-[11px] font-bold leading-tight" style={{ color: c.textSecondary }}>
              {userProfile?.name} <br/> 
              <span className="text-[9px] uppercase tracking-widest font-black" style={{ color: c.textMuted }}>{userProfile?.age}Y &bull; {userProfile?.gender}</span>
            </div>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="transition-colors hover:text-red-500" style={{ color: c.textMuted }}><LogOut size={16} /></button>
          </div>
          <div className="pt-2 border-t flex flex-col items-center gap-2 font-bold uppercase tracking-widest text-[9px]" style={{ borderColor: c.borderPrimary, color: c.textMuted }}>
            {installPrompt && (
              <button onClick={async () => { installPrompt.prompt(); const result = await installPrompt.userChoice; if (result.outcome === 'accepted') setInstallPrompt(null); }} className="w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95" style={{ backgroundColor: c.accent, color: '#fff' }}>
                Install App
              </button>
            )}
            <div className="flex items-center gap-4">
              <a href="https://facebook.com/shakkhor12102005" target="_blank" className="transition-all hover:scale-110" style={{ color: c.textMuted }}><Facebook size={14}/></a>
              <a href="https://www.instagram.com/shakkhor_paul005/" target="_blank" className="transition-all hover:scale-110" style={{ color: c.textMuted }}><Instagram size={14}/></a>
            </div>
            Developed by Shakkhor Paul
          </div>
        </div>
      </aside>

      {/* S-code / S-math Canvas Panel */}
      {canvasOpen && (
        <div 
          className={`${canvasFullscreen ? 'fixed inset-0 z-[90]' : 'relative'} flex flex-col border-l`}
          style={{ 
            backgroundColor: c.bgPrimary, 
            borderColor: c.borderPrimary,
            width: canvasFullscreen ? '100%' : '45%',
            minWidth: canvasFullscreen ? '100%' : '380px',
            maxWidth: canvasFullscreen ? '100%' : '600px',
            order: 2,
          }}
        >
          {/* Canvas Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: c.borderPrimary, backgroundColor: c.bgSecondary }}>
            <div className="flex items-center gap-2">
              {canvasBlocks[canvasActiveIndex]?.type === 'code' 
                ? <Code size={18} style={{ color: c.accent }} />
                : canvasBlocks[canvasActiveIndex]?.type === 'math'
                ? <Calculator size={18} style={{ color: '#f59e0b' }} />
                : canvasBlocks[canvasActiveIndex]?.type === 'word'
                ? <PenTool size={18} style={{ color: '#10b981' }} />
                : canvasBlocks[canvasActiveIndex]?.type === 'graph'
                ? <LineChart size={18} style={{ color: '#f43f5e' }} />
                : <FileText size={18} style={{ color: '#06b6d4' }} />
              }
              <span className="text-sm font-black uppercase tracking-wider" style={{ 
                color: canvasBlocks[canvasActiveIndex]?.type === 'code' ? c.accent 
                  : canvasBlocks[canvasActiveIndex]?.type === 'math' ? '#f59e0b' 
                  : canvasBlocks[canvasActiveIndex]?.type === 'word' ? '#10b981'
                  : canvasBlocks[canvasActiveIndex]?.type === 'graph' ? '#f43f5e'
                  : '#06b6d4'
              }}>
                {canvasBlocks[canvasActiveIndex]?.title || 'Canvas'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {canvasBlocks.length > 1 && (
                <div className="flex items-center gap-1 mr-2">
                  {canvasBlocks.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCanvasActiveIndex(idx)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ 
                        backgroundColor: idx === canvasActiveIndex ? c.accent : c.bgTertiary,
                        transform: idx === canvasActiveIndex ? 'scale(1.3)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              )}
              <button 
                onClick={() => copyCanvasContent(canvasActiveIndex)} 
                className="p-2 rounded-xl transition-all hover:scale-105"
                style={{ color: copiedIndex === canvasActiveIndex ? '#22c55e' : c.textMuted }}
                title="Copy"
              >
                {copiedIndex === canvasActiveIndex ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button 
                onClick={() => setCanvasFullscreen(!canvasFullscreen)} 
                className="p-2 rounded-xl transition-all hover:scale-105"
                style={{ color: c.textMuted }}
                title={canvasFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {canvasFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button 
                onClick={() => { setCanvasOpen(false); setCanvasFullscreen(false); }} 
                className="p-2 rounded-xl transition-all hover:scale-105 hover:text-red-400"
                style={{ color: c.textMuted }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Canvas Body */}
          <div className="flex-1 overflow-auto p-0 canvas-pattern">
            {canvasBlocks[canvasActiveIndex] && (
              <div className="h-full">
                {canvasBlocks[canvasActiveIndex].type === 'word' ? (
                  /* S-word: Rich document editor / canvas (Gemini Canvas-like) */
                  <div className="h-full flex flex-col">
                    {/* Edit/View toggle */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: c.borderPrimary, backgroundColor: c.bgSecondary }}>
                      <button
                        onClick={() => {
                          if (!wordEditMode) {
                            setWordEditContent(canvasBlocks[canvasActiveIndex].content);
                          } else {
                            // Save edits back to canvas block
                            const updated = [...canvasBlocks];
                            updated[canvasActiveIndex] = { ...updated[canvasActiveIndex], content: wordEditContent };
                            setCanvasBlocks(updated);
                          }
                          setWordEditMode(!wordEditMode);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{ 
                          backgroundColor: wordEditMode ? '#10b981' : c.bgTertiary, 
                          color: wordEditMode ? '#fff' : c.textSecondary,
                          border: `1px solid ${wordEditMode ? '#10b981' : c.borderPrimary}`,
                        }}
                      >
                        {wordEditMode ? <><Check size={12} className="inline mr-1" />Save</> : <><PenTool size={12} className="inline mr-1" />Edit</>}
                      </button>
                      <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: c.textMuted }}>
                        {wordEditMode ? 'Editing' : 'Preview'}
                      </span>
                    </div>
                    {wordEditMode ? (
                      /* Edit mode: Plain text editor */
                      <textarea
                        value={wordEditContent}
                        onChange={(e) => setWordEditContent(e.target.value)}
                        className="flex-1 p-6 text-[15px] leading-relaxed resize-none outline-none custom-scrollbar"
                        style={{ 
                          backgroundColor: c.bgPrimary, 
                          color: c.textPrimary, 
                          fontFamily: "'Georgia', 'Merriweather', 'Noto Serif', serif",
                        }}
                        spellCheck
                      />
                    ) : (
                      /* Preview mode: Rich formatted document */
                      <div className="flex-1 overflow-auto custom-scrollbar">
                        <div className="max-w-[680px] mx-auto px-8 py-10 space-y-1" style={{ fontFamily: "'Georgia', 'Merriweather', 'Noto Serif', serif" }}>
                          {canvasBlocks[canvasActiveIndex].content.split('\n').map((line, i) => {
                            const trimmed = line.trim();
                            const isH1 = trimmed.startsWith('# ');
                            const isH2 = trimmed.startsWith('## ');
                            const isH3 = trimmed.startsWith('### ');
                            const isBlockquote = trimmed.startsWith('> ');
                            const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
                            const isNumbered = /^\d+[\.\)]\s/.test(trimmed);
                            const isSeparator = /^[-=_]{3,}$/.test(trimmed);
                            const isEmpty = !trimmed;

                            if (isSeparator) return <hr key={i} className="my-8" style={{ borderColor: c.borderPrimary }} />;
                            if (isEmpty) return <div key={i} className="h-3" />;

                            // Strip markdown prefixes for display
                            let displayText = trimmed
                              .replace(/^#{1,3}\s+/, '')
                              .replace(/^>\s+/, '')
                              .replace(/^[-*]\s+/, '')
                              .replace(/^\d+[\.\)]\s+/, '');

                            // Inline formatting: bold, italic, inline code
                            const formatInline = (text: string) => {
                              const parts: React.ReactNode[] = [];
                              const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
                              let lastIndex = 0;
                              let match;
                              let key = 0;
                              while ((match = regex.exec(text)) !== null) {
                                if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
                                if (match[2]) parts.push(<strong key={key++}><em>{match[2]}</em></strong>);
                                else if (match[3]) parts.push(<strong key={key++}>{match[3]}</strong>);
                                else if (match[4]) parts.push(<em key={key++}>{match[4]}</em>);
                                else if (match[5]) parts.push(<code key={key++} className="px-1.5 py-0.5 rounded text-sm" style={{ backgroundColor: c.bgTertiary, color: c.accent }}>{match[5]}</code>);
                                lastIndex = match.index + match[0].length;
                              }
                              if (lastIndex < text.length) parts.push(text.slice(lastIndex));
                              return parts.length > 0 ? parts : [text];
                            };

                            if (isH1) return (
                              <h1 key={i} className="text-3xl font-black mt-10 mb-4 pb-3 border-b-2" style={{ color: c.textPrimary, borderColor: '#10b981', fontFamily: "'Inter', 'SF Pro', sans-serif" }}>
                                {formatInline(displayText)}
                              </h1>
                            );
                            if (isH2) return (
                              <h2 key={i} className="text-2xl font-bold mt-8 mb-3 pb-2 border-b" style={{ color: c.textPrimary, borderColor: c.borderPrimary, fontFamily: "'Inter', 'SF Pro', sans-serif" }}>
                                {formatInline(displayText)}
                              </h2>
                            );
                            if (isH3) return (
                              <h3 key={i} className="text-xl font-bold mt-6 mb-2" style={{ color: c.textPrimary, fontFamily: "'Inter', 'SF Pro', sans-serif" }}>
                                {formatInline(displayText)}
                              </h3>
                            );
                            if (isBlockquote) return (
                              <blockquote key={i} className="pl-5 py-2 my-3 border-l-4 italic" style={{ borderColor: '#10b981', color: c.textSecondary, backgroundColor: 'rgba(16,185,129,0.05)' }}>
                                {formatInline(displayText)}
                              </blockquote>
                            );
                            if (isBullet) return (
                              <div key={i} className="flex gap-3 pl-4 text-[15px] leading-relaxed my-1">
                                <span className="mt-2.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#10b981' }} />
                                <span style={{ color: c.textPrimary }}>{formatInline(displayText)}</span>
                              </div>
                            );
                            if (isNumbered) return (
                              <div key={i} className="flex gap-3 pl-4 text-[15px] leading-relaxed my-1">
                                <span className="font-bold shrink-0 min-w-[1.5rem] text-right" style={{ color: '#10b981' }}>
                                  {trimmed.match(/^(\d+)[\.\)]/)?.[1]}.
                                </span>
                                <span style={{ color: c.textPrimary }}>{formatInline(displayText)}</span>
                              </div>
                            );
                            return (
                              <p key={i} className="text-[15px] leading-[1.85] my-1" style={{ color: c.textPrimary }}>
                                {formatInline(displayText)}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : canvasBlocks[canvasActiveIndex].type === 'graph' ? (
                  /* S-graph: Interactive 2D/3D math graph (Desmos-like) */
                  <div className="h-full flex flex-col">
                    {/* Graph controls toolbar */}
                    <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ borderColor: c.borderPrimary, backgroundColor: c.bgSecondary }}>
                      <button
                        onClick={() => setGraphZoom(z => Math.min(z * 1.3, 20))}
                        className="p-2 rounded-lg transition-all hover:scale-105"
                        style={{ color: c.textMuted, backgroundColor: c.bgTertiary }}
                        title="Zoom In"
                      ><ZoomIn size={16} /></button>
                      <button
                        onClick={() => setGraphZoom(z => Math.max(z / 1.3, 0.1))}
                        className="p-2 rounded-lg transition-all hover:scale-105"
                        style={{ color: c.textMuted, backgroundColor: c.bgTertiary }}
                        title="Zoom Out"
                      ><ZoomOut size={16} /></button>
                      <button
                        onClick={() => { setGraphZoom(1); setGraphPan({ x: 0, y: 0 }); setGraphRotation({ angleX: 0.6, angleY: 0.8 }); }}
                        className="p-2 rounded-lg transition-all hover:scale-105"
                        style={{ color: c.textMuted, backgroundColor: c.bgTertiary }}
                        title="Reset View"
                      ><RotateCcw size={16} /></button>
                      <div className="flex-1" />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.textMuted }}>
                        {(() => {
                          const cfg = parseGraphBlock(canvasBlocks[canvasActiveIndex].content);
                          return cfg.is3D ? '3D Mode' : '2D Mode';
                        })()}
                      </span>
                      <span className="text-[10px] font-bold ml-2 px-2 py-1 rounded" style={{ color: c.textMuted, backgroundColor: c.bgTertiary }}>
                        {graphZoom.toFixed(1)}x
                      </span>
                    </div>
                    {/* Graph canvas */}
                    <div className="flex-1 relative" style={{ backgroundColor: c.bgPrimary }}>
                      <canvas
                        ref={graphCanvasRef}
                        className="w-full h-full cursor-grab active:cursor-grabbing"
                        style={{ display: 'block' }}
                        onMouseDown={(e) => {
                          setGraphDragging(true);
                          setGraphDragStart({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={(e) => {
                          if (!graphDragging) return;
                          const dx = (e.clientX - graphDragStart.x) / 100;
                          const dy = (e.clientY - graphDragStart.y) / 100;
                          const cfg = parseGraphBlock(canvasBlocks[canvasActiveIndex].content);
                          if (cfg.is3D) {
                            setGraphRotation(r => ({ angleX: r.angleX + dy * 0.5, angleY: r.angleY + dx * 0.5 }));
                          } else {
                            setGraphPan(p => ({ x: p.x + dx, y: p.y + dy }));
                          }
                          setGraphDragStart({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseUp={() => setGraphDragging(false)}
                        onMouseLeave={() => setGraphDragging(false)}
                        onWheel={(e) => {
                          e.preventDefault();
                          setGraphZoom(z => Math.max(0.1, Math.min(20, z * (e.deltaY < 0 ? 1.1 : 0.9))));
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length === 1) {
                            setGraphDragging(true);
                            setGraphDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                          }
                        }}
                        onTouchMove={(e) => {
                          if (!graphDragging || e.touches.length !== 1) return;
                          const dx = (e.touches[0].clientX - graphDragStart.x) / 100;
                          const dy = (e.touches[0].clientY - graphDragStart.y) / 100;
                          const cfg = parseGraphBlock(canvasBlocks[canvasActiveIndex].content);
                          if (cfg.is3D) {
                            setGraphRotation(r => ({ angleX: r.angleX + dy * 0.5, angleY: r.angleY + dx * 0.5 }));
                          } else {
                            setGraphPan(p => ({ x: p.x + dx, y: p.y + dy }));
                          }
                          setGraphDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                        }}
                        onTouchEnd={() => setGraphDragging(false)}
                      />
                    </div>
                    {/* Expression list */}
                    <div className="border-t px-3 py-2 space-y-1 max-h-32 overflow-auto custom-scrollbar" style={{ borderColor: c.borderPrimary, backgroundColor: c.bgSecondary }}>
                      {(() => {
                        const cfg = parseGraphBlock(canvasBlocks[canvasActiveIndex].content);
                        return cfg.expressions.map((expr, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: expr.color }} />
                            <span className="font-mono truncate" style={{ color: c.textPrimary }}>{expr.raw}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : canvasBlocks[canvasActiveIndex].type === 'explain' ? (
                  /* S-explain: Detailed analysis display */
                  <div className="p-8 space-y-2 overflow-auto custom-scrollbar h-full" style={{ backgroundColor: `${c.bgPrimary}f2` }}>
                    {canvasBlocks[canvasActiveIndex].content.split('\n').map((line, i) => {
                      const trimmed = line.trim();
                      // Detect markdown-style headers
                      const isH1 = trimmed.startsWith('# ');
                      const isH2 = trimmed.startsWith('## ');
                      const isH3 = trimmed.startsWith('### ');
                      const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+[\.\)]\s/.test(trimmed);
                      const isBold = /^\*\*[^*]+\*\*/.test(trimmed);
                      const isSeparator = /^[-=_]{3,}$/.test(trimmed);
                      
                      if (isSeparator) {
                        return <hr key={i} className="my-6" style={{ borderColor: c.borderPrimary }} />;
                      }
                      if (!trimmed) {
                        return <div key={i} className="h-4" />;
                      }
                      
                      const displayText = trimmed
                        .replace(/^#{1,3}\s+/, '')
                        .replace(/^\*\*(.+)\*\*$/, '$1');
                      
                      return (
                        <div 
                          key={i} 
                          className={`leading-relaxed ${
                            isH1 ? 'text-2xl font-black mt-8 mb-4 border-b-2 pb-2' :
                            isH2 ? 'text-xl font-black mt-6 mb-2 pb-2 border-b' :
                            isH3 ? 'text-lg font-bold mt-4 mb-1' :
                            isBold ? 'font-bold mt-4 text-sm' :
                            isBullet ? 'pl-6 text-[15px] relative' :
                            'text-[15px]'
                          }`}
                          style={{ 
                            color: isH1 ? c.accent : isH2 ? '#06b6d4' : isH3 ? c.accent : c.textPrimary,
                            borderColor: (isH1 || isH2) ? `${c.borderPrimary}` : undefined,
                          }}
                        >
                          {isBullet && (
                            <span 
                              className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full" 
                              style={{ backgroundColor: isH1 ? c.accent : '#06b6d4' }}
                            />
                          )}
                          {isBullet ? trimmed.replace(/^[-*]\s+|\d+[\.\)]\s+/, '') : displayText}
                        </div>
                      );
                    })}
                  </div>
                ) : canvasBlocks[canvasActiveIndex].type === 'code' ? (
                  /* S-code: Code display with line numbers */
                  <div className="flex h-full" style={{ fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace" }}>
                    {/* Line numbers */}
                    <div 
                      className="select-none text-right py-4 px-3 text-xs leading-6 sticky left-0"
                      style={{ backgroundColor: c.bgSecondary, color: c.textMuted, borderRight: `1px solid ${c.borderPrimary}`, minWidth: '3rem' }}
                    >
                      {canvasBlocks[canvasActiveIndex].content.split('\n').map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    {/* Code content */}
                    <pre 
                      className="flex-1 py-4 px-4 text-sm leading-6 overflow-x-auto"
                      style={{ color: c.textPrimary, backgroundColor: c.bgPrimary, margin: 0 }}
                    >
                      <code>{canvasBlocks[canvasActiveIndex].content}</code>
                    </pre>
                  </div>
                ) : (
                  /* S-math: Math solution display */
                  <div className="p-6 space-y-4">
                    <div 
                      className="rounded-2xl border p-5"
                      style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary }}
                    >
                      {canvasBlocks[canvasActiveIndex].content.split('\n').map((line, i) => {
                        const trimmed = line.trim();
                        // Detect section headers (lines ending with :)
                        const isHeader = /^(step|answer|solution|given|find|formula|result|proof|therefore|hence)/i.test(trimmed);
                        // Detect final answer lines
                        const isFinalAnswer = /^(answer|result|therefore|hence|final|∴)/i.test(trimmed);
                        // Detect separator lines
                        const isSeparator = /^[-=_]{3,}$/.test(trimmed);
                        
                        if (isSeparator) {
                          return <hr key={i} className="my-3" style={{ borderColor: c.borderPrimary }} />;
                        }
                        
                        return (
                          <div 
                            key={i} 
                            className={`${isHeader ? 'font-black text-base mt-4 mb-1' : 'text-sm'} ${isFinalAnswer ? 'text-lg font-black mt-4 p-3 rounded-xl' : ''} leading-relaxed`}
                            style={{ 
                              color: isHeader ? c.accent : isFinalAnswer ? '#22c55e' : c.textPrimary,
                              backgroundColor: isFinalAnswer ? 'rgba(34,197,94,0.08)' : 'transparent',
                              fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                            }}
                          >
                            {trimmed || '\u00A0'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Canvas Footer */}
          <div className="px-4 py-2 border-t flex items-center justify-between" style={{ borderColor: c.borderPrimary, backgroundColor: c.bgSecondary }}>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.textMuted }}>
              {canvasBlocks[canvasActiveIndex]?.type === 'code' 
                ? `${langDisplayName(canvasBlocks[canvasActiveIndex]?.language)} | ${canvasBlocks[canvasActiveIndex]?.content.split('\n').length} lines`
                : canvasBlocks[canvasActiveIndex]?.type === 'math'
                ? `${canvasBlocks[canvasActiveIndex]?.content.split('\n').length} steps`
                : canvasBlocks[canvasActiveIndex]?.type === 'word'
                ? `${canvasBlocks[canvasActiveIndex]?.content.split('\n').length} lines | Document`
                : canvasBlocks[canvasActiveIndex]?.type === 'graph'
                ? (() => { const cfg = parseGraphBlock(canvasBlocks[canvasActiveIndex]?.content || ''); return `${cfg.expressions.length} expression${cfg.expressions.length !== 1 ? 's' : ''} | ${cfg.is3D ? '3D' : '2D'}`; })()
                : `${canvasBlocks[canvasActiveIndex]?.content.split('\n').length} lines | Detailed Analysis`
              }
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.textMuted }}>
              {canvasBlocks[canvasActiveIndex]?.type === 'code' ? 'S-CODE' 
                : canvasBlocks[canvasActiveIndex]?.type === 'math' ? 'S-MATH' 
                : canvasBlocks[canvasActiveIndex]?.type === 'word' ? 'S-WORD'
                : canvasBlocks[canvasActiveIndex]?.type === 'graph' ? 'S-GRAPH'
                : 'S-EXPLAIN'}
            </span>
          </div>
        </div>
      )}

      <main className={`flex-1 flex flex-col relative overflow-hidden ${canvasOpen && !canvasFullscreen ? 'hidden md:flex' : ''}`} style={{ order: 1 }}>
        <div className="md:hidden h-14 border-b backdrop-blur-md flex items-center px-4 sticky top-0 z-40" style={{ borderColor: c.borderPrimary, backgroundColor: `${c.bgPrimary}cc` }}>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2" style={{ color: c.textSecondary }}><Menu size={20} /></button>
          <div className="flex-1 text-center font-black tracking-tighter text-lg" style={{ color: c.accent }}>UTSHO AI</div>
          <button onClick={() => createNewSession()} className="p-2" style={{ color: c.textSecondary }}><Plus size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6 pb-4">
            {!activeSession || activeSession.messages.length === 0 ? (
              <div className="h-[65vh] flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in slide-in-from-top-8 duration-700">
                <div className="w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-2xl floating-ai" style={{ backgroundColor: c.accent, boxShadow: `0 20px 40px ${c.accentShadow}` }}><Sparkles size={48} className="text-white" /></div>
                <div className="space-y-2 px-4">
                  <h3 className="text-3xl font-black tracking-tight" style={{ color: c.textPrimary }}>Hey {userProfile?.name.split(' ')[0]}!</h3>
                  <p className="text-sm max-w-xs mx-auto font-medium" style={{ color: c.textMuted }}>Fullstack Adaptive Identity Engaged. <br/> How can I help you today?</p>
                </div>
              </div>
            ) : (
              activeSession.messages.map(m => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2 duration-300`}>
                   <div className={`flex flex-col gap-2 max-w-[90%] md:max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {m.documentName && (
                        <div className="flex items-center gap-2 border rounded-2xl px-3 py-2 mb-1" style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}>
                          <Paperclip size={14} style={{ color: c.accent }} />
                          <span className="text-xs font-bold truncate max-w-[200px]" style={{ color: c.textSecondary }}>{m.documentName}</span>
                        </div>
                      )}
                      {m.imageUrl && (
                        <div className="rounded-[2rem] overflow-hidden border shadow-2xl mb-1" style={{ borderColor: c.borderPrimary }}>
                           <img src={m.imageUrl} className="max-w-full h-auto max-h-[300px] object-cover" alt="User upload" />
                        </div>
                      )}
                      {m.content && (
                        <div 
                          className={`p-4 md:p-5 rounded-[2rem] text-[15px] bangla-text shadow-xl ${m.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`} 
                          style={
                            m.content.startsWith("Failure") 
                              ? { backgroundColor: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.3)', border: '1px solid', color: '#f87171' }
                              : m.role === 'user' 
                                ? { backgroundColor: c.userBubble, boxShadow: `0 4px 14px ${c.userBubbleShadow}`, color: '#ffffff' }
                                : { backgroundColor: c.botBubble, border: `1px solid ${c.botBubbleBorder}`, color: c.textPrimary }
                          }
                        >
                          {m.content.startsWith("Failure") && <AlertCircle size={14} className="inline mr-2" />}
                          {m.role === 'model' ? renderMarkdown(m.content, false) : m.content}
                        </div>
                      )}
                      {/* S-code / S-math canvas blocks as Artifact Cards */}
                      {m.canvasBlocks && m.canvasBlocks.length > 0 && (
                        <div className="flex flex-col gap-2 mt-2 w-full max-w-sm">
                          {m.canvasBlocks.map((block, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => {
                                setCanvasActiveIndex(bIdx);
                                openCanvas(m.canvasBlocks!);
                              }}
                              className="flex items-center gap-3 border p-3 rounded-2xl text-left transition-all shadow-sm hover:shadow-md active:scale-[0.98] group"
                              style={{ 
                                backgroundColor: c.bgSecondary,
                                borderColor: c.borderPrimary,
                              }}
                            >
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ 
                                backgroundColor: block.type === 'code' ? c.accentSubtle 
                                  : block.type === 'math' ? 'rgba(245,158,11,0.1)' 
                                  : block.type === 'word' ? 'rgba(16,185,129,0.1)'
                                  : block.type === 'graph' ? 'rgba(244,63,94,0.1)'
                                  : 'rgba(6,182,212,0.1)',
                                color: block.type === 'code' ? c.accent 
                                  : block.type === 'math' ? '#f59e0b' 
                                  : block.type === 'word' ? '#10b981'
                                  : block.type === 'graph' ? '#f43f5e'
                                  : '#06b6d4',
                              }}>
                                {block.type === 'code' ? <Code size={20} /> : block.type === 'math' ? <Calculator size={20} /> : block.type === 'word' ? <PenTool size={20} /> : block.type === 'graph' ? <LineChart size={20} /> : <FileText size={20} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-black uppercase tracking-widest opacity-60" style={{ color: c.textMuted }}>
                                  {block.type === 'code' ? 'S-CODE' : block.type === 'math' ? 'S-MATH' : block.type === 'word' ? 'S-WORD' : block.type === 'graph' ? 'S-GRAPH' : 'S-EXPLAIN'}
                                </div>
                                <div className="text-sm font-bold truncate" style={{ color: c.textPrimary }}>
                                  {block.title || (block.type === 'code' ? langDisplayName(block.language) : block.type === 'math' ? 'Solution' : block.type === 'word' ? 'Document' : block.type === 'graph' ? 'Graph' : 'Analysis')}
                                </div>
                              </div>
                              <div className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: c.bgTertiary, color: c.accent }}>
                                <ChevronRight size={16} />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1 ml-1">
                          {m.sources.map((s: any, idx: number) => (
                            <a key={idx} href={s.uri} target="_blank" className="flex items-center gap-2 border py-1.5 px-3.5 rounded-2xl text-[10px] transition-all shadow-sm" style={{ backgroundColor: c.bgSecondary, borderColor: c.borderPrimary, color: c.textMuted }}>
                              <Globe size={10} style={{ color: c.accent }} /> <span className="max-w-[120px] truncate font-bold">{s.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                   </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 md:p-8 backdrop-blur-xl border-t" style={{ backgroundColor: `${c.bgPrimary}e6`, borderColor: `${c.borderPrimary}80` }}>
          <div className="max-w-3xl mx-auto space-y-4">
            {imagePreview && (
              <div className="relative inline-block animate-in fade-in zoom-in duration-300">
                <img src={imagePreview} className="w-24 h-24 object-cover rounded-3xl border-2 shadow-2xl" style={{ borderColor: `${c.accent}66` }} alt="Preview" />
                <button onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform"><X size={14} /></button>
              </div>
            )}
            {selectedDocument && (
              <div className="relative inline-flex items-center gap-2 border rounded-2xl px-4 py-2.5 animate-in fade-in zoom-in duration-300" style={{ backgroundColor: c.bgTertiary, borderColor: c.borderPrimary }}>
                <Paperclip size={16} style={{ color: c.accent }} />
                <div className="text-sm">
                  <div className="font-bold truncate max-w-[200px]" style={{ color: c.textSecondary }}>{selectedDocument.fileName}</div>
                  <div className="text-[10px] uppercase font-bold" style={{ color: c.textMuted }}>{selectedDocument.fileType}</div>
                </div>
                <button onClick={() => setSelectedDocument(null)} className="ml-2 transition-colors hover:text-red-400" style={{ color: c.textMuted }}><X size={14} /></button>
              </div>
            )}
            {inputText.startsWith('/') && (
              <div className="flex flex-wrap gap-1.5 px-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {(isAdmin ? [
                  { label: 'Inbox', cmd: '/inbox' },
                  { label: 'Status', cmd: '/status' },
                  { label: 'Directives', cmd: '/list directives' },
                  { label: 'Knowledge', cmd: '/list knowledge' },
                  { label: 'Set Directive', cmd: '/set directive ' },
                  { label: 'Set Personality', cmd: '/set personality ' },
                  { label: 'Train', cmd: '/train ' },
                  { label: 'Help', cmd: '/help' },
                ] : []).concat([
                  { label: 'Send Feedback', cmd: '/feedback ' },
                  { label: 'My Replies', cmd: '/myreplies' },
                ]).filter(btn => btn.cmd.startsWith(inputText) || inputText === '/').map((item, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputText(item.cmd);
                      if (!item.cmd.endsWith(' ')) {
                        setInputText(item.cmd);
                        setTimeout(() => handleSendMessage(), 50);
                      }
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: c.bgTertiary, color: c.textSecondary, border: `1px solid ${c.borderPrimary}` }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 border rounded-[2.5rem] p-2.5 shadow-2xl transition-all" style={{ backgroundColor: `${c.bgSecondary}cc`, borderColor: c.borderPrimary }}>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.h,.rb,.go,.rs,.sh,.yaml,.yml,.toml,.ini,.cfg,.log,.sql,.env" />
              <button onClick={() => fileInputRef.current?.click()} className="p-3.5 transition-colors" style={{ color: c.textMuted }} title="Attach file"><Paperclip size={22} /></button>

              <textarea rows={1} value={inputText} onChange={e => { setInputText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Talk to Utsho..." className="flex-1 bg-transparent py-3.5 px-2 outline-none resize-none max-h-40 text-[15px]" style={{ color: c.textPrimary }} />
              <button onClick={handleSendMessage} disabled={isLoading} className="p-4 rounded-full transition-all active:scale-90 shadow-xl" style={{ backgroundColor: (inputText.trim() || selectedImage || selectedDocument) && !isLoading ? c.accent : c.bgTertiary, boxShadow: (inputText.trim() || selectedImage || selectedDocument) && !isLoading ? `0 4px 14px ${c.accentShadow}` : 'none', color: (inputText.trim() || selectedImage || selectedDocument) && !isLoading ? '#fff' : c.textMuted }}>
                 {isLoading ? <RefreshCcw size={22} className="animate-spin" /> : <Send size={22} />}
              </button>
            </div>
            <p className="text-[10px] text-center font-bold uppercase tracking-widest" style={{ color: c.textMuted }}>UTSHO CAN MAKE MISTAKES. CHECK IMPORTANT INFO.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
