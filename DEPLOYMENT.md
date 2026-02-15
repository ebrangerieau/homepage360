# 🚀 Déploiement Homepage360

Ce document explique comment déployer Homepage360 en développement local et en production avec Traefik.

---

## 📦 Architecture Docker Compose

Le projet utilise deux fichiers Docker Compose :

- **`docker-compose.yml`** : Configuration de base pour la **production** avec Traefik
- **`docker-compose.override.yml`** : Surcharges pour le **développement local** (sans Traefik)

Docker Compose fusionne automatiquement ces fichiers lors de `docker-compose up`.

---

## 🛠️ Développement Local (sans Traefik)

### Prérequis
- Docker Desktop installé et en cours d'exécution
- Port 3000 disponible

###Lancement

```bash
# 1. Cloner le projet et accéder au répertoire
cd homepage360

# 2. Créer le réseau Docker 'web' (nécessaire même en dev)
docker network create web

# 3. Copier l'exemple de configuration (optionnel)
cp .env.example .env

# 4. Lancer l'application
docker-compose up -d --build

# 5. Vérifier les logs
docker-compose logs -f homepage360

# 6. Accéder à l'application
# Ouvrir http://localhost:3000
# Login: admin / admin123
```

### Arrêt

```bash
docker-compose down
```

### Configuration

Le fichier `docker-compose.override.yml` override automatiquement :
- ✅ `NODE_ENV=development` au lieu de `production`
- ✅ Pas de réseau externe `web` requis
- ✅ Pas de labels Traefik
- ✅ `restart: unless-stopped` au lieu de `always`

---

## 🌐 Production (avec Traefik)

### Prérequis
- Serveur Linux avec Docker et Docker Compose
- Traefik déjà configuré et en cours d'exécution
- Réseau Docker `web` créé et utilisé par Traefik
- Nom de domaine configuré (ex: `homepage.example.com`)

### Configuration

1. **Supprimer le fichier override en production**
   ```bash
   # Sur le serveur de production, renommer ou supprimer le fichier override
   mv docker-compose.override.yml docker-compose.override.yml.bak
   # OU
   rm docker-compose.override.yml
   ```

2. **Configurer les variables d'environnement**
   ```bash
   # Créer un fichier .env
   nano .env
   ```
   
   Contenu du `.env` :
   ```bash
   # Générer une clé sécurisée
   MONITOR_API_KEY=$(openssl rand -hex 32)
   ```

3. **Modifier le domaine dans docker-compose.yml**
   ```bash
   nano docker-compose.yml
   ```
   
   Remplacer `votre-domaine.com` par votre vrai domaine :
   ```yaml
   - "traefik.http.routers.homepage360.rule=Host(`homepage.example.com`)"
   ```

### Lancement en production

```bash
# 1. S'assurer que le réseau web existe
docker network create web

# 2. Lancer avec docker-compose.yml uniquement (sans override)
docker-compose up -d --build

# 3. Vérifier les logs
docker-compose logs -f

# 4. Accéder via votre domaine
# https://homepage.example.com (avec HTTPS via Traefik)
```

### Vérification

```bash
# Vérifier que le conteneur utilise bien le réseau 'web'
docker network inspect web

# Vérifier les labels Traefik
docker inspect homepage360 | grep -A 10 Labels
```

---

## 🔧 Utilisation avancée

### Déploiement sans override automatique

Si vous voulez contrôler explicitement quel fichier utiliser :

**Développement local :**
```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

**Production (sans override) :**
```bash
docker-compose -f docker-compose.yml up -d
```

### Créer un fichier production dédié (alternative)

Vous pouvez aussi créer un `docker-compose.prod.yml` :

```bash
# Développement
docker-compose up -d

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 📊 Checklist de déploiement en production

- [ ] Traefik installé et configuré
- [ ] Réseau Docker `web` créé
- [ ] DNS configuré vers le serveur
- [ ] `docker-compose.override.yml` supprimé ou renommé
- [ ] Variable `MONITOR_API_KEY` configurée dans `.env`
- [ ] Domaine mis à jour dans `docker-compose.yml`
- [ ] Certificat SSL généré par Traefik (Let's Encrypt)
- [ ] Mot de passe admin changé après premier login
- [ ] Firewall configuré (port 80/443 ouverts, 3000 fermé)

---

## 🔐 Sécurité

### Changement du mot de passe admin

Après le premier déploiement, vous devez changer le mot de passe admin par défaut :

```bash
# Accéder au conteneur
docker exec -it homepage360 sh

# Utiliser le script de génération de hash
cd /app/server
node generate_hash.js "VotreNouveauMotDePasseSécurisé"

# Copier le hash et éditer users.json
vi users.json
# Remplacer le passwordHash de l'utilisateur admin

# Redémarrer le conteneur
exit
docker-compose restart
```

### Régénération de l'API Key

```bash
# Générer une nouvelle clé
openssl rand -hex 32

# Mettre à jour .env
# Redémarrer
docker-compose restart
```

---

## 🐛 Dépannage

### Le réseau 'web' n'existe pas

```bash
docker network create web
```

### Les labels Traefik ne fonctionnent pas

Vérifier que `docker-compose.override.yml` est bien supprimé/renommé en production.

### Port 3000 déjà utilisé

```bash
# Changer le port dans docker-compose.yml ou .override.yml
ports:
  - "3001:3000"  # Utiliser 3001 au lieu de 3000
```

---

## 📚 Documentation supplémentaire

- [Configuration Traefik](https://doc.traefik.io/traefik/)
- [Docker Compose Override](https://docs.docker.com/compose/extends/)
- [Sécurité de l'application](./SECURITY.md)
