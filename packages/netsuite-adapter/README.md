# Netsuite adapter

Netsuite adapter for salto.io, in very early development stages (not functional!)


### Prerequisites
###### taken from https://github.com/oracle/netsuite-suitecloud-sdk/tree/master/packages/node-cli

Node.js version 12.14.0 LTS or greater
Install Java 11 (OpenJDK / JDK)
```
OpenJDK - http://jdk.java.net/archive/ (explanation at https://dzone.com/articles/installing-openjdk-11-on-macos)
JDK - https://www.oracle.com/java/technologies/javase-jdk11-downloads.html
```

### Build instructions
```
download add_ns_adapter.patch and apply it by running `patch -p 1 -i packages/netsuite-adapter/add_ns_adapter.patch` from your repository root
yarn
yarn run build
```
