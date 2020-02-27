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
import {
  InstanceElement, ObjectType, Element,
} from './elements'
import { ElemID } from './element_id'
import { Change } from './change'
import { ChangeValidator } from './change_validators'
import { DependencyChanger } from './dependency_changer'

export interface DataModificationResult {
  successfulRows: number
  failedRows: number
  errors: Set<string>
}

export interface Adapter {
  fetch(): Promise<Element[]>
  add(element: Element): Promise<Element>
  remove(element: Element): Promise<void>
  update(before: Element, after: Element, changes: Iterable<Change>): Promise<Element>
  getInstancesOfType?(type: ObjectType): AsyncIterable<InstanceElement[]>
  importInstancesOfType?(
    type: ObjectType,
    records: AsyncIterable<InstanceElement>
  ): Promise<DataModificationResult>
  deleteInstancesOfType?(
    type: ObjectType,
    records: AsyncIterable<ElemID>
  ): Promise<DataModificationResult>
}

export const OBJECT_SERVICE_ID = 'object_service_id'
export const ADAPTER = 'adapter'
export type ServiceIds = Record<string, string>
export const toServiceIdsString = (serviceIds: ServiceIds): string =>
  Object.entries(serviceIds).sort().toString()
export type ElemIdGetter = (adapterName: string, serviceIds: ServiceIds, name: string) => ElemID

export type AdapterCreator = {
  create: (opts: { config: InstanceElement; getElemIdFunc?: ElemIdGetter }) => Adapter
  validateConfig: (config: Readonly<InstanceElement>) => Promise<void>
  configType: ObjectType
  changeValidator?: ChangeValidator
  dependencyChanger?: DependencyChanger
}
