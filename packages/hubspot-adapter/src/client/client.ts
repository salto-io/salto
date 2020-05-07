/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import Hubspot, { ApiOptions } from 'hubspot'
import { StatusCodeError } from 'request-promise/errors'
import {
  RequestPromise,
} from 'requestretry'
import {
  Form, HubspotMetadata, MarketingEmail, Workflows, ContactProperty, Owner,
} from './types'
import Connection, { HubspotObjectAPI, Workflow } from './madku'
import { OBJECTS_NAMES } from '../constants'

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
  await response.catch((reason: StatusCodeError) =>
    new Error(reason.error.message))
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
    && typeName === OBJECTS_NAMES.FORM

  const isMarketingEmail = (
    marketingMetadata: HubspotMetadata
  ): marketingMetadata is MarketingEmail => (marketingMetadata as MarketingEmail).id !== undefined
    && typeName === OBJECTS_NAMES.MARKETINGEMAIL

  const isWorkflow = (
    workflowMetadata: HubspotMetadata
  ): workflowMetadata is Workflows => (workflowMetadata as Workflows).id !== undefined
    && typeName === OBJECTS_NAMES.WORKFLOW

  const isContactProperty = (
    contactPropertyMetadata: HubspotMetadata
  ): contactPropertyMetadata is ContactProperty =>
    (contactPropertyMetadata as ContactProperty).name !== undefined
    && typeName === OBJECTS_NAMES.CONTACT_PROPERTY

  if (isForm(hubspotMetadata)) {
    return hubspotMetadata.guid
  }

  if (isContactProperty(hubspotMetadata)) {
    return hubspotMetadata.name
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
      [OBJECTS_NAMES.FORM]: this.conn.forms,
      [OBJECTS_NAMES.WORKFLOW]: this.conn.workflows,
      [OBJECTS_NAMES.MARKETINGEMAIL]: this.conn.marketingEmail,
      [OBJECTS_NAMES.CONTACT_PROPERTY]: this.conn.contacts.properties,
    }
  }

  async getOwners(): Promise<Owner[]> {
    const resp = this.conn.owners.get()
    await validateResponse(resp)
    return resp
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
    const getWorkflowsFromValue = async (basicWorkflows: Workflows[]): Promise<Workflows[]> => {
      const workflowsAPI = this.hubspotObjectAPI[OBJECTS_NAMES.WORKFLOW] as Workflow
      const workflowsResp = basicWorkflows.map(async (basicWorkflow: Workflows):
        Promise<Workflows> => {
        const workflowResp = workflowsAPI.get(basicWorkflow.id)
        validateResponse(workflowResp)
        return workflowResp
      })
      return await Promise.all(workflowsResp) as Workflows[]
    }

    const objectAPI = await this.extractHubspotObjectAPI(typeName)
    const responsePromise = objectAPI.getAll()
    const responseValue = await responsePromise.catch((reason: StatusCodeError) => {
      if (reason.statusCode === 403) {
        return []
      }
      throw Error(reason.error.message)
    })
    // If account is not permitted to get this object return an empty list
    if (_.isEqual(responseValue, [])) {
      return responseValue
    }
    switch (typeName) {
      case OBJECTS_NAMES.WORKFLOW:
        return getWorkflowsFromValue(responseValue.workflows as Workflows[])
      case OBJECTS_NAMES.MARKETINGEMAIL:
        return responseValue.objects
      default:
        return responseValue
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
    const resp = objectAPI.delete(extractInstanceId(hubspotMetadata, typeName))
    await resp.catch((reason: StatusCodeError) => {
      if (!_.isUndefined(reason)) {
        throw new Error(reason.error.message)
      }
    })
  }
}
