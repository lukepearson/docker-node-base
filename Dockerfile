FROM alpine:3.4
MAINTAINER infinityworks

RUN apk --update add \
    curl \
    nodejs

COPY /s6/s6-overlay-amd64.tar.gz /tmp/
RUN tar xzf /tmp/s6-overlay-amd64.tar.gz -C /

COPY /s6/cont-init.d /etc/cont-init.d
COPY /s6/services.d /etc/services.d

RUN adduser -DH node

ENV S6_LOGGING_SCRIPT ""
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2

ENTRYPOINT ["/init"]
