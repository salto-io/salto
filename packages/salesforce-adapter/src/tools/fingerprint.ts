import * as winston from 'winston'
import {
  ConnectionOptions,
  DescribeMetadataResult,
  MetadataObject,
  FileProperties,
  Connection,
  DescribeValueTypeResult,
  ValueTypeField
} from 'jsforce'

const developerEdition = 'Developer Edition'

/**
 * This method runs on your salesforce account and prints an "inventory" of the various entities it contains.
 */
async function main(): Promise<void> {
  // Instantiate the logging mechanism
  const logger = winston.createLogger({
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.colorize(),
      winston.format.simple()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ]
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
  await conn.login(userName, password, (err, user) => {
    if (err) {
      logger.error('Could not establish a connection: %s', err.message)
      process.exit(1)
    } else {
      logger.info(
        `UserInfo:\n org Id:${user.organizationId}, User Id:${user.id}, URL:${user.url}`
      )
    }
  })

  // Verifying the organization is a Sandbox
  if (!sandbox) {
    // If not, verifying that its type is "Developer Edition".
    // Query for organization data
    await conn.query(
      'SELECT Id, OrganizationType, Name, instanceName, isSandbox FROM Organization',
      undefined,
      (err, res: any) => {
        if (err) {
          logger.error(
            'Cannot determine if organization is a Developer Edition or not. Failed to fetch organization object with error: %s',
            err.message
          )
          process.exit(1)
        } else if (res.records[0].OrganizationType !== developerEdition) {
          logger.error(
            'Your organization is neither a sandbox nor a Developer Edition, therefore the program will quit to prevent massive API calls to your production account'
          )
          process.exit(1)
        }
      }
    )
  }

  logger.info('============METADATA API=================')
  const metaResults: DescribeMetadataResult = await conn.metadata.describe()
  const sortedObjects: MetadataObject[] = metaResults.metadataObjects.sort(
    (a, b) => {
      return a.xmlName.localeCompare(b.xmlName)
    }
  )

  // Cannot run async statements inside an array forEach() loop
  // eslint-disable-next-line no-restricted-syntax
  for (const obj of sortedObjects) {
    logger.info('------------------------------------')
    logger.info('Analyze metadata type %s\n', obj.xmlName)
    try {
      // eslint-disable-next-line no-await-in-loop
      const results: DescribeValueTypeResult = await conn.metadata.describeValueType(
        `{http://soap.sforce.com/2006/04/metadata}${obj.xmlName}`
      )
      if (!results) {
        logger.info('Failed to describe value type %s', obj.xmlName)
      } else {
        const sortedFields: ValueTypeField[] = results.ValueTypeFields.sort(
          (a, b) => {
            return a.name.localeCompare(b.name)
          }
        )
        // eslint-disable-next-line no-restricted-syntax
        for (const field of sortedFields) {
          logger.info(field.name)
        }
      }
      // eslint-disable-next-line no-empty
    } catch (error) {}
  }

  // Cannot run async statements inside an array forEach() loop
  // eslint-disable-next-line no-restricted-syntax
  for (const obj of sortedObjects) {
    logger.info(obj.xmlName)
    try {
      // We want to perform this synchronously, hence the await inside the loop
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
