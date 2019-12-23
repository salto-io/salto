import {
  InstanceElement, ObjectType, Element, ElemID,
} from './elements'
import { Change } from './change'
import { ChangeValidator } from './change_validators'

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
  getInstancesOfType(type: ObjectType): AsyncIterable<InstanceElement[]>
  importInstancesOfType(
    type: ObjectType,
    records: AsyncIterable<InstanceElement>
  ): Promise<DataModificationResult>
  deleteInstancesOfType(
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
  configType: ObjectType
  changeValidator?: ChangeValidator
}
