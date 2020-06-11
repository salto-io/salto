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
yarn
yarn add -W @salto-io/suitecloud-cli
yarn run build
```

## Configure your Netsuite account to work with Salto
* Enable SDF in Your NetSuite Account (Admin Only) - follow the instructions under https://<ACCOUNT_ID>.app.netsuite.com/app/help/helpcenter.nl?fid=section_4724921034.html
* Setup Your Role (prefer Administrator) for SDF Development - follow the instructions under https://<ACCOUNT_ID>.app.netsuite.com/app/help/helpcenter.nl?fid=subsect_1539287603.html

### Limitations
Deleting record of CustomTypes & FileCabinet is not supported.
