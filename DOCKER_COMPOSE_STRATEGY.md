# 🎯 Résumé de la configuration Docker Compose

## ✅ Configuration actuelle

Le projet utilise une architecture Docker Compose doublement configurée :

### Fichiers de configuration :

1. **`docker-compose.yml`** (Production - AVEC Traefik)
   - Configuration complète pour la production
   - Utilise le réseau externe `web` pour Traefik
   - Labels Traefik configurés pour le reverse proxy
   - `NODE_ENV=production`
   - `restart: always`

2. **`docker-compose.override.yml`** (Développement - SANS Traefik actif)
   - Fichier de surcharge automatique en développement local
   - Modifie `NODE_ENV` en `development`
   - Change `restart` en `unless-stopped`
   - **NE supprime PAS** le réseau `web` ni les labels Traefik (ils sont simplement non utilisés)

## 🔍 Comment ça fonctionne ?

### En développement local :

Quand vous lancez `docker-compose up`, Docker Compose fusionne automatiquement :
- `docker-compose.yml` (base)
- `docker-compose.override.yml` (surcharges dev)

**Résultat** :
- Le conteneur est créé avec `NODE_ENV=development`
- Les labels Traefik sont présents mais ignorés (pas de Traefik actif)
- Le réseau `web` doit exister mais n'est pas utilisé par Traefik
- L'application est accessible sur `http://localhost:3000`

### En production :

Vous devez **supprimer ou renommer** `docker-compose.override.yml` :

```bash
# Sur le serveur de production
mv docker-compose.override.yml docker-compose.override.yml.disabled
# OU
rm docker-compose.override.yml
```

Ensuite, `docker-compose up` utilisera seulement `docker-compose.yml` :

**Résultat** :
- Le conteneur est créé avec `NODE_ENV=production`
- Les labels Traefik sont actifs
- Le réseau `web` est utilisé par Traefik pour le reverse proxy
- L'application est accessible via votre domaine avec HTTPS

## 📦 Pourquoi le réseau `web` est requis même en dev ?

Le réseau `web` est défini comme `external: true` dans `docker-compose.yml`.

Docker Compose **merge** les configurations mais ne peut pas "supprimer" des éléments définis dans le fichier de base. Donc :

1. Le réseau `web` reste référencé même en dev
2. Il doit exister (via `docker network create web`)
3. Mais il n'est pas utilisé par Traefik en développement local (Traefik n'est pas lancé)

C'est une approche pragmatique qui permet :
- ✅ Un seul `docker-compose.yml` pour la production
- ✅ Un simple override pour le développement
- ✅ Pas besoin de dupliquer toute la configuration

## 🚀 Quick Start

### Développement (première fois) :

```bash
docker network create web
docker-compose up -d --build
```

### Production (sur serveur):

```bash
rm docker-compose.override.yml
docker network create web
docker-compose up -d --build
```

## ⚠️ Important

- **Ne committez JAMAIS** un `docker-compose.override.yml` configuré pour la production
- Le fichier `.gitignore` contient une note explicite que `docker-compose.override.yml` est intentionnellement commité pour le dev
- En production, vérifiez toujours que le fichier override est bien absent avant de déployer

## 📝 Alternative : Fichiers séparés

Si vous préférez avoir des fichiers complètement séparés :

```bash
# Renommer les fichiers
mv docker-compose.yml docker-compose.prod.yml
mv docker-compose.override.yml docker-compose.dev.yml

# Développement
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

Cette approche est plus claire mais nécessite de spécifier le fichier à chaque commande.
