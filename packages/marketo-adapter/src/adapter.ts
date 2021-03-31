/*
*                      Copyright 2021 Salto Labs Ltd.
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
import {
  FetchResult,
  AdapterOperations,
  DeployOptions,
  DeployResult,
  Element, ObjectType, Change,
  ChangeDataType, isObjectType, isField, FieldMap, Values, DeployModifiers,
} from '@salto-io/adapter-api'
import MarketoClient from './client/client'
import {
  changeDataTypeToCustomObjectFieldRequest,
  changeDataTypeToCustomObjectRequest,
  createMarketoCustomObjectType,
  createMarketoObjectType, isCustomObject,
  Types,
} from './transformers/transformer'
import { LeadAttribute, CustomObjectResponse } from './client/types'
import {
  OBJECTS_NAMES,
  CREATE_ONLY,
  UPDATE_ONLY,
  API_NAME, STATE, APPROVED_STATE,
} from './constants'
import changeValidator from './change_validator'


export interface MarketoAdapterParams {
  client: MarketoClient
}

export default class MarketoAdapter implements AdapterOperations {
  private readonly client: MarketoClient

  public constructor({
    client,
  }: MarketoAdapterParams) {
    this.client = client
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given Marketo account.
   */
  public async fetch(): Promise<FetchResult> {
    const fieldTypes = Types.getAllFieldTypes()
    const objectTypes = await this.getAllMarketoObjects()

    const elements = [...fieldTypes, ...objectTypes] as Element[]
    return { elements }
  }

  private async getAllMarketoObjects(): Promise<ObjectType[]> {
    return (await Promise.all(
      Object.values(OBJECTS_NAMES)
        .map(t => this.getAllMarketoObjectTypes(t))
    )).flat()
  }

  private async getAllMarketoObjectTypes(type: string): Promise<ObjectType[]> {
    switch (type) {
      case OBJECTS_NAMES.CUSTOM_OBJECT:
        return (await this.client.getCustomObjects() as CustomObjectResponse[])
          .map((co: CustomObjectResponse) =>
            createMarketoCustomObjectType(co))
      case OBJECTS_NAMES.LEAD:
        return [createMarketoObjectType(type,
          await this.client.describe(type) as LeadAttribute[])]
      default:
        throw new Error(`Unsupported type: ${type}`)
    }
  }

  public async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const deployResults = await Promise.all(
      changeGroup.changes.map(async (change: Change): Promise<DeployResult> => {
        try {
          if (change.action === 'add') {
            const after = await this.add(change.data.after)
            return { appliedChanges: [{ ...change, data: { after } }], errors: [] }
          }
          if (change.action === 'remove') {
            await this.remove(change.data.before)
            return { appliedChanges: [change], errors: [] }
          }
          const after = await this.update(change.data.before, change.data.after)
          return { appliedChanges: [{ ...change, data: { ...change.data, after } }], errors: [] }
        } catch (e) {
          return { appliedChanges: [], errors: [e] }
        }
      })
    )
    return {
      appliedChanges: deployResults.map(d => d.appliedChanges).flat(),
      errors: deployResults.map(d => d.errors).flat(),
    }
  }

  /**
   * Add new instance
   * @param change the instance to add
   * @returns the updated element
   * @throws error in case of failure
   */
  private async add(change: ChangeDataType): Promise<ObjectType> {
    if (isObjectType(change)) {
      return this.addObjectType(change)
    }
    if (isField(change) && isCustomObject(change.parent)) {
      await this.addCustomObjectField(
        change.parent.annotations[API_NAME], { [change.name]: change },
      )
      await this.approveCustomObjectIfNeeded(change.parent.annotations)
      return createMarketoCustomObjectType(
        await this.getCustomObjectByName(change.parent.annotations[API_NAME])
      )
    }
    throw new Error('Can\'t create unsupported data type')
  }

  private async addObjectType(change: ObjectType): Promise<ObjectType> {
    if (isCustomObject(change)) {
      return this.createCustomObject(change)
    }
    throw new Error('Can\'t create unsupported object type')
  }

  /**
   * Remove an instance
   * @param change to remove
   * @throws error in case of failure
   */
  private async remove(change: ChangeDataType): Promise<void> {
    if (isCustomObject(change)) {
      await this.client.deleteCustomObject(
        change.annotations[API_NAME],
      )
    }
    if (isField(change) && isCustomObject(change.parent)) {
      await this.client.removeCustomObjectField(
        change.parent.annotations[API_NAME],
        {
          input: [change.name],
        }
      )
      await this.approveCustomObjectIfNeeded(change.parent.annotations)
    }
  }

  /**
   * Updates an Element
   * @param _before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @returns the updated element
   */
  private async update(
    _before: ChangeDataType,
    after: ChangeDataType,
  ): Promise<ObjectType> {
    if (isObjectType(after)) {
      return this.updateObjectType(after)
    }
    if (isField(after) && isCustomObject(after.parent)) {
      await this.client.updateCustomObjectField(
        after.parent.annotations[API_NAME],
        after.annotations[API_NAME],
        changeDataTypeToCustomObjectFieldRequest(after)
      )
    }
    throw new Error('Can\'t update unsupported data type')
  }

  private async updateObjectType(change: ObjectType): Promise<ObjectType> {
    if (isCustomObject(change)) {
      return this.updateCustomObject(change)
    }
    throw new Error('Can\'t update unsupported object type')
  }

  private async updateCustomObject(change: ObjectType): Promise<ObjectType> {
    const apiName = change.annotations[API_NAME]
    await this.client.createOrUpdateCustomObject({
      action: UPDATE_ONLY,
      ...changeDataTypeToCustomObjectRequest(change),
    })
    await this.approveCustomObjectIfNeeded(change.annotations)
    return createMarketoCustomObjectType(
      await this.getCustomObjectByName(apiName)
    )
  }

  private async createCustomObject(change: ObjectType): Promise<ObjectType> {
    const apiName = change.annotations[API_NAME]
    await this.client.createOrUpdateCustomObject({
      action: CREATE_ONLY,
      ...changeDataTypeToCustomObjectRequest(change),
    })
    await this.addCustomObjectField(apiName, change.fields)
    await this.approveCustomObjectIfNeeded(change.annotations)
    return createMarketoCustomObjectType(
      await this.getCustomObjectByName(apiName)
    )
  }

  private async addCustomObjectField(apiName: string, fields: FieldMap): Promise<void> {
    if (Object.keys(fields).length > 0) {
      await this.client.addCustomObjectField(apiName, {
        input: Object.keys(fields).map((name: string) =>
          changeDataTypeToCustomObjectFieldRequest(fields[name])),
      })
    }
  }

  private async getCustomObjectByName(name: string): Promise<CustomObjectResponse> {
    const customObjectTypes = await this.client.getCustomObjects(
      { names: [name] }
    ) as CustomObjectResponse[]
    // get custom object with 'names' filter may return irrelevant results
    const filteredCustomObject = customObjectTypes.filter(co =>
      (co.approved ? co.approved.apiName : co.draft?.apiName) === name)
    if (filteredCustomObject.length === 1) {
      return filteredCustomObject[0]
    }
    throw new Error('Too many Custom Object Types')
  }

  private async approveCustomObjectIfNeeded(annotations: Values): Promise<void> {
    if (annotations[STATE] === APPROVED_STATE) {
      await this.client.approveCustomObject(annotations[API_NAME])
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator,
    }
  }
}
