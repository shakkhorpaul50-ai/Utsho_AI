
import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  deleteDoc,
  increment,
  Timestamp,
  Firestore,
  getCountFromServer,
  runTransaction
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  Auth 
} from 'firebase/auth';
import { UserProfile, ChatSession, Message, ApiKeyHealth } from '../types';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// ABSOLUTE IDENTITY CONSTANTS
export const ADMIN_EMAIL = 'shakkhorpaul50@gmail.com';
export const DEBI_EMAIL = 'nitebiswaskotha@gmail.com';
export const BEST_FRIEND_EMAIL = 'sabihasanzida4@gmail.com';

const isConfigValid = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let db: Firestore | null = null;
let auth: Auth | null = null;

if (isConfigValid) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
}

export const isDatabaseEnabled = () => !!db;
export const isAdmin = (email: string) => email.toLowerCase().trim() === ADMIN_EMAIL;
export const isDebi = (email: string) => email.toLowerCase().trim() === DEBI_EMAIL;

export const getSystemStats = async (requesterEmail: string) => {
  if (!db) return { error: "Database offline" };
  
  const normalizedRequester = requesterEmail.toLowerCase().trim();
  if (normalizedRequester !== ADMIN_EMAIL) {
    throw new Error("Access Denied: You are not Shakkhor Paul.");
  }

  try {
    const usersCollection = collection(db, 'users');
    const userCountSnap = await getCountFromServer(usersCollection);
    const totalUsers = userCountSnap.data().count;
    
    const healthRef = collection(db, 'system', 'api_health', 'keys');
    const healthSnap = await getDocs(healthRef);
    const healthData = healthSnap.docs.map(d => d.data());
    
    return {
      totalUsers,
      activeKeysReport: healthData.length > 0 
        ? healthData.map(d => `${d.keyId}: ${d.status}`).join(', ') 
        : "No keys registered in health logs.",
      timestamp: new Date().toLocaleString(),
      adminVerified: true,
      dbStatus: "Connected & Authorized"
    };
  } catch (err: any) {
    console.error("Firestore Admin Permission Error:", err);
    throw new Error(`Firestore Error: ${err.message}.`);
  }
};

