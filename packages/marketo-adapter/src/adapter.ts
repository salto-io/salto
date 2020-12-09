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
import { FetchResult, AdapterOperations, ChangeGroup, DeployResult, InstanceElement, Element, ObjectType, ElemID, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
import { deployInstance, resolveValues } from '@salto-io/adapter-utils'
import MarketoClient from './client/client'
import { createMarketoObjectType, getLookUpName, Types } from './transformers/transformer'
import { LeadAttribute, CustomObject, MarketoMetadata } from './client/types'
import { MARKETO, OBJECTS_NAMES, TYPES_PATH } from './constants'


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
        return (await this.getAllCustomObjects())
          .map((co: CustomObject) =>
            createMarketoObjectType(co.name, co.fields))
      case OBJECTS_NAMES.LEAD:
        return [createMarketoObjectType(type,
          await this.client.describe(type) as LeadAttribute[])]
      default:
        throw new Error(`Unsupported type: ${type}`)
    }
  }

  private async getAllCustomObjects(): Promise<CustomObject[]> {
    const customObjectsMetadata = await this.client
      .getAllInstances(OBJECTS_NAMES.CUSTOM_OBJECT) as CustomObject[]
    if (customObjectsMetadata === undefined) {
      return []
    }
    return (await Promise.all(
      customObjectsMetadata.map(co =>
        this.client.describe(`${OBJECTS_NAMES.CUSTOM_OBJECT}/${co.name}`))
    )).flat() as CustomObject[]
  }

  public async deploy(changeGroup: ChangeGroup): Promise<DeployResult> {
    const operations = {
      add: this.add.bind(this),
      remove: this.remove.bind(this),
      update: this.update.bind(this),
    }
    return deployInstance(operations, changeGroup)
  }

  /**
   * Add new instance
   * @param instance the instance to add
   * @returns the updated element
   * @throws error in case of failure
   */
  // TODO(Guy): Implement
  private async add(instance: InstanceElement): Promise<InstanceElement> {
    const resolved = resolveValues(instance, getLookUpName)
    await this.client.createInstance(OBJECTS_NAMES.LEAD, { name: resolved.getType().elemID.name })
    const dummyObj = new ObjectType({
      elemID: new ElemID(MARKETO, OBJECTS_NAMES.LEAD),
      fields: {
        id: {
          refType: new ReferenceExpression(BuiltinTypes.NUMBER.elemID, BuiltinTypes.NUMBER),
        },
      },
      path: [MARKETO, TYPES_PATH, 'lead'],
    })
    return new InstanceElement('guy', dummyObj)
    // const resolved = resolveValues(instance, getLookUpName)
    // const resp = await this.client.createInstance(
    //   resolved.type.elemID.name,
    //   await createHubspotMetadataFromInstanceElement(resolved.clone(), this.client)
    // )
    // return restoreValues(
    //   instance,
    //   await transformAfterUpdateOrAdd(resolved, resp),
    //   getLookUpName
    // )
  }

  /**
   * Remove an instance
   * @param instance to remove
   * @throws error in case of failure
   */
  // TODO(Guy): Implement
  private async remove(instance: InstanceElement): Promise<void> {
    const resolved = resolveValues(instance, getLookUpName)
    await this.client.deleteInstance(
      resolved.getType().elemID.name,
      resolved.value as MarketoMetadata
    )
  }

  /**
   * Updates an Element
   * @param before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @returns the updated element
   */
  // TODO(Guy): Implement
  private async update(
    before: InstanceElement,
    after: InstanceElement,
  ): Promise<InstanceElement> {
    const resolvedBefore = resolveValues(before, getLookUpName)
    const resolvedAfter = resolveValues(after, getLookUpName)

    await this.client.updateInstance(
      OBJECTS_NAMES.LEAD,
      { name: resolvedBefore.getType().elemID.name }
    )
    await this.client.updateInstance(
      OBJECTS_NAMES.LEAD,
      { name: resolvedAfter.getType().elemID.name }
    )
    const dummyObj = new ObjectType({
      elemID: new ElemID(MARKETO, OBJECTS_NAMES.LEAD),
      fields: {
        id: {
          refType: new ReferenceExpression(BuiltinTypes.NUMBER.elemID, BuiltinTypes.NUMBER),
        },
      },
      path: [MARKETO, TYPES_PATH, 'lead'],
    })
    return new InstanceElement('tish', dummyObj)
    // const resolvedBefore = resolveValues(before, getLookUpName)
    // const resolvedAfter = resolveValues(after, getLookUpName)
    // validateFormGuid(resolvedBefore, resolvedAfter)
    // const resp = await this.client.updateInstance(
    //   resolvedAfter.type.elemID.name,
    //   await createHubspotMetadataFromInstanceElement(resolvedAfter.clone(), this.client)
    // )
    // return restoreValues(
    //   after,
    //   await transformAfterUpdateOrAdd(resolvedAfter, resp),
    //   getLookUpName
    // )
  }
}
