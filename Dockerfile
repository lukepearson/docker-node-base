FROM alpine:3.6
LABEL maintainer="infinityworks"

ENV VERSION=v8.7.0 NPM_VERSION=5

RUN apk --update add --no-cache curl make gcc g++ python linux-headers binutils-gold gnupg libstdc++ && \
  gpg --keyserver ha.pool.sks-keyservers.net --recv-keys \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    FD3A5288F042B6850C66B31F09FE44734EB7990E \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
    B9AE9905FFD7803F25714661B63B535A4C206CA9 \
    56730D5401028683275BD23C23EFEFE93C4CFFFE && \
  curl -sSLO https://nodejs.org/dist/${VERSION}/node-${VERSION}.tar.xz && \
  curl -sSL https://nodejs.org/dist/${VERSION}/SHASUMS256.txt.asc | gpg --batch --decrypt | \
    grep " node-${VERSION}.tar.xz\$" | sha256sum -c | grep . && \
  tar -xf node-${VERSION}.tar.xz && \
  cd node-${VERSION} && \
  ./configure --prefix=/usr && \
  make -j$(getconf _NPROCESSORS_ONLN) && \
  make install && \
  cd / && \
  npm install -g npm@${NPM_VERSION} && \
  find /usr/lib/node_modules/npm -name test -o -name .bin -type d | xargs rm -rf && \
  apk del make gcc g++ python linux-headers binutils-gold gnupg libstdc++ && \
  rm -rf /usr/include /node-${VERSION}* /usr/share/man /tmp/* /var/cache/apk/* \
    /root/.npm /root/.node-gyp /root/.gnupg /usr/lib/node_modules/npm/man \
    /usr/lib/node_modules/npm/doc /usr/lib/node_modules/npm/html /usr/lib/node_modules/npm/scripts

COPY /s6/s6-overlay-amd64.tar.gz /tmp/
RUN tar xzf /tmp/s6-overlay-amd64.tar.gz -C /

COPY /s6/cont-init.d /etc/cont-init.d
COPY /s6/services.d /etc/services.d

RUN adduser -DH node

ENV S6_LOGGING_SCRIPT ""
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2

ENTRYPOINT ["/init"]
