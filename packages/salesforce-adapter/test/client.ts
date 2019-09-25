import { Metrics } from 'adapter-api'
import Connection from '../src/client/jsforce'
import SalesforceClient from '../src/client/client'
import createConnection from './connection'
import createLogger, { MockLogger } from './logger'

const mockClient = (
  metrics?: Metrics
): {connection: Connection; client: SalesforceClient; logger: MockLogger} => {
  const connection = createConnection()
  const logger = createLogger()
  const client = new SalesforceClient({
    credentials: {
      username: 'mockUser',
      password: 'mockPassword',
      isSandbox: false,
    },
    connection,
    logger,
    metrics,
  })

  return { connection, client, logger }
}

export default mockClient
