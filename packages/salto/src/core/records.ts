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
  ObjectType, Adapter, InstanceElement, Values, ElemID, DataModificationResult,
} from 'adapter-api'
import { adapterId as SALESFORCE } from 'salesforce-adapter'
import { readCsvFromStream, dumpCsv } from './csv'

export const getInstancesOfType = async (
  type: ObjectType,
  adapters: Record<string, Adapter>,
  outPath: string
): Promise<DataModificationResult> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }

  if (!adapter.getInstancesOfType) {
    throw new Error(`getInstancesOfType is undefined for adapter: ${type.elemID.adapter}`)
  }

  let toAppend = false
  const returnResult = {
    successfulRows: 0,
    failedRows: 0,
    errors: new Set<string>(),
  }
  try {
    const outputObjectsIterator = await adapter.getInstancesOfType(type)
    // eslint-disable-next-line no-restricted-syntax
    for await (const objects of outputObjectsIterator) {
      await dumpCsv(objects.map(instance => instance.value), outPath, toAppend)
      toAppend = true
      returnResult.successfulRows += objects.length
    }
  } catch (error) {
    returnResult.errors.add(error)
  }
  return returnResult
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
  Promise<DataModificationResult> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }

  if (!adapter.importInstancesOfType) {
    throw new Error(`importInstancesOfType is undefined for adapter: ${type.elemID.adapter}`)
  }

  return adapter.importInstancesOfType(type, instancesIterator(type, inputPath))
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
  type: ObjectType,
  inputPath: string,
  adapters: Record<string, Adapter>
): Promise<DataModificationResult> => {
  const adapter = adapters[type.elemID.adapter]
  if (!adapter) {
    throw new Error(`Failed to find the adapter for the given type: ${type.elemID.getFullName()}`)
  }

  if (!adapter.deleteInstancesOfType) {
    throw new Error(`deleteInstancesOfType is undefined for adapter: ${type.elemID.adapter}`)
  }

  return adapter.deleteInstancesOfType(type, elemIdsIterator(type, inputPath))
}
