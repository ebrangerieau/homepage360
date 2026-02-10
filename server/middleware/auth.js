const crypto = require('crypto');
const { SESSION_CONFIG, validateSession } = require('../auth');

/**
 * Middleware d'authentification
 * Vérifie la présence et la validité d'une session
 * Redirige vers /login.html si non authentifié
 */
function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_CONFIG.cookieName];

  // Valider la session
  const validation = validateSession(token);

  if (!validation.valid) {
    // Log selon la raison
    if (validation.reason === 'expired' || validation.reason === 'inactivity') {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Session expired',
        data: {
          sessionId: token ? token.substring(0, 8) + '...' : 'none',
          username: validation.username,
          reason: validation.reason,
          ip: req.ip || req.connection.remoteAddress
        }
      }));
    }

    // Si c'est une requête API, retourner 401
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Sinon rediriger vers la page de login
    return res.redirect('/login.html');
  }

  // Session valide, ajouter le username à la requête
  req.username = validation.username;
  next();
}

module.exports = { requireAuth };