export const loginWithGoogle = async (): Promise<UserProfile | null> => {
  if (!auth) throw new Error("Auth not initialized");
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  if (user && user.email) {
    return {
      name: user.displayName || 'User',
      email: user.email.toLowerCase(),
      picture: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=4f46e5&color=fff`,
      gender: 'male', 
      age: 0,        
      googleId: user.uid
    };
  }
  return null;
};

export const saveUserProfile = async (profile: UserProfile) => {
  if (!db || !profile.email) return;
  const userRef = doc(db, 'users', profile.email.toLowerCase());
  await setDoc(userRef, {
    name: profile.name,
    email: profile.email.toLowerCase(),
    gender: profile.gender,
    age: profile.age,
    picture: profile.picture,
    googleId: profile.googleId || '',
    customApiKey: profile.customApiKey || '',
    emotionalMemory: profile.emotionalMemory || '',
    preferredLanguage: profile.preferredLanguage || ''
  }, { merge: true });
};

export const updateUserLanguage = async (email: string, language: string) => {
  if (!db || !email) return;
  const userRef = doc(db, 'users', email.toLowerCase());
  await setDoc(userRef, { preferredLanguage: language }, { merge: true });
};

export const updateUserMemory = async (email: string, memoryUpdate: string) => {
  if (!db || !email) return;
  const emailLower = email.toLowerCase();
  const userRef = doc(doc(db, 'users', emailLower), 'private', 'memory'); 
  const snap = await getDoc(userRef);
  let existingMemory = "";
  if (snap.exists()) {
    existingMemory = snap.data().emotionalMemory || "";
  }
  const newMemory = `${existingMemory}\n[${new Date().toLocaleDateString()}]: ${memoryUpdate}`.slice(-3000); 
  await setDoc(userRef, { emotionalMemory: newMemory }, { merge: true });
  await setDoc(doc(db, 'users', emailLower), { emotionalMemory: newMemory }, { merge: true });
  return newMemory;
};

export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
  if (!db) return null;
  const userRef = doc(db, 'users', email.toLowerCase());
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return userSnap.data() as UserProfile;
  return null;
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
  if (!db) return [];
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  return snap.docs.map(doc => doc.data() as UserProfile);
};

export const logApiKeyFailure = async (key: string, errorMessage: string) => {
  if (!db) return;
  const keyId = `key_${key.slice(-6)}`;
  const healthRef = doc(db, 'system', 'api_health', 'keys', keyId);
  let status: 'expired' | 'rate-limited' = 'rate-limited';
  if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('invalid')) status = 'expired';
  await setDoc(healthRef, {
    keyId, lastError: errorMessage, failureCount: increment(1), lastChecked: Timestamp.now(), status: status
  }, { merge: true });
};

export const getApiKeyHealthReport = async (): Promise<ApiKeyHealth[]> => {
  if (!db) throw new Error("No database.");
  const healthRef = collection(db, 'system', 'api_health', 'keys');
  const snap = await getDocs(healthRef);
  return snap.docs.map(d => ({ ...d.data(), lastChecked: d.data().lastChecked.toDate() } as ApiKeyHealth));
};

const sanitizeMessages = (messages: Message[]) => {
  return messages.map(m => {
    const { imagePart, imageUrl, documentText, timestamp, ...rest } = m; 
    const persistedImageUrl = imageUrl || null;
    const sanitized: any = {
      ...rest,
      imageUrl: persistedImageUrl,
      timestamp: Timestamp.fromDate(new Date(timestamp))
    };
    Object.keys(sanitized).forEach(key => sanitized[key] === undefined && delete sanitized[key]);
    return sanitized;
  });
};

export const saveSession = async (email: string, session: ChatSession) => {
  if (!db) return;
  const emailLower = email.toLowerCase();
  const sessionRef = doc(db, 'users', emailLower, 'sessions', session.id);
  const payload = {
    id: session.id,
    title: session.title,
    createdAt: Timestamp.fromDate(new Date(session.createdAt)),
    messages: sanitizeMessages(session.messages)
  };
  await setDoc(sessionRef, payload);
};

export const updateSessionMessages = async (email: string, sessionId: string, messages: Message[], title?: string) => {
  if (!db) return;
  const emailLower = email.toLowerCase();
  const sessionRef = doc(db, 'users', emailLower, 'sessions', sessionId);
  const payload: any = {
    messages: sanitizeMessages(messages)
  };
  if (title) payload.title = title;
  await setDoc(sessionRef, payload, { merge: true });
};

export const getSessions = async (email: string): Promise<ChatSession[]> => {
  if (!db) return [];
  const sessionsRef = collection(db, 'users', email.toLowerCase(), 'sessions');
  const q = query(sessionsRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
      messages: (data.messages as any[] || []).map(m => ({
        ...m,
        timestamp: m.timestamp instanceof Timestamp ? m.timestamp.toDate() : new Date(m.timestamp)
      }))
    } as ChatSession;
  });
};

export const deleteSession = async (email: string, sessionId: string) => {
  if (!db) return;
  const sessionRef = doc(db, 'users', email.toLowerCase(), 'sessions', sessionId);
  await deleteDoc(sessionRef);
};

// ==========================================
// ADMIN COMMAND SYSTEM & GLOBAL KNOWLEDGE
// ==========================================

/**
 * Save an admin directive to Firebase. Directives are global instructions
 * that the AI follows for ALL users (e.g., personality traits, rules, greetings).
 */
export const saveAdminDirective = async (id: string, directive: { type: string; content: string; createdAt: Date }) => {
  if (!db) return;
  const ref = doc(db, 'system', 'config', 'directives', id);
  await setDoc(ref, { ...directive, createdAt: Timestamp.fromDate(directive.createdAt) });
};

/**
 * Remove an admin directive by ID.
 */
export const removeAdminDirective = async (id: string) => {
  if (!db) return;
  const ref = doc(db, 'system', 'config', 'directives', id);
  await deleteDoc(ref);
};

/**
 * Get all admin directives from Firebase.
 */
export const getAdminDirectives = async (): Promise<{ id: string; type: string; content: string }[]> => {
  if (!db) return [];
  const ref = collection(db, 'system', 'config', 'directives');
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as { type: string; content: string }) }));
};

/**
 * Save a knowledge entry to the global knowledge base.
 * Knowledge is learned from conversations and shared across all users.
 */
export const saveKnowledge = async (id: string, entry: { topic: string; content: string; source: string; createdAt: Date }) => {
  if (!db) return;
  const ref = doc(db, 'system', 'knowledge', 'entries', id);
  await setDoc(ref, { ...entry, createdAt: Timestamp.fromDate(entry.createdAt) }, { merge: true });
};

/**
 * Get all knowledge entries from the global knowledge base.
 */
export const getKnowledgeBase = async (): Promise<{ id: string; topic: string; content: string; source: string }[]> => {
  if (!db) return [];
  const ref = collection(db, 'system', 'knowledge', 'entries');
  const snap = await getDocs(ref);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as { topic: string; content: string; source: string }) }));
};

/**
 * Remove a knowledge entry by ID.
 */
export const removeKnowledge = async (id: string) => {
  if (!db) return;
  const ref = doc(db, 'system', 'knowledge', 'entries', id);
  await deleteDoc(ref);
};

/**
 * Save admin config (global settings like greeting, personality, etc.)
 */
export const saveAdminConfig = async (key: string, value: string) => {
  if (!db) return;
  const ref = doc(db, 'system', 'config');
  await setDoc(ref, { [key]: value }, { merge: true });
};

/**
 * Get admin config.
 */
export const getAdminConfig = async (): Promise<Record<string, string>> => {
  if (!db) return {};
  const ref = doc(db, 'system', 'config');
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Record<string, string>) : {};
};

// ==========================================
// USER FEEDBACK SYSTEM
// ==========================================

/**
 * Save a user feedback message to Firebase.
 */
export const saveFeedback = async (feedback: {
  id: string;
  fromEmail: string;
  fromName: string;
  message: string;
  createdAt: Date;
  read: boolean;
  reply?: string;
  repliedAt?: Date;
}) => {
  if (!db) return;
  const ref = doc(db, 'system', 'feedback', 'messages', feedback.id);
  await setDoc(ref, {
    ...feedback,
    createdAt: Timestamp.fromDate(feedback.createdAt),
    repliedAt: feedback.repliedAt ? Timestamp.fromDate(feedback.repliedAt) : null,
  });
};

/**
 * Get all feedback messages (admin only).
 */
export const getAllFeedback = async (): Promise<{
  id: string;
  fromEmail: string;
  fromName: string;
  message: string;
  createdAt: Date;
  read: boolean;
  reply?: string;
  repliedAt?: Date;
}[]> => {
  if (!db) return [];
  const ref = collection(db, 'system', 'feedback', 'messages');
  const q = query(ref, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      message: data.message,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
      read: data.read || false,
      reply: data.reply || undefined,
      repliedAt: data.repliedAt instanceof Timestamp ? data.repliedAt.toDate() : undefined,
    };
  });
};

/**
 * Get unread feedback count (admin only).
 */
export const getUnreadFeedbackCount = async (): Promise<number> => {
  if (!db) return 0;
  const all = await getAllFeedback();
  return all.filter(f => !f.read).length;
};

/**
 * Mark a feedback as read.
 */
export const markFeedbackRead = async (feedbackId: string) => {
  if (!db) return;
  const ref = doc(db, 'system', 'feedback', 'messages', feedbackId);
  await setDoc(ref, { read: true }, { merge: true });
};

/**
 * Reply to a feedback message.
 */
export const replyToFeedback = async (feedbackId: string, replyText: string) => {
  if (!db) return;
  const ref = doc(db, 'system', 'feedback', 'messages', feedbackId);
  await setDoc(ref, { reply: replyText, repliedAt: Timestamp.now(), read: true }, { merge: true });
};

/**
 * Get feedback replies for a specific user (to show them admin replies).
 */
export const getUserFeedbackReplies = async (email: string): Promise<{
  message: string;
  reply: string;
  repliedAt: Date;
}[]> => {
  if (!db) return [];
  const all = await getAllFeedback();
  return all
    .filter(f => f.fromEmail === email.toLowerCase() && f.reply)
    .map(f => ({ message: f.message, reply: f.reply!, repliedAt: f.repliedAt! }));
};

// ==========================================
// DIRECT MESSAGING (USER TO USER)
// ==========================================

/**
 * Get or create a conversation ID between two users.
 * Uses sorted emails to create a deterministic ID.
 */
const getConversationId = (email1: string, email2: string): string => {
  const sorted = [email1.toLowerCase().trim(), email2.toLowerCase().trim()].sort();
  return `dm_${sorted[0].replace(/[^a-z0-9]/g, '_')}__${sorted[1].replace(/[^a-z0-9]/g, '_')}`;
};

/**
 * Send a direct message to another user.
 */
export const sendDirectMessage = async (fromEmail: string, fromName: string, toEmail: string, message: string) => {
  if (!db) return;
  const convId = getConversationId(fromEmail, toEmail);
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  
  // Save the message
  const msgRef = doc(db, 'conversations', convId, 'messages', msgId);
  await setDoc(msgRef, {
    id: msgId,
    from: fromEmail.toLowerCase().trim(),
    fromName: fromName,
    to: toEmail.toLowerCase().trim(),
    message: message,
    createdAt: Timestamp.now(),
    read: false,
  });

  // Update conversation metadata
  const convRef = doc(db, 'conversations', convId);
  await setDoc(convRef, {
    participants: [fromEmail.toLowerCase().trim(), toEmail.toLowerCase().trim()].sort(),
    lastMessage: message.slice(0, 100),
    lastMessageFrom: fromEmail.toLowerCase().trim(),
    lastMessageAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
};

/**
 * Get all conversations for a user.
 */
export const getUserConversations = async (email: string): Promise<{
  id: string;
  participants: string[];
  otherEmail: string;
  lastMessage: string;
  lastMessageFrom: string;
  lastMessageAt: Date;
}[]> => {
  if (!db) return [];
  const normalizedEmail = email.toLowerCase().trim();
  try {
    // Get all conversations and filter client-side
    const ref = collection(db, 'conversations');
    const snap = await getDocs(ref);
    
    const results = snap.docs
      .filter(d => {
        const data = d.data();
        return data.participants && Array.isArray(data.participants) && data.participants.includes(normalizedEmail);
      })
      .map(d => {
        const data = d.data();
        const otherEmail = data.participants.find((p: string) => p !== normalizedEmail) || '';
        return {
          id: d.id,
          participants: data.participants,
          otherEmail,
          lastMessage: data.lastMessage || '',
          lastMessageFrom: data.lastMessageFrom || '',
          lastMessageAt: data.lastMessageAt instanceof Timestamp ? data.lastMessageAt.toDate() : (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date()),
        };
      });
    
    // Sort by most recent first (client-side)
    results.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    return results;
  } catch (e) {
    console.error("FIREBASE: getUserConversations error:", e);
    return [];
  }
};

/**
 * Get messages in a conversation.
 */
export const getConversationMessages = async (fromEmail: string, toEmail: string): Promise<{
  id: string;
  from: string;
  fromName: string;
  to: string;
  message: string;
  createdAt: Date;
  read: boolean;
}[]> => {
  if (!db) return [];
  const convId = getConversationId(fromEmail, toEmail);
  const ref = collection(db, 'conversations', convId, 'messages');
  const q = query(ref, orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      from: data.from,
      fromName: data.fromName || data.from,
      to: data.to,
      message: data.message,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      read: data.read || false,
    };
  });
};

/**
 * Check if a user exists in the system.
 */
export const checkUserExists = async (email: string): Promise<boolean> => {
  if (!db) return false;
  const userRef = doc(db, 'users', email.toLowerCase().trim());
  const snap = await getDoc(userRef);
  return snap.exists();
};

/**
 * Save the full user learning context to Firebase.
 * Stored as a subcollection document for structured persistence.
 */
export const saveUserLearningContext = async (email: string, context: Record<string, any>) => {
  if (!db || !email) return;
  const contextRef = doc(db, 'users', email.toLowerCase(), 'private', 'learningContext');
  await setDoc(contextRef, { ...context, lastSynced: Timestamp.now() }, { merge: true });
};

/**
 * Load the full user learning context from Firebase.
 * Returns null if no context exists yet.
 */
export const getUserLearningContext = async (email: string): Promise<Record<string, any> | null> => {
  if (!db || !email) return null;
  const contextRef = doc(db, 'users', email.toLowerCase(), 'private', 'learningContext');
  const snap = await getDoc(contextRef);
  if (snap.exists()) {
    const data = snap.data();
    // Remove Firestore-specific fields before returning
    if (data.lastSynced) delete data.lastSynced;
    return data;
  }
  return null;
};
