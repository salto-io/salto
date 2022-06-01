FROM cimg/node:14.15
# install open jdk 11 as it's a requirement of netsuite-adapter
RUN sudo apt-get update && sudo apt-get install -y openjdk-11-jdk; \
        # Fix "Error - trustAnchors parameter must be non-empty", taken from https://github.com/infosiftr/openjdk/blob/258870647c5a4281c4cc81d0d17b6fd95bcf4141/11/jdk/Dockerfile
        # ca-certificates-java does not work on src:openjdk-11: (https://bugs.debian.org/914424, https://bugs.debian.org/894979, https://salsa.debian.org/java-team/ca-certificates-java/commit/813b8c4973e6c4bb273d5d02f8d4e0aa0b226c50#d4b95d176f05e34cd0b718357c532dc5a6d66cd7_54_56)
        sudo keytool -importkeystore -srckeystore /etc/ssl/certs/java/cacerts -destkeystore /etc/ssl/certs/java/cacerts.jks -deststoretype JKS -srcstorepass changeit -deststorepass changeit -noprompt; \
        sudo mv /etc/ssl/certs/java/cacerts.jks /etc/ssl/certs/java/cacerts; \
        sudo /var/lib/dpkg/info/ca-certificates-java.postinst configure;
