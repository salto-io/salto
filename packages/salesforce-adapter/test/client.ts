import Connection from '../src/client/jsforce'
import SalesforceClient from '../src/client/client'
import createConnection from './connection'

const mockClient = (): { connection: Connection; client: SalesforceClient } => {
  const connection = createConnection()
  const client = new SalesforceClient({
    credentials: {
      username: 'mockUser',
      password: 'mockPassword',
      loginUrl: 'https://loginUrl/',
    },
    connection,
  })

  return { connection, client }
}

export default mockClient
