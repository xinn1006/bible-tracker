// Firebase CDN Config and Database Manager

let app = null;
let db = null;
let auth = null;

let firebaseAppModule = null;
let firestoreModule = null;
let firebaseAuthModule = null;

// Default Firebase configuration
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDq5hfu0BpXV8SP_rRRyHtP44Tdc2Pkjhs",
  authDomain: "bibletracker-c0d57.firebaseapp.com",
  projectId: "bibletracker-c0d57",
  storageBucket: "bibletracker-c0d57.firebasestorage.app",
  messagingSenderId: "547826024961",
  appId: "1:547826024961:web:4da8aea7c7a17ac9657600",
  measurementId: "G-W40HP3GWK1"
};

// Initialize Firebase
export async function initializeDatabase() {
  try {
    firebaseAppModule = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js');
    firestoreModule = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js');
    firebaseAuthModule = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js');

    app = firebaseAppModule.initializeApp(DEFAULT_FIREBASE_CONFIG);
    db = firestoreModule.getFirestore(app);
    auth = firebaseAuthModule.getAuth(app);

    try {
      const analyticsModule = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js');
      analyticsModule.getAnalytics(app);
    } catch (anErr) {
      console.log("Analytics skipped.", anErr);
    }

    console.log("Firebase initialized. Project: " + DEFAULT_FIREBASE_CONFIG.projectId);
    return { success: true, mode: 'firebase' };
  } catch (e) {
    console.error("Firebase initialization failed.", e);
    return { success: false, error: e.message, mode: 'firebase' };
  }
}

// --- Firebase Authentication APIs ---
// Note: Anonymous (guest) sign-in has been removed. Only Google sign-in
// is supported, matching the Firestore security rules which require
// request.auth.token.firebase.sign_in_provider == 'google.com'.

export async function signInWithGoogle() {
  const { signInWithPopup, GoogleAuthProvider } = firebaseAuthModule;
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function signOutUser() {
  const { signOut } = firebaseAuthModule;
  await signOut(auth);
}

export function observeAuthState(callback) {
  const { onAuthStateChanged } = firebaseAuthModule;
  onAuthStateChanged(auth, callback);
}

export async function getUsers() {
  const { collection, getDocs } = firestoreModule;
  const usersCol = collection(db, 'users');
  const userSnapshot = await getDocs(usersCol);
  const userList = [];
  userSnapshot.forEach(docSnap => {
    userList.push({ id: docSnap.id, ...docSnap.data() });
  });
  return userList;
}

export async function saveUser(userData) {
  const { doc, setDoc, collection } = firestoreModule;
  const newId = userData.id || doc(collection(db, 'users')).id;
  const userRef = doc(db, 'users', newId);
  const newUser = { ...userData };
  delete newUser.id;
  await setDoc(userRef, newUser);
  return { id: newId, ...newUser };
}

// 更新使用者個人資料
export async function updateUserProfile(userId, profileData) {
  const { doc, updateDoc } = firestoreModule;
  const userRef = doc(db, 'users', userId);

  // 使用 updateDoc 確保只更新傳入的欄位，不會覆蓋原有資料
  await updateDoc(userRef, {
    name: profileData.name,
    avatar: profileData.avatar,
    lastUpdatedAt: new Date().toISOString()
  });

  return { id: userId, ...profileData };
}

export async function getDailyRecords(userId) {
  const { collection, getDocs } = firestoreModule;
  const recordsCol = collection(db, 'users', userId, 'daily_records');
  const querySnapshot = await getDocs(recordsCol);
  const records = [];
  querySnapshot.forEach(docSnap => {
    records.push(docSnap.data());
  });
  return records;
}

//Helper 函式用來處理字串去重
function mergeNames(oldStr = "", newStr = "") {
  oldStr = oldStr.trim();
  newStr = newStr.trim();

  if (!newStr) return oldStr;
  if (!oldStr) return newStr;

  const oldList = oldStr.split(',').map(s => s.trim());
  return oldList.includes(newStr) ? oldStr : `${oldStr}, ${newStr}`;
}

// 獲取使用者曾經輸入過的不重複書報名稱與聖經名稱清單
export async function getHistoricalNames(userId) {
  const { collection, getDocs } = firestoreModule;
  const recordsCol = collection(db, 'users', userId, 'daily_records');
  const querySnapshot = await getDocs(recordsCol);

  const bookNamesSet = new Set();
  const bibleNamesSet = new Set();

  querySnapshot.forEach(docSnap => {
    const data = docSnap.data();

    if (data.bookRecordName) {
      data.bookRecordName.split(',').forEach(s => {
        const trimmed = s.trim();
        if (trimmed) bookNamesSet.add(trimmed);
      });
    }

    if (data.bibleRecordName) {
      data.bibleRecordName.split(',').forEach(s => {
        const trimmed = s.trim();
        if (trimmed) bibleNamesSet.add(trimmed);
      });
    }
  });

  return {
    books: Array.from(bookNamesSet), // 回傳例如: ["晨興聖言", "生命讀經", "羅馬書結晶讀經"]
    bibles: Array.from(bibleNamesSet)
  };
}

export async function saveDailyRecord(userId, date, hasReadBible, hasReadBook, bookRecordName = "", bibleRecordName = "") {
  const { doc, setDoc, getDoc } = firestoreModule;
  const recordRef = doc(db, 'users', userId, 'daily_records', date);

  // 1. 取得當天的現有紀錄
  const docSnap = await getDoc(recordRef);
  const existing = docSnap.exists() ? docSnap.data() : {};

  // 2. 直接在 data 物件中進行合併與防呆
  const data = {
    userId,
    date,
    // 防呆：只要舊資料是 true 或新傳入是 true，結果就是 true
    hasReadBible: !!(existing.hasReadBible || hasReadBible),
    hasReadBook: !!(existing.hasReadBook || hasReadBook),

    // 呼叫函式處理書名與經卷名的合併與去重
    bookRecordName: mergeNames(existing.bookRecordName, bookRecordName),
    bibleRecordName: mergeNames(existing.bibleRecordName, bibleRecordName),

    lastUpdatedAt: new Date().toISOString()
  };
  // 3. 使用 merge: true 寫入，進一步確保不覆蓋到其他未來可能新增的欄位
  await setDoc(recordRef, data);
  return data;
}

export async function getBibleMatrix(userId) {
  const { collection, getDocs } = firestoreModule;
  const matrixCol = collection(db, 'users', userId, 'bible_matrix');
  const querySnapshot = await getDocs(matrixCol);
  const records = [];
  querySnapshot.forEach(docSnap => {
    records.push(docSnap.data());
  });
  return records;
}

export async function updateBibleChapter(userId, bookName, chapter, isRead) {
  const { doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc } = firestoreModule;
  const docRef = doc(db, 'users', userId, 'bible_matrix', bookName);

  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    const data = {
      userId,
      bookName,
      readChapters: isRead ? [chapter] : [],
      updatedAt: new Date().toISOString()
    };
    await setDoc(docRef, data);
    return data;
  } else {
    const updateData = {
      readChapters: isRead ? arrayUnion(chapter) : arrayRemove(chapter),
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, updateData);
    return updateData;
  }
}

export async function updateBibleChaptersBatch(userId, bookName, chapters, isRead) {
  const { doc, setDoc } = firestoreModule;
  const docRef = doc(db, 'users', userId, 'bible_matrix', bookName);

  const chaptersToSave = isRead ? chapters : [];
  const data = {
    userId,
    bookName,
    readChapters: chaptersToSave,
    updatedAt: new Date().toISOString()
  };
  await setDoc(docRef, data);
  return data;
}
