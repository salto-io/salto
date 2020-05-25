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
import { InstanceElement, ObjectType, Element, isObjectType, Field, Values } from '@salto-io/adapter-api'
import { SalesforceClient } from 'index'
import { SALESFORCE, RECORDS_PATH, INSTALLED_PACKAGES_PATH } from '../constants'
import { FilterCreator } from '../filter'
import { apiName, isCustomObject, Types } from '../transformers/transformer'
import { getNamespace } from './utils'

const isNameField = (field: Field): boolean =>
  (isObjectType(field.type)
    && field.type.elemID.isEqual(Types.compoundDataTypes.Name.elemID))

const buildQueryString = (type: ObjectType): string => {
  const selectStr = Object.values(type.fields)
    .map(field => {
      if (isNameField(field)) {
        return Object.keys((field.type as ObjectType).fields).join(',')
      }
      return apiName(field, true)
    }).join(',')
  return `SELECT ${selectStr} FROM ${apiName(type)}`
}

const consumeAsyncIterable = async <Values, InstanceElement>(
  itr: { [Symbol.asyncIterator]: () => AsyncIterator<Values[]> },
  transformer: (t: Values[]) => InstanceElement[],
): Promise<Array<InstanceElement>> => {
  const res: InstanceElement[] = []
  const iter = itr[Symbol.asyncIterator]()
  const next = async (): Promise<void> => {
    const curr = await iter.next()
    if (curr.done) return undefined
    if (_.isArray(curr.value) && curr.value.length > 0) {
      res.push(...transformer(curr.value))
    }
    return next()
  }
  await next()
  return res
}

const getObjectInstances = async (
  client: SalesforceClient,
  object: ObjectType
): Promise<Array<InstanceElement>> => {
  const recordsToInstances = (records: Values[]): InstanceElement[] => {
    const recordToInstance = (record: Values): InstanceElement => {
      const getInstancePath = (instanceName: string): string[] => {
        const objectNamespace = getNamespace(object)
        if (objectNamespace) {
          return [SALESFORCE, INSTALLED_PACKAGES_PATH, objectNamespace,
            RECORDS_PATH, object.elemID.typeName, instanceName]
        }
        return [SALESFORCE, RECORDS_PATH, object.elemID.typeName, instanceName]
      }

      return new InstanceElement(
        // TODO: Handle elemID with additional logic
        record.Id,
        object,
        record,
        getInstancePath(record.Id),
      )
    }

    // Name sub-fields are returned at top level -> move them to the nameField
    const transformNameValues = (values: Values[]): Values[] => {
      const nameSubFields = Object.keys(Types.compoundDataTypes.Name.fields)
      // We assume there's only one Name field
      const nameFieldName = Object.keys(_.pickBy(object.fields, isNameField))[0]
      return values.map(value => ({
        ..._.omit(value, nameSubFields),
        ...nameFieldName !== undefined ? { [nameFieldName]: _.pick(value, nameSubFields) } : {},
      }))
    }

    const instanceValues = transformNameValues(records)
    return instanceValues.map(recordToInstance)
  }
  const queryString = buildQueryString(object)
  const recordsIterable = await client.queryAll(queryString)
  return consumeAsyncIterable(recordsIterable, recordsToInstances)
}

const getObjectTypesInstances = async (
  client: SalesforceClient,
  objects: ObjectType[]
): Promise<InstanceElement[]> =>
  (_.flatten(await Promise.all(objects.map(o => getObjectInstances(client, o)))))

const filterObjectTypes = (elements: Element[], namespaces: string[]): ObjectType[] =>
  (elements
    .filter(isObjectType)
    .filter(isCustomObject)
    .filter(e => {
      const namespace = getNamespace(e)
      return namespace !== undefined && namespaces.includes(namespace)
    }))

const filterCreator: FilterCreator = ({ client, config }) => ({
  onFetch: async (elements: Element[]) => {
    if (_.isUndefined(config.namespacesToFetchInstancesFor)
      || config.namespacesToFetchInstancesFor === []) {
      return
    }
    const relevantObjectTypes = filterObjectTypes(elements, config.namespacesToFetchInstancesFor)
    const instances = await getObjectTypesInstances(client, relevantObjectTypes)
    elements.push(...instances)
  },
})

export default filterCreator
