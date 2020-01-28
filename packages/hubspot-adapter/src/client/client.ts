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

/**
 * Extracting instance id for the delete && update operations,
 * The instance id have different names in each HubSpot object.
 *
 * The type name doesn't part of the metadata (instance), but we need this info to determine
 * about the instance type.
 *
 * @param hubspotMetadata
 * @param typeName
 */
const extractInstanceId = (hubspotMetadata: HubspotMetadata, typeName: string): string => {
  // The id/guid field checking is not enough in all is(Form/MarketingEmail/Workflow) functions,
  // Although the type-guard using.
  // We added the typeName checking for that reason,
  // and this data will always in the client scope.
  const isForm = (
    formMetadata: HubspotMetadata
  ): formMetadata is Form => (formMetadata as Form).guid !== undefined
    && typeName === 'form'

  const isMarketingEmail = (
    marketingMetadata: HubspotMetadata
  ): marketingMetadata is MarketingEmail => (marketingMetadata as MarketingEmail).id !== undefined
    && typeName === 'marketingEmail'

  const isWorkflow = (
    workflowMetadata: HubspotMetadata
  ): workflowMetadata is Workflows => (workflowMetadata as Workflows).id !== undefined
    && typeName === 'workflows'

  if (isForm(hubspotMetadata)) {
    return hubspotMetadata.guid
  }

  if (isMarketingEmail(hubspotMetadata) || isWorkflow(hubspotMetadata)) {
    return hubspotMetadata.id.toString()
  }

  throw new Error(`Instance id not found, instance name: ${hubspotMetadata.name}.`)
}

export default class HubspotClient {
  private conn: Connection
  private readonly hubspotObjectAPI: Record<string, HubspotObjectAPI>

  static validateCredentials(credentials: Credentials): Promise<void> {
    const { apiKey } = credentials
    const connection = new Hubspot({ apiKey })

    return connection.integrations.getAccountDetails()
      .then(result => result) // convert to regular promise
  }

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


  /**
   * Returning the appropriate HubspotObjectAPI for using HubSpot CRUD API operations
   * @param typeName
   *
   * @throws error in case wrong type received
   */
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


  async updateInstance(
    typeName: string,
    hubspotMetadata: HubspotMetadata
  ): Promise<HubspotMetadata> {
    const objectAPI = await this.extractHubspotObjectAPI(typeName)

    // TODO: remove this error checking when HubSpot API will support update operation for workflow
    if (objectAPI.update === undefined) {
      throw new Error(`${typeName} can't updated via API`)
    }

    const resp = objectAPI.update(
      extractInstanceId(hubspotMetadata, typeName),
      hubspotMetadata
    )
    await validateResponse(resp)
    return resp
  }

  async deleteInstance(typeName: string, hubspotMetadata: HubspotMetadata): Promise<void> {
    const objectAPI = await this.extractHubspotObjectAPI(typeName)

    // The instance id have different names in each HubSpot object
    const instanceId = extractInstanceId(hubspotMetadata, typeName)
    const resp = await objectAPI.delete(instanceId)
    if (resp) {
      throw new Error(resp.message)
    }
  }
}
