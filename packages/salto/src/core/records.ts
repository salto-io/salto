import {
  ObjectType, Adapter, InstanceElement, Values, ElemID,
} from 'adapter-api'
import { adapterId as SALESFORCE } from 'salesforce-adapter'
import { readCsvFromStream, dumpCsv } from './csv'

export const getInstancesOfType = async (
  type: ObjectType,
  adapters: Record<string, Adapter>,
  outPath: string
): Promise<void> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  const outputObjectsIterator = await adapter.getInstancesOfType(type)
  let toAppend = false
  // eslint-disable-next-line no-restricted-syntax
  for await (const objects of outputObjectsIterator) {
    await dumpCsv(objects.map(instance => instance.value), outPath, toAppend)
    toAppend = true
  }
}

const recordToInstanceElement = (type: ObjectType, record: Values):
InstanceElement =>
  // Convert the result to Instance Elements
  new InstanceElement(record.Id, type, record)

const instancesIterator = async function *instancesIterator(
  type: ObjectType,
  inputPath: string
): AsyncIterable<InstanceElement> {
  const csvIterator = readCsvFromStream(inputPath)
  // eslint-disable-next-line no-restricted-syntax
  for await (const record of csvIterator) {
    yield recordToInstanceElement(type, record)
  }
}

export const importInstancesOfType = async (
  type: ObjectType, inputPath: string, adapters: Record<string, Adapter>):
Promise<void> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  await adapter.importInstancesOfType(instancesIterator(type, inputPath))
}

// Convert the result to Instance Elements
const recordToElementId = (type: ObjectType, record: Values):
ElemID => new ElemID(SALESFORCE, type.elemID.name, record.Id)

const elemIdsIterator = async function *elemIdsIterator(
  type: ObjectType,
  inputPath: string
): AsyncIterable<ElemID> {
  const csvIterator = readCsvFromStream(inputPath)
  // eslint-disable-next-line no-restricted-syntax
  for await (const record of csvIterator) {
    yield recordToElementId(type, record)
  }
}

export const deleteInstancesOfType = async (
  type: ObjectType, inputPath: string, adapters: Record<string, Adapter>):
Promise<void> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }
  await adapter.deleteInstancesOfType(type, elemIdsIterator(type, inputPath))
}
