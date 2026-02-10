const crypto = require('crypto');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');

// Configuration des sessions
const SESSION_CONFIG = {
  sessionDuration: 24 * 60 * 60 * 1000, // 24 heures
  rememberMeDuration: 30 * 24 * 60 * 60 * 1000, // 30 jours
  inactivityTimeout: 4 * 60 * 60 * 1000, // 4 heures
  sessionCleanupInterval: 60 * 60 * 1000, // Nettoyage toutes les heures
  cookieName: 'homepage360_session',
  cookieSecure: process.env.NODE_ENV === 'production',
  cookieSameSite: 'strict'
};

// Configuration brute force protection
const BRUTE_FORCE_CONFIG = {
  maxAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  attemptWindow: 60 * 60 * 1000 // Fenêtre de 1 heure
};

// Stockage en mémoire
const sessions = new Map();
const loginAttempts = new Map();

// Chemin du fichier users.json
const USERS_FILE = path.join(__dirname, 'users.json');

/**
 * Hash un mot de passe avec bcrypt
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} Hash bcrypt
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Vérifie un mot de passe contre un hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash bcrypt
 * @returns {Promise<boolean>} True si le mot de passe correspond
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Génère un token de session sécurisé
 * @returns {string} Token aléatoire de 64 caractères hexadécimaux
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Charge les utilisateurs depuis users.json
 * @returns {Promise<Object>} Objet contenant le tableau users
 */
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Fichier n'existe pas, retourner structure vide
      return { users: [] };
    }
    throw error;
  }
}

/**
 * Sauvegarde les utilisateurs dans users.json
 * @param {Object} data - Objet contenant le tableau users
 */
async function saveUsers(data) {
  await fs.writeFile(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Trouve un utilisateur par username
 * @param {string} username
 * @returns {Promise<Object|null>} Utilisateur trouvé ou null
 */
async function findUser(username) {
  const data = await loadUsers();
  return data.users.find(u => u.username === username) || null;
}

/**
 * Met à jour le lastLogin d'un utilisateur
 * @param {string} username
 */
async function updateLastLogin(username) {
  const data = await loadUsers();
  const user = data.users.find(u => u.username === username);
  if (user) {
    user.lastLogin = new Date().toISOString();
    await saveUsers(data);
  }
}

/**
 * Vérifie les tentatives de connexion pour une IP
 * @param {string} ip
 * @returns {Object} { allowed: boolean, attemptsRemaining: number, lockedUntil: Date|null }
 */
function checkLoginAttempts(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip);

  if (!attempts) {
    return { allowed: true, attemptsRemaining: BRUTE_FORCE_CONFIG.maxAttempts };
  }

  // Vérifier si le compte est verrouillé
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    return {
      allowed: false,
      attemptsRemaining: 0,
      lockedUntil: new Date(attempts.lockedUntil)
    };
  }

  // Vérifier si la fenêtre de tentatives a expiré
  if (now - attempts.lastAttempt > BRUTE_FORCE_CONFIG.attemptWindow) {
    // Reset les tentatives
    loginAttempts.delete(ip);
    return { allowed: true, attemptsRemaining: BRUTE_FORCE_CONFIG.maxAttempts };
  }

  // Vérifier le nombre de tentatives
  if (attempts.count >= BRUTE_FORCE_CONFIG.maxAttempts) {
    const lockedUntil = attempts.lastAttempt + BRUTE_FORCE_CONFIG.lockoutDuration;
    if (now < lockedUntil) {
      return {
        allowed: false,
        attemptsRemaining: 0,
        lockedUntil: new Date(lockedUntil)
      };
    } else {
      // Le verrouillage a expiré, reset
      loginAttempts.delete(ip);
      return { allowed: true, attemptsRemaining: BRUTE_FORCE_CONFIG.maxAttempts };
    }
  }

  return {
    allowed: true,
    attemptsRemaining: BRUTE_FORCE_CONFIG.maxAttempts - attempts.count
  };
}

/**
 * Enregistre une tentative de connexion
 * @param {string} ip
 * @param {boolean} success - True si la connexion a réussi
 */
function recordLoginAttempt(ip, success) {
  const now = Date.now();

  if (success) {
    // Reset les tentatives en cas de succès
    loginAttempts.delete(ip);
    return;
  }

  // Incrémenter les tentatives échouées
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  attempts.count++;
  attempts.lastAttempt = now;

  // Si max attempts atteint, définir lockedUntil
  if (attempts.count >= BRUTE_FORCE_CONFIG.maxAttempts) {
    attempts.lockedUntil = now + BRUTE_FORCE_CONFIG.lockoutDuration;
  }

  loginAttempts.set(ip, attempts);
}

/**
 * Crée une nouvelle session
 * @param {string} username
 * @param {boolean} rememberMe
 * @param {string} ip
 * @returns {string} Session token
 */
function createSession(username, rememberMe, ip) {
  const token = generateSessionToken();
  const now = Date.now();
  const duration = rememberMe ? SESSION_CONFIG.rememberMeDuration : SESSION_CONFIG.sessionDuration;

  sessions.set(token, {
    username,
    createdAt: now,
    expiresAt: now + duration,
    lastActivity: now,
    ip
  });

  return token;
}

