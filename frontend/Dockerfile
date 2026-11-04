# Image de build : Vite inline les variables VITE_* dans le bundle à la compilation, d'où les ARG ci-dessous
# (à fournir via les `build.args` du docker-compose racine, pas au runtime du conteneur nginx).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
RUN npm run build

# Image d'exécution : nginx sert les fichiers statiques et reverse-proxifie /api, /oauth2, /login/oauth2 et
# /ws vers le backend (même origine requise pour le cookie de session, voir README « Contraintes pour le
# déploiement »). nginx.conf.template est rendu avec envsubst (entrypoint standard de l'image nginx) pour
# injecter SUPABASE_URL dans la Content-Security-Policy.
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
