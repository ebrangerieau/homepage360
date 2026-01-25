# 🔐 Documentation de Sécurité - Homepage360

Ce document décrit l'architecture de sécurité du système de monitoring réseau de Homepage360, avec une analyse des risques et des recommandations pour un déploiement en production.

**Dernière mise à jour** : Janvier 2026  
**Version** : 2.2

---

## 📐 Architecture de Déploiement

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET (WAN)                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           SERVEUR HOMEPAGE360 (VPS/Cloud)                    │    │
│  │  ┌─────────────────┐    ┌────────────────────────────────┐  │    │
│  │  │  Express Server │◄───│ POST /api/status               │  │    │
│  │  │   Port 3000     │    │ + X-API-Key                    │  │    │
│  │  │                 │    │ + X-Signature (HMAC-SHA256)    │  │    │
│  │  │                 │    │ + X-Timestamp                  │  │    │
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

### Flux de données sécurisé

1. **L'agent** (LAN) effectue des pings ICMP vers les appareils locaux
2. **L'agent** signe le payload avec HMAC-SHA256 et l'envoie via HTTPS
3. **Le serveur** vérifie la signature, valide les données et stocke les statuts
4. **Le frontend** récupère les statuts via GET /api/status

---

## ✅ Mesures de Sécurité Implémentées

### 1. Communication Sortante Uniquement (Outbound Only)

L'agent n'ouvre aucun port en écoute sur le LAN. Seule une connexion HTTPS sortante est établie.

| Avantage | Description |
|----------|-------------|
| Pas de port ouvert | L'agent n'expose aucun service sur le LAN |
| Pare-feu simplifié | Seul le trafic sortant HTTPS (443) est requis |
| Surface d'attaque réduite | Aucune connexion entrante depuis Internet vers le LAN |
| Modèle "Push" | L'agent initie toujours la connexion |

---

### 2. Signature HMAC des Payloads ✨ NOUVEAU

**Fichiers** : `agent/agent.js`, `server/index.js`

Chaque requête de l'agent vers le serveur est signée cryptographiquement :

```javascript
// Agent - Signature du payload
function signPayload(payload, secret) {
    const payloadString = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const signatureData = `${timestamp}.${payloadString}`;
    
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signatureData)
        .digest('hex');
    
    return { signature, timestamp, payloadString };
}

// Headers envoyés
headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
    'X-Signature': signature,    // HMAC-SHA256
    'X-Timestamp': timestamp     // Anti-replay
}
```

```javascript
// Serveur - Vérification de la signature
function verifySignature(req, res, next) {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    // Vérification anti-replay (fenêtre de 5 minutes)
    const requestTime = parseInt(timestamp);
    if (Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
        return res.status(401).json({ error: 'Signature timestamp expired' });
    }
    
    // Vérification HMAC avec timing-safe comparison
    const expectedSignature = crypto
        .createHmac('sha256', API_KEY)
        .update(`${timestamp}.${JSON.stringify(req.body)}`)
        .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
}
```

| Protection | Description |
|------------|-------------|
| Intégrité des données | Impossible de modifier le payload sans invalidation |
| Anti-replay | Timestamp avec fenêtre de 5 minutes |
| Timing-safe | Protection contre les attaques temporelles |

---

### 3. Rotation de Clés API ✨ NOUVEAU

**Fichier** : `server/index.js`

Le serveur supporte deux clés simultanément pour permettre une rotation sans interruption de service :

```javascript
const API_KEY = process.env.MONITOR_API_KEY;
const API_KEY_PREVIOUS = process.env.MONITOR_API_KEY_PREVIOUS; // Pour rotation

// Les deux clés sont valides pendant la période de transition
const validApiKeys = [API_KEY, API_KEY_PREVIOUS].filter(Boolean);
```

#### Procédure de rotation sans interruption

```bash
# 1. Générer une nouvelle clé
NEW_KEY=$(openssl rand -hex 32)

# 2. Mettre à jour le serveur avec les deux clés
export MONITOR_API_KEY="$NEW_KEY"
export MONITOR_API_KEY_PREVIOUS="ancienne-clé"
docker-compose up -d

# 3. Mettre à jour tous les agents avec la nouvelle clé
export AGENT_API_KEY="$NEW_KEY"
docker-compose -f agent/docker-compose.yml up -d

# 4. Après confirmation, supprimer l'ancienne clé
unset MONITOR_API_KEY_PREVIOUS
docker-compose up -d
```

