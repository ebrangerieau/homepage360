# 🔐 Documentation de Sécurité - Homepage360

Ce document décrit l'architecture de sécurité du système de monitoring réseau de Homepage360.

**Dernière mise à jour** : Janvier 2026  
**Version** : 2.2

> ⚠️ **Note** : Ce document est la version publique. Les paramètres de configuration spécifiques (seuils, timeouts, formats) sont documentés en interne uniquement.

---

## 📐 Architecture de Déploiement

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET (WAN)                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           SERVEUR HOMEPAGE360 (VPS/Cloud)                    │    │
│  │  ┌─────────────────┐    ┌────────────────────────────────┐  │    │
│  │  │  Express Server │◄───│ API sécurisée (HTTPS)          │  │    │
│  │  │                 │    │ • Authentification             │  │    │
│  │  │                 │    │ • Signature cryptographique    │  │    │
│  │  │                 │    │ • Protection anti-replay       │  │    │
│  │  └─────────────────┘    └────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              ▲                                       │
│                              │ HTTPS (TLS 1.2+)                      │
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
│  │  │   AGENT          │─ping──►│  Appareils à surveiller │    │    │
│  │  │                  │         │                         │    │    │
│  │  └──────────────────┘         └────────────────────────┘    │    │
│  │         │                                                    │    │
│  │         │ Connexion sortante uniquement                      │    │
│  └─────────┴───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✅ Mesures de Sécurité Implémentées

### Communication Réseau

| Protection | Description |
|------------|-------------|
| **Connexion sortante uniquement** | L'agent n'ouvre aucun port en écoute |
| **HTTPS obligatoire** | Chiffrement TLS de bout en bout |
| **Certificat vérifié** | Validation du certificat serveur |

### Authentification & Intégrité

| Protection | Description |
|------------|-------------|
| **Clé API** | Authentification par secret partagé |
| **Signature HMAC** | Intégrité cryptographique des données |
| **Protection anti-replay** | Les requêtes expirées sont rejetées |
| **Comparaison timing-safe** | Protection contre les attaques temporelles |
| **Rotation de clés** | Support de transition sans interruption |

### Protection contre les Abus

| Protection | Description |
|------------|-------------|
| **Rate limiting** | Limitation du nombre de requêtes |
| **Validation des entrées** | Vérification des types et formats |
| **Limitation de taille** | Rejet des payloads excessifs |

### Audit & Monitoring

| Protection | Description |
|------------|-------------|
| **Logging structuré** | Événements de sécurité au format JSON |
| **Alertes** | Tentatives d'accès non autorisées loguées |
| **Traçabilité** | Horodatage de toutes les opérations |

### Protection Frontend

| Protection | Description |
|------------|-------------|
| **Échappement XSS** | Toutes les données externes sont sanitizées |
| **Validation d'URLs** | Blocage des protocoles dangereux |
| **Validation d'imports** | Vérification de la structure des données |

---

## 📋 Checklist de Déploiement

### Obligatoire

- [ ] Générer une clé API forte (256 bits minimum)
- [ ] Configurer les variables d'environnement requises
- [ ] Vérifier la validité du certificat HTTPS
- [ ] Configurer le pare-feu (sortie HTTPS uniquement depuis le LAN)

### Recommandé

- [ ] Configurer la collecte centralisée des logs
- [ ] Planifier une rotation régulière des clés
- [ ] Configurer des alertes sur les événements de sécurité
- [ ] Documenter les procédures internes

### Variables d'Environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `MONITOR_API_KEY` | ✅ | Clé API principale |
| `MONITOR_API_KEY_PREVIOUS` | Non | Pour rotation de clés |
| `AGENT_API_KEY` | Non | Surcharge la config locale |
| `LOG_LEVEL` | Non | Niveau de verbosité des logs |

---

## 🔄 Rotation de Clés

Le système supporte une rotation de clés sans interruption de service :

1. Générer une nouvelle clé forte
2. Configurer le serveur avec la nouvelle ET l'ancienne clé
3. Mettre à jour progressivement les agents
4. Vérifier qu'aucun agent n'utilise l'ancienne clé
5. Retirer l'ancienne clé de la configuration

> 📖 La procédure détaillée est disponible dans la documentation interne.

---

## 🚨 Réponse aux Incidents

En cas de suspicion de compromission :

1. **Immédiat** : Révoquer la clé compromise
2. **Court terme** : Analyser les logs d'accès
3. **Moyen terme** : Identifier le vecteur d'attaque
4. **Long terme** : Renforcer les mesures si nécessaire

> 📖 Les procédures détaillées sont disponibles dans la documentation interne.

---

## 🎯 Conformité

| Standard | Compatibilité |
|----------|---------------|
| Usage interne PME | ✅ Adapté |
| ISO 27001 | ✅ Adapté avec logging structuré |
| SOC 2 Type I | ⚠️ Partiel |
| HIPAA / PCI-DSS | ❌ Non conçu pour ces usages |

---

## 📚 Références

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## 🔒 Signalement de Vulnérabilités

Si vous découvrez une vulnérabilité de sécurité, veuillez la signaler de manière responsable en contactant directement les mainteneurs du projet. Ne publiez pas les détails publiquement avant correction.

---

*Ce document est revu lors de chaque modification majeure de l'architecture de sécurité.*
