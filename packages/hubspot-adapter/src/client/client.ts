import Hubspot, { ApiOptions } from 'hubspot'
import {
  RequestPromise,
} from 'requestretry'
import {
  Form, HubspotMetadata, Workflows,
} from './types'
import Connection from './madku'
import {
  OBJECTS_NAMES,
} from '../constants'


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

  async getAllInstances(typeName: string): Promise<HubspotMetadata[]> {
    switch (typeName) { // TODO: ugly
      case OBJECTS_NAMES.FORM:
        return this.getAllForms()
      case OBJECTS_NAMES.WORKFLOWS:
        return this.getAllWorkflows()
      case OBJECTS_NAMES.MARKETINGEMAIL: // TODO: change when Madkudu will support marketingEmail
        return []
      default:
        break
    }

    throw new Error(`Unknown HubSpot type: ${typeName}.`)
  }

  async getAllForms(): Promise<Form[]> { // TODO: make private
    const resp = await this.conn.forms.getAll()

    await validateResponse(resp)

    return resp
  }

  async getAllWorkflows(): Promise<Workflows[]> { // TODO: make private
    const resp = await this.conn.workflows.getAll()

    await validateResponse(resp)

    return resp.workflows
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
