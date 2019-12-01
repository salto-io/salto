import {
  RequestPromise,
} from 'requestretry'
import HubspotClient from './client/client'

export const firstFunc = (): RequestPromise => {
// eslint-disable-next-line no-console
  console.log('Welcome to hubspot adapter')

  const testClient = new HubspotClient('d0b5e073-694e-4335-a9d6-9f8fdf4eb9d5')

  return testClient.getAllContacts()
}
