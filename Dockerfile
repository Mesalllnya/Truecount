# syntax=docker/dockerfile:1

# TrueCount backend (PHP + Apache)
#
# Build context harus root repo karena migration ada di database/migrate.php
# dan konfigurasi dibaca dari environment container (atau .env di root repo).
#
#   docker build -t truecount-backend .
#
# Frontend TIDAK dibangun di image ini (lihat docs/deploy/docker.md).

FROM php:8.3-apache

ENV TZ=Asia/Jakarta

# Ekstensi yang dipakai backend:
#   pdo_mysql  - database
#   mbstring   - validasi username/label
#   gd         - steganografi & foto kandidat
#   opcache    - performa
# openssl & fileinfo sudah built-in di image resmi PHP.
RUN DEBIAN_FRONTEND=noninteractive apt-get update \
    && apt-get install -y --no-install-recommends \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
        tzdata \
    && ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime \
    && echo "$TZ" > /etc/timezone \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j"$(nproc)" gd pdo_mysql mbstring opcache \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-truecount.ini
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

# Salin kode aplikasi (tanpa .env, node_modules, frontend, dan storage user
# karena sudah dikecualikan oleh .dockerignore).
COPY . .

COPY docker/entrypoint.sh /usr/local/bin/truecount-entrypoint
RUN chmod +x /usr/local/bin/truecount-entrypoint \
    && mkdir -p \
        backend/storage/logs \
        backend/storage/auth_photos \
        backend/storage/id_photos \
        backend/storage/encrypted \
        backend/storage/private \
        backend/storage/temp \
        backend/uploads/candidates \
    && chown -R www-data:www-data backend/storage backend/uploads

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD php -r '$r = @file_get_contents("http://127.0.0.1/health"); exit($r === false ? 1 : 0);'

ENTRYPOINT ["truecount-entrypoint"]
CMD ["apache2-foreground"]
