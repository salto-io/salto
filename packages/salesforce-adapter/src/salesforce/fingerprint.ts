import {
  Connection,
  ConnectionOptions,
  DescribeMetadataResult,
  MetadataObject,
  FileProperties
} from 'jsforce'
import * as winston from 'winston'

/**
 * async main
  : void */
async function main(): Promise<void> {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.colorize(),
      winston.format.simple()
    ),
    transports: [new winston.transports.Console()]
  })

  const connectionOptions: ConnectionOptions = { version: '45.0' }
  // For sandbox:
  // let connectionOptions : ConnectionOptions = { version: "45.0", loginUrl: "https://test.salesforce.com/" }
  const conn = new Connection(connectionOptions)
  // let loginResult : UserInfo = await conn.login("services-ldws@force.com.sandbox2", "dH4nAAWSuK5wPWQXTHRdGVXXRbKKbBbjUapN8OSb")
  const loginResult = await conn.login(
    'elad.mallel@salto.io',
    '84YHpf9PmT4pihsiSGF8PJp6fzy9'
  )
  // let loginResult : UserInfo = await conn.login("services-ldws@force.com", "dH4nAAWSuK5wPWQaNBNH0u4EuEhD5z8vIzcd9yj3")
  logger.info(
    `UserInfo:\n org Id:${loginResult.organizationId}, User Id:${loginResult.id}, URL:${loginResult.url}`
  )

  // Query for organization data
  const result: any = await conn.query(
    'SELECT Id, OrganizationType, Name, instanceName, isSandbox FROM Organization'
  )
  logger.info(result.records[0].OrganizationType)

  const metaResults: DescribeMetadataResult = await conn.metadata.describe()
  const sortedObjects: MetadataObject[] = metaResults.metadataObjects.sort(
    (a, b) => {
      return a.xmlName.localeCompare(b.xmlName)
    }
  )

  // eslint-disable-next-line no-restricted-syntax
  for (const obj of sortedObjects) {
    logger.info(obj.xmlName)
    try {
      // eslint-disable-next-line no-await-in-loop
      const results = await conn.metadata.list({
        type: obj.xmlName
      })
      if (results) {
        const sortedNames: FileProperties[] = results.sort((a, b) => {
          return a.fullName.localeCompare(b.fullName)
        })
        // eslint-disable-next-line no-restricted-syntax
        for (const name of sortedNames) {
          logger.info(`   ${name.fullName}`)
          try {
            // eslint-disable-next-line no-await-in-loop
            const meta: any = await conn.metadata.read(
              obj.xmlName,
              name.fullName
            )
            if (meta.description) {
              logger.info(`       ${meta.description}`)
            }
            // eslint-disable-next-line no-empty
          } catch (error) {}
        }
      }
      // eslint-disable-next-line no-empty
    } catch (error) {}
  }
}

main()
