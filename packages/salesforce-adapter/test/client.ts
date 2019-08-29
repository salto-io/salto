import Connection from '../src/client/connection'
import SalesforceClient from '../src/client/client'
import createConnection from './connection'


const mockClient = (): { connection: Connection; client: SalesforceClient } => {
  const connection = createConnection()
  const client = new SalesforceClient('', '', false, { connection })

  return { connection, client }
}

export default mockClient
