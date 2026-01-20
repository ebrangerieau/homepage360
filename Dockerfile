# Utiliser une image légère de Nginx
FROM nginx:alpine

# Copier les fichiers du projet dans le dossier par défaut de Nginx
COPY . /usr/share/nginx/html

# Exposer le port 80
EXPOSE 80

# Commande par défaut pour lancer Nginx
CMD ["nginx", "-g", "daemon off;"]
