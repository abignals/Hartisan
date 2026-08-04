FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0 est obligatoire : par défaut Vite n'écoute que sur
# localhost, donc à l'intérieur du conteneur, et nginx se prend un
# "connection refused".
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]