#FROM ubuntu:22.04
#FROM python:3.10-slim-bullseye
FROM debian:stable

USER root

ENV http_proxy="http://proxy.research.ge.com:80"
ENV https_proxy="http://proxy.research.ge.com:80"
ENV no_proxy="localhost,127.0.0.1,.ge.com,.build.ge.com,github.build.ge.com"

RUN apt-get update && apt-get install -y cron git

# Add backup script
COPY command.sh /app/
RUN chmod +x /app/command.sh

# Configure the cron
# Copy file to the cron.d directory
COPY command-cron /etc/cron.d/command-cron

# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/command-cron

# Apply cron job
RUN crontab /etc/cron.d/command-cron

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

RUN git config --global --add safe.directory /app

# Start the cron
CMD cron && tail -f /var/log/cron.log