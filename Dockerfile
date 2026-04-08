FROM alpine:latest

# Install common runtimes for task execution
RUN apk add --no-cache \
    bash \
    curl \
    git \
    python3 \
    py3-pip \
    nodejs \
    npm \
    && rm -rf /var/cache/apk/*

# Create working directory for tasks
WORKDIR /tmp

# Default entrypoint - will be overridden per task
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["echo 'Cloudflare Actions Runner Ready'"]
