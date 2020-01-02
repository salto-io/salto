import HubspotClient from '../src/client/client'
import createConnection from './connection'
import Connection from '../src/client/madku'


const mockClient = (): { connection: Connection; client: HubspotClient } => {
  const connection = createConnection()
  const client = new HubspotClient({
    credentials: {
      apiKey: 'mockToken',
    },
    connection,
  })

  return { connection, client }
}

export default mockClient
