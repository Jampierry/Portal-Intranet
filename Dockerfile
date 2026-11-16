# Portal Intranet Di Paula: compila o site e serve tudo pelo Fastify (porta 3100).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY servidor/package.json servidor/
COPY web/package.json web/
RUN npm ci
COPY web web
RUN npm run build -w web

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY servidor/package.json servidor/
COPY web/package.json web/
RUN npm ci --omit=dev
COPY servidor servidor
COPY modulos modulos
COPY infra infra
COPY docs/manuais docs/manuais
COPY web/public/marca web/public/marca
COPY --from=build /app/web/dist web/dist
# Dados persistentes (banco, mídia, documentos, backups) ficam no volume /dados.
RUN mkdir -p /dados && chown -R node:node /dados
USER node
EXPOSE 3100
CMD ["node", "servidor/src/main.ts"]
