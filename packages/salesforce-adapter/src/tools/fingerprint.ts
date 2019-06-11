import {
  Connection,
  ConnectionOptions,
  DescribeMetadataResult,
  MetadataObject,
  FileProperties
} from 'jsforce'
import * as winston from 'winston'

/**
 * This method runs on your salesforce account and prints an "inventory" of the various entities it contains.
 */
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

  // Process arguments. Slice the 2 first params which are the path to nodejs and the location of the script
  const args = process.argv.slice(2)
  const userName = args[0]
  const password = args[1]
  const sandbox = JSON.parse(args[2])

  let connectionOptions: ConnectionOptions
  if (sandbox) {
    connectionOptions = {
      version: '45.0',
      loginUrl: 'https://test.salesforce.com/'
    }
  } else {
    connectionOptions = { version: '45.0' }
  }
  const conn = new Connection(connectionOptions)
  const loginResult = await conn.login(userName, password)

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
