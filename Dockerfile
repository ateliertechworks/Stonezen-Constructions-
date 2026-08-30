# ---------------------------------------------------------------- build
FROM node:22-alpine AS build
WORKDIR /app

# Install against the lockfile first so this layer caches across source edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* at build time, so this has to be present during the build
# rather than supplied to the running container. Declaring it as an ARG and
# promoting it to an ENV is what makes Coolify's build variable visible to Vite;
# without this the bundle is built with an undefined API base and silently
# talks to its own origin instead.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ----------------------------------------------------------------- serve
FROM nginx:1.27-alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Coolify's health check needs an endpoint that does not depend on the SPA.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --spider -q http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
