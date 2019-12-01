import Hubspot, { ApiOptions } from 'hubspot'
import {
  RequestPromise,
} from 'requestretry'


export default class HubspotClient {
  private conn: Hubspot

  constructor(
    apiKey: string
  ) {
    const apiKeyOptions: ApiOptions = { apiKey }
    this.conn = new Hubspot(apiKeyOptions)
  }

  getAllContacts(): RequestPromise {
    return this.conn.contacts.get()
  }
}
