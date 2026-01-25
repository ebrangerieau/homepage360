# 🔐 Documentation de Sécurité - Homepage360

Ce document décrit l'architecture de sécurité du système de monitoring réseau de Homepage360, avec une analyse des risques et des recommandations pour un déploiement en production.

**Dernière mise à jour** : Janvier 2026  
**Version** : 2.1

---

## 📐 Architecture de Déploiement

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET (WAN)                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           SERVEUR HOMEPAGE360 (VPS/Cloud)                    │    │
│  │  ┌─────────────────┐    ┌────────────────────────────────┐  │    │
│  │  │  Express Server │◄───│ POST /api/status (clé API)     │  │    │
│  │  │   Port 3000     │    │ Reçoit les statuts des agents  │  │    │
│  │  └─────────────────┘    └────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ▲                                       │
│                              │ HTTPS (TLS 1.2/1.3)                   │
│                              │                                       │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    PARE-FEU  │                                       │
│                   (Firewall) ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    RÉSEAU LOCAL (LAN)                        │    │
│  │                                                              │    │
│  │  ┌──────────────────┐         ┌────────────────────────┐    │    │
│  │  │   AGENT Docker   │─ping──►│  Appareils à surveiller │    │    │
│  │  │   (node agent.js)│         │  - Routeur 192.168.1.1  │    │    │
│  │  │                  │         │  - NAS 192.168.1.10     │    │    │
│  │  └──────────────────┘         │  - Serveurs, IoT...     │    │    │
│  │         │                     └────────────────────────┘    │    │
│  │         │ Sortie uniquement (HTTPS vers le WAN)             │    │
│  └─────────┴───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Flux de données

1. **L'agent** (LAN) effectue des pings ICMP vers les appareils locaux
2. **L'agent** envoie les résultats via HTTPS POST vers le serveur (WAN)
3. **Le serveur** stocke les statuts en mémoire
4. **Le frontend** récupère les statuts via GET /api/status

---

## ✅ Mesures de Sécurité Implémentées

### 1. Communication Sortante Uniquement (Outbound Only)

**Fichier** : `agent/agent.js`

```javascript
const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: JSON.stringify({ statuses })
});
```

| Avantage | Description |
|----------|-------------|
| Pas de port ouvert | L'agent n'ouvre aucun port en écoute sur le LAN |
| Pare-feu simplifié | Seul le trafic sortant HTTPS (443) est requis |
| Surface d'attaque réduite | Aucune connexion entrante depuis Internet vers le LAN |
| Modèle "Push" | L'agent initie toujours la connexion |

### 2. Authentification par Clé API

**Fichier** : `server/index.js`

```javascript
const API_KEY = process.env.MONITOR_API_KEY;
if (!API_KEY) {
    console.error('❌ FATAL: MONITOR_API_KEY must be set');
    process.exit(1);
}

const validateApiKey = (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== API_KEY) {
        console.warn(`[${new Date().toISOString()}] Unauthorized attempt from ${req.ip}`);
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
};
```

| Caractéristique | Valeur |
|-----------------|--------|
| Longueur de clé | 256 bits (64 caractères hex) |
| Génération | `openssl rand -hex 32` |
| Transmission | Header HTTP `X-API-Key` |
| Stockage | Variable d'environnement (pas dans le code) |

### 3. HTTPS Obligatoire

**Fichier** : `agent/agent.js`

```javascript
if (!endpoint.startsWith('https://') && !endpoint.includes('localhost')) {
    console.error('❌ Endpoint must use HTTPS in production');
    process.exit(1);
}
```

| Protection | Description |
|------------|-------------|
| Chiffrement TLS | Données chiffrées de bout en bout |
| Confidentialité | La clé API ne transite jamais en clair |
| Intégrité | Protection contre la modification en transit |
| Authenticité | Certificat serveur vérifié |

### 4. Validation des Entrées

**Fichier** : `server/index.js`

```javascript
function validateDeviceStatus(status) {
    if (!status || typeof status !== 'object') return false;
    if (typeof status.name !== 'string' || status.name.length > 100) return false;
    if (typeof status.host !== 'string' || status.host.length > 255) return false;
    if (typeof status.alive !== 'boolean') return false;
    if (status.latency !== null && status.latency !== undefined) {
        if (typeof status.latency !== 'number' || status.latency < 0 || status.latency > 99999) return false;
    }
    return true;
}
```

| Validation | Limite |
|------------|--------|
| Nom d'appareil | Max 100 caractères, type string |
| Host | Max 255 caractères, type string |
| État | Boolean uniquement |
| Latence | Nombre entre 0 et 99999 |
| Nombre d'appareils | Max 100 par requête |

### 5. Rate Limiting

**Fichier** : `server/index.js`

```javascript
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requêtes/minute

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    // ... logique de limitation
    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    next();
}
```

| Paramètre | Valeur |
|-----------|--------|
| Fenêtre | 60 secondes |
| Limite | 60 requêtes par IP |
| Code de réponse | 429 Too Many Requests |

