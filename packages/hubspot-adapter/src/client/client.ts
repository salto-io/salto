import Hubspot, { ApiOptions } from 'hubspot'
import {
  RequestPromise,
} from 'requestretry'
import {
  Form, HubspotMetadata, MarketingEmail, Workflows,
} from './types'
import Connection from './madku'


export type Credentials = {
  apiKey: string
}

export type HubspotClientOpts = {
  credentials: Credentials
  connection?: Connection
}

const validateResponse = async (
  response: RequestPromise
): Promise<void> => {
  const resp = await response
  if (resp.status) {
    throw new Error(resp.message)
  }
}

export default class HubspotClient {
  private conn: Connection
  private readonly getAllFunctions: Record<string, () => Promise<HubspotMetadata[]>>

  constructor(
    { credentials, connection }: HubspotClientOpts
  ) {
    const apiKeyOptions: ApiOptions = { apiKey: credentials.apiKey }
    this.conn = connection
      || new Hubspot(apiKeyOptions)

    this.getAllFunctions = {
      form: this.getAllForms,
      workflows: this.getAllWorkflows,
      marketingEmail: this.getAllMarketingEmail,
    }
  }

  getAllContacts(): RequestPromise {
    return this.conn.contacts.get()
  }

  async getAllInstances(typeName: string): Promise<HubspotMetadata[]> {
    const getAllFunction = this.getAllFunctions[typeName]
    if (getAllFunction) {
      return getAllFunction.apply(this)
    }

    throw new Error(`Unknown HubSpot type: ${typeName}.`)
  }

  private async getAllForms(): Promise<Form[]> {
    const resp = this.conn.forms.getAll()
    await validateResponse(resp)

    return resp
  }

  private async getAllWorkflows(): Promise<Workflows[]> {
    // This is special issue for workflows objects:
    // Only account with special permission can fetch instances
    const resp = this.conn.workflows.getAll()
      .catch(_ => ({ workflows: [] }))

    return (await resp).workflows
  }

  private async getAllMarketingEmail(): Promise<MarketingEmail[]> {
    const resp = this.conn.marketingEmail.getAll()
      .catch(_ => ({ objects: [] }))

    return (await resp).objects
  }


  async createForm(f: Form): Promise<Form> {
    const resp = await this.conn.forms.create(f)
    await validateResponse(resp)
    return resp
  }

  async updateForm(f: Form): Promise<Form> {
    const resp = await this.conn.forms.update(f.guid, f)
    await validateResponse(resp)
    return resp
  }

  async deleteForm(f: Form): Promise<void> {
    const resp = await this.conn.forms.delete(f.guid)
    if (resp) {
      throw new Error(resp.message)
    }
  }
}
