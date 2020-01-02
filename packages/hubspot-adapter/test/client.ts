import Hubspot from 'hubspot'
import HubspotClient from '../src/client/client'


const mockClient = (): { connection: Hubspot; client: HubspotClient } => {
  const connection = new Hubspot({ apiKey: 'mockToken' })
  const client = new HubspotClient({
    credentials: {
      apiKey: 'mockToken',
    },
    connection,
  })

  return { connection, client }
}

export default mockClient
