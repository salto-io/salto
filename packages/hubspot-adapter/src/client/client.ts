import Hubspot, { ApiOptions } from 'hubspot'
import {
  RequestPromise,
} from 'requestretry'
import {
  Form,
} from './types'


export type Credentials = {
  apiKey: string
}

export type HubspotClientOpts = {
  credentials: Credentials
  connection?: Hubspot
}

export default class HubspotClient {
  private conn: Hubspot

  constructor(
    { credentials, connection }: HubspotClientOpts
  ) {
    const apiKeyOptions: ApiOptions = { apiKey: credentials.apiKey }
    this.conn = connection
      || new Hubspot(apiKeyOptions)
  }

  getAllContacts(): RequestPromise {
    return this.conn.contacts.get()
  }

  async getAllForms(): Promise<Form[]> {
    const resp = await this.conn.forms.getAll()

    if (resp.status) {
      throw new Error(resp.message)
    }

    return resp
  }


  async createForm(f: Form): Promise<Form> {
    const resp = await this.conn.forms.create(f)
    if (resp.status) {
      throw new Error(resp.message)
    }
    return resp
  }

  async updateForm(f: Form): Promise<Form> {
    const resp = await this.conn.forms.update(f.guid, f)
    if (resp.status) {
      throw new Error(resp.message)
    }
    return resp
  }

  async deleteForm(f: Form): Promise<void> {
    const resp = await this.conn.forms.delete(f.guid)
    if (resp) {
      throw new Error(resp.message)
    }
  }
}
