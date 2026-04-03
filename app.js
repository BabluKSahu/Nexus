// ============================================================
// NEXUS COMMUNITY - Modular Architecture
// Database Layer - IndexedDB Management
// ============================================================
const DatabaseManager = (() => {
    const DB_NAME = 'NexusCommunity';
    const DB_VERSION = 3;
    let db = null;

    const init = () => {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const database = e.target.result;
                const stores = ['users', 'communities', 'posts', 'comments', 'votes', 'memberships', 'saves'];
                stores.forEach(name => {
                    if (!database.objectStoreNames.contains(name)) {
                        const store = database.createObjectStore(name, { keyPath: 'id' });
                        if (name === 'users') {
                            store.createIndex('username', 'username', { unique: true });
                            store.createIndex('email', 'email', { unique: true });
                        }
                        if (name === 'communities') store.createIndex('name', 'name', { unique: true });
                        if (name === 'posts') {
                            store.createIndex('communityId', 'communityId', { unique: false });
                            store.createIndex('authorId', 'authorId', { unique: false });
                        }
                        if (name === 'comments') {
                            store.createIndex('postId', 'postId', { unique: false });
                            store.createIndex('parentId', 'parentId', { unique: false });
                        }
                        if (name === 'votes') store.createIndex('userId_targetId_targetType', ['userId', 'targetId', 'targetType'], { unique: true });
                        if (name === 'memberships') store.createIndex('userId_communityId', ['userId', 'communityId'], { unique: true });
                        if (name === 'saves') store.createIndex('userId_postId', ['userId', 'postId'], { unique: true });
                    }
                });
            };

            req.onsuccess = (e) => {
                db = e.target.result;
                resolve();
            };

            req.onerror = (e) => reject(e.target.error);
        });
    };

    const put = (store, data) => {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store, 'readwrite').objectStore(store).put(data);
            req.onsuccess = () => resolve(data);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const get = (store, id) => {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store).objectStore(store).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const getAll = (store) => {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store).objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const getByIndex = (store, idx, val) => {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store).objectStore(store).index(idx).getAll(val);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const getOneByIndex = (store, idx, val) => {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store).objectStore(store).index(idx).get(val);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const deleteRecord = (store, id) => {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store, 'readwrite').objectStore(store).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    };

    const count = (store) => {
        return new Promise((resolve, reject) => {
            const req = db.transaction(store).objectStore(store).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    };

    return { init, put, get, getAll, getByIndex, getOneByIndex, deleteRecord, count };
})();

const Utils = (() => {
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

    const timeAgo = (ts) => {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return 'just now';
        const m = Math.floor(s / 60);
        if (m < 60) return m + 'm ago';
        const h = Math.floor(m / 60);
        if (h < 24) return h + 'h ago';
        const d = Math.floor(h / 24);
        if (d < 30) return d + 'd ago';
        const mo = Math.floor(d / 30);
        if (mo < 12) return mo + 'mo ago';
        return Math.floor(mo / 12) + 'y ago';
    };

    const escapeHtml = (t) => {
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    };

    const avatarColor = (name) => {
        let h = 0;
        for (let i = 0; i < name.length; i++) {
            h = name.charCodeAt(i) + ((h << 5) - h);
        }
        const c = ['#FF6B35', '#00D4AA', '#6C5CE7', '#FD79A8', '#00B894', '#E17055', '#0984E3', '#FDCB6E', '#E84393', '#55A3F0'];
        return c[Math.abs(h) % c.length];
    };

    const hashPwd = async (pwd, salt) => {
        const enc = new TextEncoder();
        const data = enc.encode(salt + pwd);
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    return { uid, timeAgo, escapeHtml, avatarColor, hashPwd };
})();

const AuthManager = (() => {
    let currentUser = null;

    const register = async (username, email, password) => {
        if (!username || username.length < 3) throw new Error('Username must be at least 3 characters');
        if (!/^[a-zA-Z0-9_]+$/.test(username)) throw new Error('Username can only contain letters, numbers, and underscores');
        if (!email || !email.includes('@')) throw new Error('Valid email required');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');

        const existing = await DatabaseManager.getOneByIndex('users', 'username', username);
        if (existing) throw new Error('Username already taken');

        const salt = Utils.uid();
        const hash = await Utils.hashPwd(password, salt);
        const user = { id: Utils.uid(), username, email, passwordHash: hash, salt, avatar: '', bio: '', karma: 1, createdAt: Date.now() };
        await DatabaseManager.put('users', user);
        localStorage.setItem('nexus_session', user.id);
        currentUser = user;
        return user;
    };

    const login = async (username, password) => {
        const user = await DatabaseManager.getOneByIndex('users', 'username', username);
        if (!user) throw new Error('User not found');

        const hash = await Utils.hashPwd(password, user.salt);
        if (hash !== user.passwordHash) throw new Error('Incorrect password');

        localStorage.setItem('nexus_session', user.id);
        currentUser = user;
        return user;
    };

    const logout = () => {
        localStorage.removeItem('nexus_session');
        currentUser = null;
    };

    const restoreSession = async () => {
        const sid = localStorage.getItem('nexus_session');
        if (!sid) return null;
        const user = await DatabaseManager.get('users', sid);
        if (user) {
            currentUser = user;
            return user;
        }
        localStorage.removeItem('nexus_session');
        return null;
    };

    const getCurrentUser = () => currentUser;

    return { register, login, logout, restoreSession, getCurrentUser };
})();

const App = (() => {
    const init = async () => {
        try {
            await DatabaseManager.init();
            await AuthManager.restoreSession();
            console.log('Nexus Community App initialized');
        } catch (error) {
            console.error('Init error:', error);
        }
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
