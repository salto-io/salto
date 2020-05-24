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
  Element, InstanceElement, ObjectType, FetchResult,
} from '@salto-io/adapter-api'
import {
  resolveValues, restoreValues,
} from '@salto-io/adapter-utils'
import {
  HubspotMetadata,
} from './client/types'
import HubspotClient from './client/client'
import {
  Types, createHubspotInstanceElement, createHubspotMetadataFromInstanceElement,
  transformAfterUpdateOrAdd, getLookUpName,
} from './transformers/transformer'
import { FilterCreator } from './filter'
import hideTypesFilter from './filters/hide_types'
import formFieldFilter from './filters/form_field'
import useridentifierFilter from './filters/useridentifier'
import instanceTransformFilter from './filters/instance_transform'

const validateFormGuid = (
  before: InstanceElement,
  after: InstanceElement
): void => {
  if (before.value.guid !== after.value.guid) {
    throw Error(
      `Failed to update element as guid's prev=${
        before.value.guid
      } and new=${after.value.guid} are different`
    )
  }
}

export interface HubspotAdapterParams {
  // client to use
  client: HubspotClient
  filtersCreators?: FilterCreator[]
}

export default class HubspotAdapter {
  private client: HubspotClient
  private filtersCreators: FilterCreator[]

  public constructor({
    client,
    filtersCreators = [
      hideTypesFilter,
      useridentifierFilter,
      formFieldFilter,
      instanceTransformFilter,
    ],
  }: HubspotAdapterParams) {
    this.client = client
    this.filtersCreators = filtersCreators
  }

  /**
   * Fetch configuration elements: objects, types and instances for the given HubSpot account.
   * Account credentials were given in the constructor.
   */
  public async fetch(): Promise<FetchResult> {
    const fieldTypes = Types.getAllFieldTypes()
    const objects = Object.values(Types.hubspotObjects)
    const subTypes = Types.hubspotSubTypes
    const instances = await this.fetchHubInstances(objects)

    const elements = _.flatten(
      [fieldTypes, objects, subTypes, instances] as Element[][]
    )
    await this.runFiltersOnFetch(elements)
    return { elements }
  }

  private async fetchHubInstances(
    types: ObjectType[]
  ): Promise<InstanceElement[]> {
    const instances = await Promise.all((types)
      .map(t => this.fetchHubspotInstances(t)))
    return _.flatten(instances)
  }

  private async fetchHubspotInstances(type: ObjectType): Promise<InstanceElement[]> {
    const instances = await this.client.getAllInstances(type.elemID.name)
    return instances
      .map(i => createHubspotInstanceElement(i, type))
  }


  /**
   * Add new instance
   * Hubspot API support only instances additions
   * @param instance the instance to add
   * @returns the updated element
   * @throws error in case of failure
   */
  public async add(instance: InstanceElement): Promise<InstanceElement> {
    const resolved = resolveValues(instance, getLookUpName)
    const resp = await this.client.createInstance(
      resolved.type.elemID.name,
      await createHubspotMetadataFromInstanceElement(resolved.clone(), this.client)
    )
    return restoreValues(
      instance,
      await transformAfterUpdateOrAdd(resolved, resp),
      getLookUpName
    )
  }

  /**
   * Remove an instance
   * @param instance to remove
   * @throws error in case of failure
   */
  public async remove(instance: InstanceElement): Promise<void> {
    const resolved = resolveValues(instance, getLookUpName)
    await this.client.deleteInstance(
      resolved.type.elemID.name,
      resolved.value as HubspotMetadata
    )
  }

  /**
   * Updates an Element
   * @param before The metadata of the old element
   * @param after The new metadata of the element to replace
   * @returns the updated element
   */
  public async update(
    before: InstanceElement,
    after: InstanceElement,
  ): Promise<InstanceElement> {
    const resolvedBefore = resolveValues(before, getLookUpName)
    const resolvedAfter = resolveValues(after, getLookUpName)
    validateFormGuid(resolvedBefore, resolvedAfter)
    const resp = await this.client.updateInstance(
      resolvedAfter.type.elemID.name,
      await createHubspotMetadataFromInstanceElement(resolvedAfter.clone(), this.client)
    )
    return restoreValues(
      after,
      await transformAfterUpdateOrAdd(resolvedAfter, resp),
      getLookUpName
    )
  }

  private async runFiltersOnFetch(elements: Element[]): Promise<void> {
    // Fetch filters order is important so they should run one after the other
    return this.filtersCreators.map(filterCreator => filterCreator({ client: this.client })).reduce(
      (prevRes, filter) => prevRes.then(() => filter.onFetch(elements)),
      Promise.resolve(),
    )
  }
}
