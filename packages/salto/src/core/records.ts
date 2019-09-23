import {
  ObjectType, Adapter, InstanceElement, Value, Values, ElemID,
} from 'adapter-api'
import { adapterId as SALESFORCE } from 'salesforce-adapter'

export const getInstancesOfType = (type: ObjectType, adapters: Record<string, Adapter>):
AsyncIterable<InstanceElement[]> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  return adapter.getInstancesOfType(type)
}

const recordToInstanceElement = (type: ObjectType, record: Values):
InstanceElement =>
  // Convert the result to Instance Elements
  new InstanceElement(
    new ElemID(SALESFORCE, type.elemID.name, record.Id),
    type,
    record
  )

const instancesIterator = async function *instancesIterator(
  type: ObjectType,
  records: Values[]
): AsyncIterable<InstanceElement> {
  const instances = records.map(record => recordToInstanceElement(type, record))
  // eslint-disable-next-line no-restricted-syntax
  for (const instance of instances) {
    yield instance
  }
}

export const importInstancesOfType = async (
  type: ObjectType, records: Value[], adapters: Record<string, Adapter>):
Promise<void> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  await adapter.importInstancesOfType(type, instancesIterator(type, records))
}

export const deleteInstancesOfType = async (
  type: ObjectType, records: Value[], adapters: Record<string, Adapter>):
Promise<void> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  await adapter.deleteInstancesOfType(type, instancesIterator(type, records))
}
