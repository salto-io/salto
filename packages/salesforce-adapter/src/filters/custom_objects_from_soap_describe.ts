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
import _ from 'lodash'
import { DescribeSObjectResult, Field as SObjField } from 'jsforce'
import { collections, values } from '@salto-io/lowerdash'
import { ObjectType, isInstanceElement, ElemID, InstanceElement, Element } from '@salto-io/adapter-api'
import { CUSTOM_OBJECT, COMPOUND_FIELD_TYPE_NAMES, NAME_FIELDS } from '../constants'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { getSObjectFieldElement, apiName, toCustomField } from '../transformers/transformer'
import { isInstanceOfType, ensureSafeFilterFetch } from './utils'
import { CustomField } from '../client/types'
import { createSkippedListConfigChangeFromError } from '../config_change'

const { awu, keyByAsync } = collections.asynciterable
const { makeArray } = collections.array


const createFieldValue = async (
  field: SObjField,
  objectName: string,
  objCompoundFieldNames: Record<string, string>,
  systemFields?: string[],
): Promise<CustomField> => {
  // temporary hack to maintain the current implementation of the code in transformer.ts
  // in the future we should change the implementation of getSObjectFieldElement to simply
  // create the values we need in the first place instead of having to go through toCustomField
  const tmpObj = new ObjectType({ elemID: new ElemID('salesforce', objectName) })
  const dummyField = getSObjectFieldElement(
    tmpObj,
    field,
    { apiName: objectName },
    objCompoundFieldNames,
    systemFields,
  )
  const customField = await toCustomField(dummyField, false)
  // continuation of the temporary hack, since toCustomField returns values with JS classes
  // The "JSON.parse" part is done to get just the properties without the classes
  // The "_.pickBy" is to avoid undefined values that cause things to crash down the line
  // Using JSON.stringify and not safeJsonStringify for performance and because the values here
  // were JSON initially and should be safe to convert back
  const fieldValues = _.pickBy(
    // eslint-disable-next-line no-restricted-syntax
    JSON.parse(JSON.stringify(customField)),
    values.isDefined,
  )

  return fieldValues as CustomField
}

const addSObjectInformationToInstance = async (
  instance: InstanceElement,
  sobject: DescribeSObjectResult,
  systemFields?: string[],
): Promise<void> => {
  // Add information to the object type
  _.defaults(
    instance.value,
    {
      keyPrefix: sobject.keyPrefix,
      label: sobject.label,
    }
  )
  // Fix fields type in case it is not an array yet
  // this can happen if there is just one field, or if there are no fields
  instance.value.fields = makeArray(instance.value.fields)
  // Add information about fields
  const fieldsFromMetadataApi = _.keyBy(instance.value.fields, field => field.fullName)

  const getCompoundTypeName = (nestedFields: SObjField[], compoundName: string): string => {
    if (compoundName === COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME) {
      return nestedFields.some(field => field.name === NAME_FIELDS.SALUTATION)
        ? COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME
        : COMPOUND_FIELD_TYPE_NAMES.FIELD_NAME_NO_SALUTATION
    }
    return compoundName
  }

  // Only fields with "child's" referring to a field as it's compoundField
  // should be regarded as compound.
  const objCompoundFieldNames = _.mapValues(
    _.groupBy(
      sobject.fields.filter(field => field.compoundFieldName !== undefined),
      field => field.compoundFieldName,
    ),
    getCompoundTypeName,
  )

  const sobjectFields = await Promise.all(
    sobject.fields
      .filter(field => !field.compoundFieldName) // Filter out nested fields of compound fields
      .map(field => createFieldValue(field, sobject.name, objCompoundFieldNames, systemFields))
  )

  sobjectFields.forEach(sobjectField => {
    const existingField = fieldsFromMetadataApi[sobjectField.fullName]
    if (existingField !== undefined) {
      _.defaults(existingField, sobjectField)
    } else {
      instance.value.fields.push(sobjectField)
    }
  })
}

const WARNING_MESSAGE = 'Encountered an error while trying to fetch additional information about Custom Objects'

/**
 * Custom objects filter.
 * Fetches the custom objects via the soap api and adds them to the elements
 */
const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'customObjectsFromDescribeFilter',
  onFetch: ensureSafeFilterFetch({
    filterName: 'describeSObjects',
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async (elements: Element[]): Promise<FilterResult> => {
      const customObjectInstances = await keyByAsync(
        awu(elements).filter(isInstanceElement).filter(isInstanceOfType(CUSTOM_OBJECT)),
        instance => apiName(instance),
      )
      if (_.isEmpty(customObjectInstances)) {
        // Not fetching custom objects, no need to do anything
        return {}
      }

      const availableObjects = await client.listSObjects()
      const potentialObjectNames = new Set(Object.keys(customObjectInstances))
      const objectNamesToDescribe = availableObjects
        .map(objDesc => objDesc.name)
        .filter(name => potentialObjectNames.has(name))

      const { result: sObjects, errors } = await client.describeSObjects(objectNamesToDescribe)

      await Promise.all(
        sObjects.map(
          description => addSObjectInformationToInstance(
            customObjectInstances[description.name],
            description,
            config.systemFields,
          )
        )
      )
      return {
        configSuggestions:
          errors
            .map(({ input, error }) => createSkippedListConfigChangeFromError({
              creatorInput: { metadataType: CUSTOM_OBJECT, name: input },
              error,
            })),
      }
    },
  }),
})

export default filterCreator
