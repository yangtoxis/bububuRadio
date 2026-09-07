FROM node:20-bookworm-slim

# Build toolchain required because @discordjs/opus is a native addon and
# prebuilt binaries aren't published for every Node/glibc combination —
# without these, npm install falls back to node-gyp and fails outright.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        make \
        g++ \
        pkg-config \
        libopus-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# SQLite file lives here — mount this as a volume so data survives rebuilds.
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
