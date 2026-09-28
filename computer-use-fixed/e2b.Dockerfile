# E2B Custom Template: PROFESSOR-XMD (Chromium + OpenHands pre-installed)
# Base: node:20-slim (inaendana na Playwright)
FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# ============================================================
# 1. SYSTEM DEPENDENCIES
# ============================================================
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Python
    python3 python3-pip python3-venv \
    # Chromium libs (Playwright browser)
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    # Utilities
    curl wget git ca-certificates xz-utils \
    # Fonts
    fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# 2. NODE + PLAYWRIGHT
# ============================================================
RUN npm install -g playwright@1.62.0 && \
    npx playwright install chromium && \
    npx playwright install-deps chromium

# ============================================================
# 3. PYTHON VENV + OPENHANDS
# ============================================================
RUN python3 -m venv /code/openhands-venv && \
    /code/openhands-venv/bin/pip install --no-cache-dir --upgrade pip && \
    /code/openhands-venv/bin/pip install --no-cache-dir \
        "openhands-sdk==1.46.0" \
        "openhands-tools==1.46.0" \
        playwright==1.62.0

# ============================================================
# 4. BROWSER CACHE (kwa user, sio root)
# ============================================================
RUN mkdir -p /home/user/.cache && \
    cp -r /root/.cache/ms-playwright /home/user/.cache/ 2>/dev/null || true && \
    chown -R 1000:1000 /home/user/.cache 2>/dev/null || true

# ============================================================
# 5. WORKSPACE
# ============================================================
RUN mkdir -p /code/project /code/mcp && \
    chown -R 1000:1000 /code 2>/dev/null || true

WORKDIR /code

# ============================================================
# 6. ENV
# ============================================================
ENV PATH="/code/openhands-venv/bin:/usr/local/bin:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH="/home/user/.cache/ms-playwright"
