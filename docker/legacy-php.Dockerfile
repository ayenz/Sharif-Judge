# SharIF Judge runtime image: Apache + PHP plus the compilers the tester needs.
ARG PHP_VERSION=8.3
FROM php:${PHP_VERSION}-apache-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ make libc6-dev default-jdk-headless python3 perl procps \
        libzip-dev libicu-dev libldap2-dev libpng-dev unzip git \
    && docker-php-ext-install mysqli pdo_mysql zip intl gd ldap \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Run Apache as the host user so bind-mounted files stay editable on both sides.
ARG HOST_UID=1000
ARG HOST_GID=1000
RUN groupmod -o -g ${HOST_GID} www-data && usermod -o -u ${HOST_UID} www-data

# DOCROOT lets the CodeIgniter 4 container serve from public/ instead of the repo root.
ENV DOCROOT=/var/www/html
RUN sed -ri 's!/var/www/html!${DOCROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

COPY php.ini /usr/local/etc/php/conf.d/sharif-judge.ini