| Avantage | Description |
|----------|-------------|
| Zero downtime | Deux clés acceptées pendant la transition |
| Rollback facile | L'ancienne clé reste valide temporairement |
| Monitoring | Les logs indiquent si une requête utilise l'ancienne clé |

---

### 4. Logging Structuré ✨ NOUVEAU

**Fichiers** : `agent/agent.js`, `server/index.js`

Tous les événements de sécurité sont enregistrés au format JSON structuré :

```javascript
function log(level, message, data = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        service: 'homepage360-server',
        message,
        ...data
    };
    console.log(JSON.stringify(logEntry));
}
```

#### Exemples de logs

```json
// Démarrage du serveur
{"timestamp":"2026-01-25T12:00:00.000Z","level":"INFO","service":"homepage360-server","message":"Server started","port":3000,"keyRotationEnabled":true,"hmacEnabled":true}

// Mise à jour reçue (succès)
{"timestamp":"2026-01-25T12:01:00.000Z","level":"INFO","service":"homepage360-server","message":"Status update received","validCount":5,"totalCount":5,"signatureVerified":true,"ip":"::1"}

// Tentative d'accès non autorisée
{"timestamp":"2026-01-25T12:02:00.000Z","level":"WARN","service":"homepage360-server","message":"Unauthorized API access attempt","ip":"192.168.1.100","path":"/api/status","userAgent":"curl/7.68.0"}

// Signature invalide
{"timestamp":"2026-01-25T12:03:00.000Z","level":"WARN","service":"homepage360-server","message":"Invalid HMAC signature","ip":"192.168.1.100","path":"/api/status"}
```

| Niveau | Usage |
|--------|-------|
| DEBUG | Détails de débogage (désactivé par défaut) |
| INFO | Opérations normales |
| WARN | Alertes de sécurité (attempts échoués) |
| ERROR | Erreurs critiques |

**Configuration** : `LOG_LEVEL=DEBUG` pour activer tous les logs.

---

### 5. Authentification par Clé API

**Fichier** : `server/index.js`

```javascript
const validateApiKey = (req, res, next) => {
    const providedKey = req.headers['x-api-key'];
    
    if (!providedKey || !validApiKeys.includes(providedKey)) {
        log('WARN', 'Unauthorized API access attempt', {
            ip: req.ip,
            path: req.path,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    
    // Monitoring de l'ancienne clé
    req.usingPreviousKey = (providedKey === API_KEY_PREVIOUS);
    
    next();
};
```

| Caractéristique | Valeur |
|-----------------|--------|
| Longueur de clé | 256 bits (64 caractères hex) |
| Génération | `openssl rand -hex 32` |
| Transmission | Header HTTP `X-API-Key` |
| Multi-clés | Supporte clé actuelle + précédente |

---

### 6. HTTPS Obligatoire

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

---

### 7. Validation des Entrées

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
| Taille payload | Max 10 KB |

---

### 8. Rate Limiting

**Fichier** : `server/index.js`

| Paramètre | Valeur |
|-----------|--------|
| Fenêtre | 60 secondes |
| Limite | 60 requêtes par IP |
| Code de réponse | 429 Too Many Requests |

---

### 9. Protection Path Traversal (Agent)

```javascript
const resolvedPath = path.resolve(configPath);
const allowedDir = path.resolve(__dirname);

if (!resolvedPath.startsWith(allowedDir)) {
    console.error('❌ CONFIG_PATH must be within the agent directory');
    process.exit(1);
}
```

---

### 10. Protection XSS (Frontend)

**Fichier** : `js/modules/ui.js`

Toutes les données affichées sont échappées via `escapeHtml()`.

---

## 📊 Tableau Récapitulatif des Protections

| Menace | Protection | Status |
|--------|------------|--------|
| Interception réseau | HTTPS / TLS | ✅ Implémenté |
| Clé API compromise | Signature HMAC + Rotation | ✅ Implémenté |
| Replay attack | Timestamp avec fenêtre 5min | ✅ Implémenté |
| Falsification données | HMAC-SHA256 | ✅ Implémenté |
| Brute force | Rate limiting | ✅ Implémenté |
| Injection | Validation entrées | ✅ Implémenté |
| XSS | Échappement HTML | ✅ Implémenté |
| Path traversal | Validation chemin | ✅ Implémenté |
| Timing attack | crypto.timingSafeEqual | ✅ Implémenté |
| Audit trail | Logging structuré JSON | ✅ Implémenté |

