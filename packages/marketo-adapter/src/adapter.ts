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
import {
  FetchResult,
  AdapterOperations,
  ChangeGroup,
  DeployResult,
  InstanceElement,
  Element, ObjectType, ElemID, BuiltinTypes,
} from '@salto-io/adapter-api'
import { deployInstance, resolveValues } from '@salto-io/adapter-utils'
import MarketoClient from './client/client'
import { FilterCreator } from './filter'
import { getLookUpName, Types } from './transformers/transformer'
import { MarketoMetadata } from './client/types'
import { MARKETO, OBJECTS_NAMES, TYPES_PATH } from './constants'


export interface MarketoAdapterParams {
  client: MarketoClient
  filtersCreators?: FilterCreator[]
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
    const objects = await Types.getAllMarketoObjects(this.client)
    // const instances = await this.fetchMarketoInstances(objects)

    const elements = _.flatten(
      [fieldTypes, objects] as Element[][]
    )
    return { elements }
  }

  // private async fetchMarketoInstances(
  //   types: ObjectType[]
  // ): Promise<InstanceElement[]> {
  //   const instances = await Promise.all((types)
  //     .map(t => this.getAllMarketoInstances(t)))
  //   return _.flatten(instances)
  // }

  // private async getAllMarketoInstances(type: ObjectType): Promise<InstanceElement[]> {
  //   const instances = await this.client.getAllInstances<MarketoMetadata[]>(type.elemID.name)
  //   if (_.isUndefined(instances)) {
  //     return []
  //   }
  //   return instances
  //     .map(i => createMarketoInstanceElement(i, type))
  // }

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
    await this.client.createInstance(OBJECTS_NAMES.LEAD, { name: resolved.type.elemID.name })
    return new InstanceElement('guy', new ObjectType({
      elemID: new ElemID(MARKETO, OBJECTS_NAMES.LEAD),
      fields: {
        id: {
          type: BuiltinTypes.NUMBER,
        },
      },
      path: [MARKETO, TYPES_PATH, 'lead'],
    }))
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
      resolved.type.elemID.name,
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

    await this.client.updateInstance(OBJECTS_NAMES.LEAD, { name: resolvedBefore.type.elemID.name })
    await this.client.updateInstance(OBJECTS_NAMES.LEAD, { name: resolvedAfter.type.elemID.name })
    return new InstanceElement('tish', new ObjectType({
      elemID: new ElemID(MARKETO, OBJECTS_NAMES.LEAD),
      fields: {
        id: {
          type: BuiltinTypes.NUMBER,
        },
      },
      path: [MARKETO, TYPES_PATH, 'lead'],
    }))
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
