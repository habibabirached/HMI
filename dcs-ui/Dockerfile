# Build time environment variables
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY



FROM node:24-alpine

USER root

#RUN apt-get update && apt-get upgrade -y

WORKDIR /app/

ENV NODE_OPTIONS=--max-old-space-size=7168
COPY package.json /app/package.json

# RUN npm config set proxy "$http_proxy"
# RUN npm config set https-proxy "$https_proxy"
# RUN npm config set noproxy "$no_proxy"
RUN npm config set "strict-ssl" false -g
#RUN npm config ls -l | grep proxy

# When using podman, we run out of file descriptors when using npm
# RUN ulimit -c unlimited && ulimit -f unlimited
RUN npm install --verbose -g npm
# RUN npm install --verbose --legacy-peer-deps
RUN npm install --verbose


# Run install before copying the code so changes in the source code 
# will not trigger unnecessary rebuild of ./node_modules
COPY public/ /app/public
COPY src/ /app/src

EXPOSE 3000

CMD ["./node_modules/.bin/react-scripts", "start"]