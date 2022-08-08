/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { ObjectType, isInstanceElement, ElemID, InstanceElement, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { CUSTOM_OBJECT, COMPOUND_FIELD_TYPE_NAMES, NAME_FIELDS, FIELD_ANNOTATIONS } from '../constants'
import { RemoteFilterCreator } from '../filter'
import { getSObjectFieldElement, apiName, toCustomField } from '../transformers/transformer'
import { isInstanceOfType, ensureSafeFilterFetch } from './utils'
import { CustomField } from '../client/types'

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
  const fieldValues = _.pickBy(
    JSON.parse(safeJsonStringify(customField)),
    values.isDefined,
  )

  // The old code would allow _required on certain types in fetch but not in deploy
  // so `toCustomField` sometimes removes the required annotation.
  // since the old code would not do that on fetch, we need to add it back in order
  // to preserve the old behavior
  if (dummyField.annotations[CORE_ANNOTATIONS.REQUIRED] === true) {
    fieldValues.required = true
  }

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
      pluralLabel: sobject.labelPlural,
    }
  )
  // Fix fields type in case it is not an array yet
  // this can happen if there is just one field, or if there are no fields
  instance.value.fields = makeArray(instance.value.fields)
  // Add information about fields
  const knownFields = _.keyBy(instance.value.fields, field => field.fullName)

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
    const knownField = knownFields[sobjectField.fullName]
    if (knownField !== undefined) {
      // Omit everything from type-less fields to preserve the behavior from the old code
      // this is not a good decision, but we maintain the old behavior to avoid noisy changes
      if (knownField.type === undefined) {
        Object.keys(knownField).forEach(key => { delete knownField[key] })
      }
      _.defaults(knownField, sobjectField)
      // Generally the old code took annotations from the metadata API
      // except for the field type, the field type was taken from the SOAP API
      // this is not a good decision, but we maintain the old behavior to avoid noisy changes
      _.merge(knownField, { type: sobjectField.type })
    } else {
      instance.value.fields.push(sobjectField)
    }
  })

  // Old code had a somewhat strange behavior where for objects that exist in both APIs
  // the fields that exist only in the metadata API would get a few extra annotations
  // this didn't happen for fields of objects that don't exist in the SOAP API at all...
  const sobjectFieldNames = new Set(sobjectFields.map(field => field.fullName))
  Object.values(knownFields)
    .filter(field => !sobjectFieldNames.has(field.fullName))
    .forEach(field => {
      _.defaults(
        field,
        {
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [FIELD_ANNOTATIONS.QUERYABLE]: false,
        },
      )
    })
}

const WARNING_MESSAGE = 'Encountered an error while trying to fetch additional information about Custom Objects'

/**
 * Custom objects filter.
 * Fetches the custom objects via the soap api and adds them to the elements
 */
const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  onFetch: ensureSafeFilterFetch({
    filterName: 'describeSObjects',
    warningMessage: WARNING_MESSAGE,
    config,
    fetchFilterFunc: async elements => {
      const customObjectInstances = await keyByAsync(
        awu(elements).filter(isInstanceElement).filter(isInstanceOfType(CUSTOM_OBJECT)),
        instance => apiName(instance),
      )
      if (_.isEmpty(customObjectInstances)) {
        // Not fetching custom objects, no need to do anything
        return
      }

      const availableObjects = await client.listSObjects()
      const potentialObjectNames = new Set(Object.keys(customObjectInstances))
      const objectNamesToDescribe = availableObjects
        .map(objDesc => objDesc.name)
        .filter(name => potentialObjectNames.has(name))

      const sObjects = await client.describeSObjects(objectNamesToDescribe)

      await Promise.all(
        sObjects.map(
          description => addSObjectInformationToInstance(
            customObjectInstances[description.name],
            description,
            config.systemFields,
          )
        )
      )
    },
  }),
})

export default filterCreator
