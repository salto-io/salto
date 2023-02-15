/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, InstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { FilterResult, RemoteFilterCreator } from '../filter'
import {
  createLookupToolingField,
  createToolingField,
  createToolingObject,
  ensureSafeFilterFetch,
  isLookupField,
  isSupportedToolingObjectName,
} from './utils'
import {
  API_NAME,
  FIELD_ANNOTATIONS,
  MAX_QUERY_LIMIT,
  SupportedToolingObject,
  SupportedToolingObjectName,
} from '../constants'
import { getSObjectFieldElement } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { LookupField, ToolingField, ToolingObjectType } from '../types'

const log = logger(module)
const { awu, toArrayAsync } = collections.asynciterable
const { makeArray, keyBy } = collections.array
const { isDefined } = values

const WARNING_MESSAGE = 'Encountered an error while trying to fetch info about the installed packages'

const TOP_LEVEL_TYPES: SupportedToolingObjectName[] = [
  SupportedToolingObject.InstalledSubscriberPackage,
]

const isTopLevelType = (toolingObjectName: SupportedToolingObjectName): boolean => (
  TOP_LEVEL_TYPES.includes(toolingObjectName)
)

const getToolingObjectIds = async (client: SalesforceClient, toolingObjectName: SupportedToolingObjectName):
  Promise<string[]> => {
  const query = `SELECT Id FROM ${toolingObjectName} LIMIT ${MAX_QUERY_LIMIT}`
  return (await toArrayAsync(await client.queryAll(query, true)))
    .flat()
    .map(record => record.Id)
}

type ToolingLookupField = LookupField & ToolingField
const isToolingLookupField = (field: ToolingField): field is ToolingLookupField => {
  const referencedObject = makeArray(field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO])[0]
  return isLookupField(field)
    && _.isString(referencedObject)
}

const convertLookupField = async (
  field: ToolingLookupField,
  toolingObjectTypeByName: Record<SupportedToolingObjectName, ToolingObjectType>
): Promise<void> => {
  const referencedObjectName = field.annotations[FIELD_ANNOTATIONS.REFERENCE_TO][0]
  if (!isSupportedToolingObjectName(referencedObjectName)) {
    return
  }
  const referencedObjectType = toolingObjectTypeByName[referencedObjectName]
  const { parent } = field
  delete parent.fields[field.name]
  if (referencedObjectType === undefined) {
    return
  }
  Object.assign(
    parent.fields,
    keyBy(createLookupToolingField(field, parent, referencedObjectType), toolingField => toolingField.name)
  )
}

const createToolingObjectTypeFromDescribe = async (
  client: SalesforceClient,
  objectName: SupportedToolingObjectName,
): Promise<ToolingObjectType | undefined> => {
  const { result, errors } = await client.describeToolingObject(objectName)
  if (!_.isEmpty(errors) || _.isEmpty(result)) {
    log.warn('Failed to describe tooling object %s: %o', objectName, errors)
    return undefined
  }
  const [typeDescription] = result

  const [topLevelFields, nestedFields] = _.partition(
    typeDescription.fields,
    field => _.isNil(field.compoundFieldName)
  )

  const objCompoundFieldNames = _.mapValues(
    _.groupBy(nestedFields, field => field.compoundFieldName),
    (_nestedFields, compoundName) => compoundName,
  )

  const toolingType = createToolingObject(objectName)
  const toolingFields = topLevelFields.map(sObjectField =>
    getSObjectFieldElement(
      toolingType,
      sObjectField,
      { [API_NAME]: objectName },
      objCompoundFieldNames
    ))
    .map(field => createToolingField(toolingType, field))
  toolingType.fields = keyBy(toolingFields, field => field.name)
  return toolingType
}

const fetchToolingInstances = async (
  client: SalesforceClient,
  topLevelTypeName: SupportedToolingObjectName
): Promise<InstanceElement[]> => {
  /**
   * - SELECT Id FROM ToolingObjectType LIMIT 200
   * - client.retrieveToolingObjects(ToolingObjectType, ids)
   * - Create instances
   */
  const ids = await getToolingObjectIds(client, topLevelTypeName)
  console.log(ids)
  return []
}

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'getInstalledPackagesFilter',
  onFetch: ensureSafeFilterFetch({
    filterName: 'describeSObjects',
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async (elements: Element[]): Promise<void | FilterResult> => {
      const toolingTypes = await awu(Object.values(SupportedToolingObject))
        .map(objectName => createToolingObjectTypeFromDescribe(client, objectName))
        .filter(isDefined)
        .toArray()
      const toolingTypesByName = keyBy(toolingTypes, type => type.annotations[API_NAME])
      await awu(toolingTypes)
        .flatMap(toolingType => Object.values(toolingType.fields))
        .filter(isToolingLookupField)
        .forEach(lookupField => convertLookupField(lookupField, toolingTypesByName))
      const instances = await awu(toolingTypes)
        .map(toolingType => toolingType.annotations[API_NAME])
        .filter(isTopLevelType)
        .flatMap(toolingType => fetchToolingInstances(client, toolingType))
        .toArray()
      toolingTypes.forEach(toolingType => elements.push(toolingType))
      instances.forEach(toolingInstance => elements.push(toolingInstance))
    },
  }),
})


export default filterCreator
