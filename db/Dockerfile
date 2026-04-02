FROM pgvector/pgvector:pg16

# Install build dependencies for Apache AGE
RUN apt-get update && apt-get install -y \
    build-essential \
    libreadline-dev \
    zlib1g-dev \
    flex \
    bison \
    git \
    postgresql-server-dev-16 \
    && rm -rf /var/lib/apt/lists/*

# Build Apache AGE from source for PG16
RUN git clone --branch release/PG16/1.5.0 https://github.com/apache/age.git /tmp/age \
    && cd /tmp/age \
    && make && make install \
    && rm -rf /tmp/age

# Add AGE to shared_preload_libraries
RUN echo "shared_preload_libraries = 'age'" >> /usr/share/postgresql/postgresql.conf.sample
