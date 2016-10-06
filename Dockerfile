FROM alpine:3.3
MAINTAINER infinityworks

RUN apk --update add \
    nodejs

RUN adduser -DH node

ADD https://github.com/just-containers/s6-overlay/releases/download/v1.9.1.3/s6-overlay-amd64.tar.gz /tmp/
RUN tar xzf /tmp/s6-overlay-amd64.tar.gz -C /
COPY /s6 /etc

COPY /secrets /secrets

COPY /app /app

ENTRYPOINT ["/init"]
