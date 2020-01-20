import Hubspot, { ApiOptions } from 'hubspot'
import {
  RequestPromise,
} from 'requestretry'
import {
  Form, HubspotMetadata, MarketingEmail, Workflows,
} from './types'
import Connection, { HubspotObjectAPI } from './madku'


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

const hubspotTypeErr = (typeName: string): void => {
  throw new Error(`Unknown HubSpot type: ${typeName}.`)
}


const isForm = (
  hubspotMetadata: HubspotMetadata
): hubspotMetadata is Form => (hubspotMetadata as Form).guid !== undefined

const isMarketingEmail = (
  hubspotMetadata: HubspotMetadata
): hubspotMetadata is MarketingEmail => (hubspotMetadata as MarketingEmail).id !== undefined

const isWorkflow = (
  hubspotMetadata: HubspotMetadata
): hubspotMetadata is Workflows => (hubspotMetadata as Workflows).id !== undefined


const ExtractInstanceId = (hubspotMetadata: HubspotMetadata): string => {
  if (isForm(hubspotMetadata)) {
    return hubspotMetadata.guid
  }

  if (isMarketingEmail(hubspotMetadata) && isWorkflow(hubspotMetadata)) {
    return hubspotMetadata.id.toString()
  }

  throw new Error(`Instance id not found, instance name: ${hubspotMetadata.name}.`)
}

export default class HubspotClient {
  private conn: Connection
  private readonly hubspotObjectAPI: Record<string, HubspotObjectAPI>

  constructor(
    { credentials, connection }: HubspotClientOpts
  ) {
    const apiKeyOptions: ApiOptions = { apiKey: credentials.apiKey }
    this.conn = connection
      || new Hubspot(apiKeyOptions)

    this.hubspotObjectAPI = {
      form: this.conn.forms,
      workflows: this.conn.workflows,
      marketingEmail: this.conn.marketingEmail,
    }
  }

  getAllContacts(): RequestPromise {
    return this.conn.contacts.get()
  }


  private extractHubspotObjectAPI(typeName: string): HubspotObjectAPI {
    const objectAPI = this.hubspotObjectAPI[typeName]
    if (!objectAPI) {
      hubspotTypeErr(typeName)
    }

    return objectAPI
  }

  async getAllInstances(typeName: string): Promise<HubspotMetadata[]> {
    // This is special issue for workflows objects:
    // Only account with special permission can fetch instances
    const getAllWorkflowsResponse = async (resp: RequestPromise): Promise<Workflows[]> =>
      (await resp.catch(_ => ({ workflows: [] }))).workflows

    // This is special issue for MarketingEmail objects:
    // Only account with special permission can fetch instances
    const getAllMarketingEmailResponse = async (resp: RequestPromise):
      Promise<MarketingEmail[]> =>
      (await resp.catch(_ => ({ objects: [] }))).objects


    const objectAPI = await this.extractHubspotObjectAPI(typeName)

    const resp = objectAPI.getAll()
    switch (typeName) {
      case 'workflows':
        return getAllWorkflowsResponse(resp)
      case 'marketingEmail':
        return getAllMarketingEmailResponse(resp)
      default:
        await validateResponse(resp)
        return resp
    }
  }


  async createInstance(
    typeName: string,
    hubspotMetadata: HubspotMetadata
  ): Promise<HubspotMetadata> {
    const objectAPI = await this.extractHubspotObjectAPI(typeName)

    const resp = objectAPI.create(hubspotMetadata)
    await validateResponse(resp)
    return resp
  }

  async updateForm(f: Form): Promise<Form> {
    const resp = await this.conn.forms.update(f.guid, f)
    await validateResponse(resp)
    return resp
  }

  async deleteInstance(typeName: string, hubspotMetadata: HubspotMetadata): Promise<void> {
    const objectAPI = await this.extractHubspotObjectAPI(typeName)

    // The instance id have different names in each HubSpot object
    const instanceId = ExtractInstanceId(hubspotMetadata)
    const resp = await objectAPI.delete(instanceId)
    if (resp) {
      throw new Error(resp.message)
    }
  }
}