/**
 * Valide une session existante
 * @param {string} token
 * @returns {Object|null} { username, valid: boolean, reason?: string }
 */
function validateSession(token) {
  if (!token) {
    return { valid: false, reason: 'no_token' };
  }

  const session = sessions.get(token);
  if (!session) {
    return { valid: false, reason: 'invalid_token' };
  }

  const now = Date.now();

  // Vérifier l'expiration
  if (now > session.expiresAt) {
    sessions.delete(token);
    return { valid: false, reason: 'expired', username: session.username };
  }

  // Vérifier le timeout d'inactivité
  if (now - session.lastActivity > SESSION_CONFIG.inactivityTimeout) {
    sessions.delete(token);
    return { valid: false, reason: 'inactivity', username: session.username };
  }

  // Mettre à jour lastActivity
  session.lastActivity = now;

  return { valid: true, username: session.username };
}

/**
 * Invalide une session (logout)
 * @param {string} token
 * @returns {boolean} True si la session existait
 */
function invalidateSession(token) {
  return sessions.delete(token);
}

/**
 * Nettoie les sessions expirées
 */
function cleanupSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt || (now - session.lastActivity > SESSION_CONFIG.inactivityTimeout)) {
      sessions.delete(token);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[${new Date().toISOString()}] Cleaned ${cleaned} expired sessions`);
  }
}

// Démarrer le nettoyage périodique des sessions
setInterval(cleanupSessions, SESSION_CONFIG.sessionCleanupInterval);

/**
 * Route de login
 */
async function login(req, res, log) {
  const { username, password, rememberMe = false } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  // Vérifier les tentatives de connexion
  const attemptCheck = checkLoginAttempts(ip);
  if (!attemptCheck.allowed) {
    log('WARN', 'Account locked', {
      ip,
      lockedUntil: attemptCheck.lockedUntil.toISOString()
    });

    return res.status(429).json({
      error: 'Too many failed attempts. Account locked.',
      lockedUntil: attemptCheck.lockedUntil.toISOString()
    });
  }

  // Valider les champs requis
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Trouver l'utilisateur
    const user = await findUser(username);
    if (!user) {
      console.log(`[DEBUG] User not found: ${username}`);
      recordLoginAttempt(ip, false);
      log('WARN', 'Failed login attempt', {
        username,
        ip,
        reason: 'user_not_found',
        attemptsRemaining: attemptCheck.attemptsRemaining - 1
      });

      return res.status(401).json({
        error: 'Invalid username or password',
        attemptsRemaining: attemptCheck.attemptsRemaining - 1
      });
    }

    console.log(`[DEBUG] User found: ${username}, hash: ${user.passwordHash}`);
    // Vérifier le mot de passe
    const passwordValid = await verifyPassword(password, user.passwordHash);
    console.log(`[DEBUG] Password check for ${username}: ${passwordValid}`);
    if (!passwordValid) {
      recordLoginAttempt(ip, false);
      log('WARN', 'Failed login attempt', {
        username,
        ip,
        reason: 'invalid_password',
        attemptsRemaining: attemptCheck.attemptsRemaining - 1
      });

      return res.status(401).json({
        error: 'Invalid username or password',
        attemptsRemaining: attemptCheck.attemptsRemaining - 1
      });
    }

    // Créer la session
    const token = createSession(username, rememberMe, ip);
    const session = sessions.get(token);

    // Mettre à jour lastLogin
    await updateLastLogin(username);

    // Reset les tentatives
    recordLoginAttempt(ip, true);

    // Définir le cookie
    const maxAge = rememberMe ? SESSION_CONFIG.rememberMeDuration : SESSION_CONFIG.sessionDuration;
    res.cookie(SESSION_CONFIG.cookieName, token, {
      httpOnly: true,
      secure: SESSION_CONFIG.cookieSecure,
      sameSite: SESSION_CONFIG.cookieSameSite,
      maxAge
    });

    log('INFO', 'User logged in', {
      username,
      ip,
      sessionId: token.substring(0, 8) + '...',
      rememberMe,
      expiresAt: new Date(session.expiresAt).toISOString()
    });

    res.json({ success: true, username });
  } catch (error) {
    log('ERROR', 'Login error', {
      username,
      ip,
      error: error.message
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Route de logout
 */
function logout(req, res, log) {
  const token = req.cookies[SESSION_CONFIG.cookieName];
  const session = token ? sessions.get(token) : null;

  if (session) {
    invalidateSession(token);
    log('INFO', 'User logged out', {
      username: session.username,
      sessionId: token.substring(0, 8) + '...',
      ip: req.ip || req.connection.remoteAddress
    });
  }

  res.clearCookie(SESSION_CONFIG.cookieName);
  res.json({ success: true });
}

/**
 * Route de vérification de session
 */
function checkSession(req, res) {
  // Si on arrive ici, c'est que le middleware requireAuth a validé la session
  res.json({ valid: true, username: req.username });
}

module.exports = {
  SESSION_CONFIG,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  createSession,
  validateSession,
  invalidateSession,
  checkLoginAttempts,
  recordLoginAttempt,
  loadUsers,
  findUser,
  login,
  logout,
  checkSession
};
