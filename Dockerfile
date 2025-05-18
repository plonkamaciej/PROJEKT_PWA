# Użyj oficjalnego obrazu Node.js jako bazy
FROM node:20-alpine

# Ustaw katalog roboczy w kontenerze
WORKDIR /app

# Skopiuj pliki package.json i package-lock.json
COPY package*.json ./

# Zainstaluj zależności projektu
RUN npm ci --only=production

# Skopiuj resztę plików aplikacji
COPY . .

# Skopiuj certyfikaty SSL (zakładamy, że są w głównym katalogu)
# W środowisku produkcyjnym, certyfikaty powinny być zarządzane inaczej, np. przez reverse proxy (Nginx, Traefik) lub woluminy
COPY localhost+2-key.pem localhost+2.pem ./

# Aplikacja nasłuchuje na port 3001
EXPOSE 3001

# Uruchom aplikację
CMD [ "node", "server.js" ] 