FROM node:20-alpine

WORKDIR /app

# Install required dependencies
RUN apk add --no-cache git python3 make g++ bash

# Clone Arbius repository
RUN git clone https://github.com/semperai/arbius.git . && \
    cd contract && \
    yarn install

# Set working directory to contract
WORKDIR /app/contract

# Copy initialization scripts
COPY init-testnet.sh /app/
COPY config.local.json /app/contract/scripts/

# Make scripts executable
RUN chmod +x /app/init-testnet.sh

# Expose Hardhat node port
EXPOSE 8545

# Default command - start hardhat node and deploy contracts
CMD ["/bin/bash", "/app/init-testnet.sh"]
