FROM node:20-bookworm-slim

# Build toolchain required because @discordjs/opus is a native addon and
# prebuilt binaries aren't published for every Node/glibc combination —
# without these, npm install falls back to node-gyp and fails outright.
#
# ffmpeg comes from apt, not the ffmpeg-static npm package: that package's
# bundled binary is statically linked against glibc, and statically linked
# glibc binaries resolve DNS by dlopen()'ing NSS modules at runtime — which
# segfaults unpredictably in containers. It reads local files and lavfi
# sources fine, then segfaults the instant it has to getaddrinfo() a real
# stream host. apt's ffmpeg is dynamically linked against the container's
# own glibc, so it doesn't hit that mismatch.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        python3 \
        make \
        g++ \
        pkg-config \
        libopus-dev \
        ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# SQLite file lives here — mount this as a volume so data survives rebuilds.
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
