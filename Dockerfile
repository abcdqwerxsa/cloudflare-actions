FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install comprehensive toolchain
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    gnupg \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# Install modern Node.js via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create working directory for tasks
WORKDIR /tmp/workspace

# Default entrypoint - will be overridden per task
ENTRYPOINT ["/bin/bash", "-c"]
CMD ["echo 'Cloudflare Actions Runner Ready'"]