### 6. Protection Path Traversal (Agent)

**Fichier** : `agent/agent.js`

```javascript
const resolvedPath = path.resolve(configPath);
const allowedDir = path.resolve(__dirname);

if (!resolvedPath.startsWith(allowedDir)) {
    console.error('❌ CONFIG_PATH must be within the agent directory');
    process.exit(1);
}
```

### 7. Protection XSS (Frontend)

**Fichier** : `js/modules/ui.js`

```javascript
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') return String(str);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```

---

## ⚠️ Limitations Connues

### 1. Clé API Statique

| Aspect | État actuel | Risque |
|--------|-------------|--------|
| Type de clé | Statique | 🟡 Moyen |
| Rotation | Manuelle | Compromission = accès jusqu'à rotation |
| Révocation | Requiert redémarrage | Temps de réaction lent |

**Mitigation recommandée** : Rotation trimestrielle de la clé API.

### 2. Pas de Mutual TLS (mTLS)

| Aspect | État actuel |
|--------|-------------|
| Authentification serveur | ✅ Certificat HTTPS |
| Authentification client | ❌ Clé API uniquement |

L'agent n'est pas authentifié par certificat client. Un attaquant avec la clé API peut se faire passer pour un agent légitime.

### 3. Pas de Signature des Payloads

Les données envoyées ne sont pas signées cryptographiquement. Si la clé API est compromise, un attaquant peut envoyer des données falsifiées.

**Amélioration possible** :
```javascript
const crypto = require('crypto');
const signature = crypto.createHmac('sha256', apiKey)
    .update(JSON.stringify(statuses))
    .digest('hex');
headers['X-Signature'] = signature;
```

### 4. Stockage en Mémoire

Les statuts des appareils sont stockés en mémoire RAM sur le serveur. Un redémarrage efface toutes les données.

### 5. Logs d'Audit Basiques

Le système de logging actuel est minimal. Pour un environnement de production sensible, un logging structuré est recommandé.

---

## 📋 Checklist de Déploiement Production

### Obligatoire

- [ ] Générer une clé API forte : `openssl rand -hex 32`
- [ ] Configurer la variable `MONITOR_API_KEY` sur le serveur
- [ ] Configurer la même clé dans `agent/config.json` ou `AGENT_API_KEY`
- [ ] Vérifier que le serveur utilise HTTPS (certificat valide)
- [ ] Configurer le pare-feu LAN (autoriser sortie HTTPS uniquement)

### Recommandé

- [ ] Activer les logs d'accès serveur (reverse proxy)
- [ ] Configurer un monitoring du serveur (uptime)
- [ ] Planifier la rotation de la clé API (calendrier)
- [ ] Documenter la procédure de révocation en cas de compromission

### Optionnel (Environnements Sensibles)

- [ ] Implémenter mTLS avec certificat client
- [ ] Ajouter signature HMAC des payloads
- [ ] Configurer un SIEM pour les logs
- [ ] Mettre en place des alertes sur les tentatives d'authentification échouées

---

## 🎯 Évaluation de Conformité

| Standard | Compatibilité | Notes |
|----------|---------------|-------|
| **Usage interne PME** | ✅ Adapté | Configuration standard |
| **ISO 27001** | ⚠️ Partiel | Nécessite logging structuré et procédures documentées |
| **SOC 2** | ⚠️ Partiel | Nécessite traçabilité complète et mTLS |
| **HIPAA** | ❌ Non adapté | Données de santé requièrent chiffrement au repos |
| **PCI-DSS** | ❌ Non adapté | Pas conçu pour données de paiement |

---

## 🔄 Procédure de Rotation de Clé API

### Étape 1 : Génération d'une nouvelle clé
```bash
openssl rand -hex 32 > new_api_key.txt
cat new_api_key.txt
```

### Étape 2 : Mise à jour du serveur
```bash
# Sur le serveur WAN
export MONITOR_API_KEY="nouvelle-clé-ici"
docker-compose down && docker-compose up -d
```

### Étape 3 : Mise à jour de l'agent
```bash
# Sur le LAN
# Modifier agent/config.json OU
export AGENT_API_KEY="nouvelle-clé-ici"
docker-compose -f agent/docker-compose.yml restart
```

### Étape 4 : Vérification
```bash
# Vérifier les logs serveur
docker logs homepage360 | tail -20
```

---

## 🚨 Procédure en Cas de Compromission

### Si la clé API est compromise :

1. **Immédiat** : Générer et déployer une nouvelle clé (voir procédure ci-dessus)
2. **Audit** : Vérifier les logs pour identifier les accès non autorisés
3. **Analyse** : Déterminer comment la clé a été compromise
4. **Correction** : Corriger la vulnérabilité identifiée
5. **Documentation** : Documenter l'incident

---

## 📚 Références

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)

---

*Ce document doit être revu et mis à jour lors de chaque modification majeure de l'architecture de sécurité.*