---

## 📋 Checklist de Déploiement Production

### Obligatoire

- [ ] Générer une clé API forte : `openssl rand -hex 32`
- [ ] Configurer `MONITOR_API_KEY` sur le serveur
- [ ] Configurer la même clé dans l'agent (`AGENT_API_KEY` ou `config.json`)
- [ ] Vérifier que le serveur utilise HTTPS
- [ ] Configurer le pare-feu LAN (sortie HTTPS uniquement)

### Recommandé

- [ ] Configurer la collecte de logs (ELK, Loki, CloudWatch...)
- [ ] Planifier la rotation de clé trimestrielle
- [ ] Configurer des alertes sur les logs WARN
- [ ] Documenter la procédure de révocation

### Variables d'Environnement

| Variable | Service | Obligatoire | Description |
|----------|---------|-------------|-------------|
| `MONITOR_API_KEY` | Serveur | ✅ Oui | Clé API principale |
| `MONITOR_API_KEY_PREVIOUS` | Serveur | Non | Clé précédente (rotation) |
| `AGENT_API_KEY` | Agent | Non | Surcharge la clé du config.json |
| `LOG_LEVEL` | Les deux | Non | DEBUG, INFO, WARN, ERROR |
| `CONFIG_PATH` | Agent | Non | Chemin vers config.json |

---

## 🎯 Évaluation de Conformité (v2.2)

| Standard | Compatibilité | Notes |
|----------|---------------|-------|
| **Usage interne PME** | ✅ Adapté | Configuration standard |
| **ISO 27001** | ✅ Adapté | Logging structuré, rotation des clés |
| **SOC 2** | ⚠️ Partiel | Nécessite mTLS pour Type II |
| **HIPAA** | ❌ Non adapté | Données de santé requièrent chiffrement au repos |
| **PCI-DSS** | ❌ Non adapté | Pas conçu pour données de paiement |

---

## 🔄 Procédure de Rotation de Clé API

### Rotation planifiée (sans interruption)

```bash
# Étape 1 : Générer nouvelle clé
NEW_KEY=$(openssl rand -hex 32)
echo "Nouvelle clé: $NEW_KEY"

# Étape 2 : Déployer le serveur avec les deux clés
export MONITOR_API_KEY="$NEW_KEY"
export MONITOR_API_KEY_PREVIOUS="$CURRENT_KEY"  # Ancien clé
docker-compose up -d

# Étape 3 : Mettre à jour chaque agent
export AGENT_API_KEY="$NEW_KEY"
docker-compose -f agent/docker-compose.yml up -d

# Étape 4 : Vérifier les logs (aucun usingPreviousKey:true)
docker logs homepage360 --since 5m | grep usingPreviousKey

# Étape 5 : Supprimer l'ancienne clé après vérification
unset MONITOR_API_KEY_PREVIOUS
docker-compose up -d
```

### Rotation d'urgence (clé compromise)

```bash
# Étape 1 : Générer et déployer immédiatement (sans période de grâce)
NEW_KEY=$(openssl rand -hex 32)
export MONITOR_API_KEY="$NEW_KEY"
docker-compose up -d  # L'ancienne clé est immédiatement invalide

# Étape 2 : Mettre à jour les agents en urgence
# (Ils seront en erreur jusqu'à la mise à jour)

# Étape 3 : Analyser les logs pour identifier l'abus
docker logs homepage360 --since 24h | grep -E "(WARN|ERROR)"
```

---

## 🚨 Procédure en Cas de Compromission

### Si la clé API est compromise :

1. **Immédiat** (< 5 min)
   - Générer et déployer une nouvelle clé sur le serveur
   - Les requêtes avec l'ancienne clé seront rejetées

2. **Court terme** (< 1 heure)
   - Mettre à jour tous les agents
   - Vérifier les logs pour identifier les accès non autorisés

3. **Analyse** (< 24 heures)
   - Identifier comment la clé a été compromise
   - Documenter l'incident

4. **Remédiation**
   - Corriger la vulnérabilité identifiée
   - Renforcer les procédures si nécessaire

---

## 📚 Références

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [HMAC (RFC 2104)](https://datatracker.ietf.org/doc/html/rfc2104)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)

---

*Ce document doit être revu et mis à jour lors de chaque modification majeure de l'architecture de sécurité.*
