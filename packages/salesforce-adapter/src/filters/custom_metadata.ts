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
import { logger } from '@salto-io/logging'
import {
  isInstanceElement,
  Values,
  isInstanceChange,
  isAdditionOrModificationChange,
  isObjectType,
  InstanceElement,
  ObjectType,
  ElemID,
  getChangeData,
  Change,
  toChange, isModificationChange, ModificationChange, AdditionChange,
} from '@salto-io/adapter-api'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { isCustomMetadataRecordInstance, isCustomMetadataRecordType, isInstanceOfType } from './utils'
import {
  CUSTOM_METADATA, CUSTOM_METADATA_SUFFIX,
  FIELD_TYPE_NAMES,
  INTERNAL_ID_FIELD,
  SALESFORCE,
  SALESFORCE_CUSTOM_SUFFIX,
  XML_ATTRIBUTE_PREFIX,
} from '../constants'
import {
  apiName,
  createInstanceElement,
  isNull,
  MetadataValues,
} from '../transformers/transformer'

const log = logger(module)
const { awu, keyByAsync } = collections.asynciterable
const { makeArray } = collections.array
const { isDefined } = lowerdashValues

type XsiType = 'xsd:boolean' | 'xsd:date' | 'xsd:dateTime' | 'xsd:picklist' | 'xsd:string' | 'xsd:int' | 'xsd:double'
const SUPPORTED_CUSTOM_METADATA_FIELD_TYPES = [
  FIELD_TYPE_NAMES.CHECKBOX, FIELD_TYPE_NAMES.METADATA_RELATIONSHIP,
  FIELD_TYPE_NAMES.DATE, FIELD_TYPE_NAMES.DATETIME,
  FIELD_TYPE_NAMES.PICKLIST, FIELD_TYPE_NAMES.TEXT,
  FIELD_TYPE_NAMES.PHONE, FIELD_TYPE_NAMES.TEXTAREA, FIELD_TYPE_NAMES.LONGTEXTAREA,
  FIELD_TYPE_NAMES.URL, FIELD_TYPE_NAMES.EMAIL,
  FIELD_TYPE_NAMES.NUMBER, FIELD_TYPE_NAMES.PERCENT,
] as const

type CustomMetadataFieldType = typeof SUPPORTED_CUSTOM_METADATA_FIELD_TYPES[number]

const FIELD_TYPE_TO_XSI_TYPE: Record<CustomMetadataFieldType, XsiType> = {
  LongTextArea: 'xsd:string',
  MetadataRelationship: 'xsd:string',
  Checkbox: 'xsd:boolean',
  Date: 'xsd:date',
  DateTime: 'xsd:dateTime',
  Email: 'xsd:string',
  Number: 'xsd:double',
  Percent: 'xsd:double',
  Phone: 'xsd:string',
  Picklist: 'xsd:string',
  Text: 'xsd:string',
  TextArea: 'xsd:string',
  Url: 'xsd:string',
}


type NullValue = {
  // The "attr_" here is actually XML_ATTRIBUTE_PREFIX
  'attr_xsi:nil': string
}
type ServiceMDTRecordFieldValue = {
  field: string
  value?: NullValue | {
    '#text': string
    // The "attr_" here is actually XML_ATTRIBUTE_PREFIX
    'attr_xsi:type': string
  }
}
export type ServiceMDTRecordValue = Values & {
  values: ServiceMDTRecordFieldValue | ServiceMDTRecordFieldValue[]
}

const isServiceMDTRecordFieldValue = (value: Values): value is ServiceMDTRecordFieldValue => (
  _.isString(value.field)
  && (
    value.value === undefined
    || isNull(value.value)
    || _.isString(value.value[`${XML_ATTRIBUTE_PREFIX}xsi:type`])
  )
)

const isServiceMDTRecordValues = (value: Values): value is ServiceMDTRecordValue => (
  'values' in value
  && makeArray(value.values).every(isServiceMDTRecordFieldValue)
)

type NaclMDTRecordFieldValue = {
  field: string
  value?: string
  type?: string
}


const serviceFieldValueToNaclValue = (
  value: ServiceMDTRecordFieldValue
): NaclMDTRecordFieldValue => ({
  field: value.field,
  ...isNull(value.value)
    ? {}
    : { value: _.get(value.value, '#text'), type: _.get(value.value, 'attr_xsi:type') },
})


const additionalNamespaces = Object.fromEntries([
  [`${XML_ATTRIBUTE_PREFIX}xmlns:xsd`, 'http://www.w3.org/2001/XMLSchema'],
  [`${XML_ATTRIBUTE_PREFIX}xmlns:xsi`, 'http://www.w3.org/2001/XMLSchema-instance'],
])

const resolveCustomMetadataType = async (
  instance: InstanceElement,
  customMetadataTypes: ObjectType[],
): Promise<ObjectType> => {
  const customMetadataTypeName = (await apiName(instance)).split('.')[0].concat(CUSTOM_METADATA_SUFFIX)
  const correctType = customMetadataTypes
    .find(objectType => objectType.elemID.typeName === customMetadataTypeName)
  if (correctType === undefined) {
    log.warn('Could not fix type for CustomMetadataType Instance %o, since its CustomMetadata record type was not found', instance)
    return instance.getType()
  }
  return correctType
}

const extractValuesToFields = (
  recordValues: ServiceMDTRecordValue
): Values => Object.fromEntries(
  makeArray(recordValues?.values)
    .map(serviceFieldValueToNaclValue)
    .filter(({ value }) => isDefined(value))
    .map(({ field, value }) => [field, value])
)

const formatMDTRecordValuesToNacl = (values: ServiceMDTRecordValue): Values => (
  _.omit({
    ...values,
    ...extractValuesToFields(values),
  }, 'values', Object.keys(additionalNamespaces))
)

const getCustomFieldsXsiTypes = async (
  instance: InstanceElement
): Promise<Record<string, string>> => {
  const objectType = await instance.getType()
  const fieldsToXsiTypes: Record<string, string> = {}
  await awu(Object.entries(objectType.fields))
    .filter(([fieldName]) => fieldName.endsWith(SALESFORCE_CUSTOM_SUFFIX))
    .forEach(async ([fieldName, field]) => {
      const fieldTypeName = (await field.getType()).elemID.typeName
      const fieldType = SUPPORTED_CUSTOM_METADATA_FIELD_TYPES
        .find(v => v.valueOf() === fieldTypeName)
      if (_.isUndefined(fieldType)) {
        throw new Error(`Unsupported CustomMetadata field type: ${fieldTypeName}`)
      }
      fieldsToXsiTypes[fieldName] = FIELD_TYPE_TO_XSI_TYPE[fieldType]
    })
  return fieldsToXsiTypes
}

const formatRecordValuesForService = async (
  instance: InstanceElement,
): Promise<Values> => {
  const instanceType = await instance.getType()
  const fieldsXsiTypes = await getCustomFieldsXsiTypes(instance)
  const values = await awu(Object.entries(instanceType.fields))
    .filter(([fieldName]) => fieldName.endsWith(SALESFORCE_CUSTOM_SUFFIX))
    .map(async ([fieldName]) => {
      const fieldValue = await instance.value[fieldName]
      if (isDefined(fieldValue)) {
        return {
          field: fieldName,
          value: { '#text': fieldValue, 'attr_xsi:type': fieldsXsiTypes[fieldName] },
        }
      }
      return {
        field: fieldName,
        value: { 'attr_xsi:nil': 'true' },
      }
    }).toArray()

  return {
    ...additionalNamespaces,
    ..._.omit(instance.value,
      INTERNAL_ID_FIELD,
      Object.keys(instance.value).filter(k => k.endsWith(SALESFORCE_CUSTOM_SUFFIX))),
    values,
  }
}

const toInstanceWithCorrectType = async (
  instance: InstanceElement,
  customMetadataRecordTypes: ObjectType[]
): Promise<InstanceElement> => {
  const correctType = await resolveCustomMetadataType(instance, customMetadataRecordTypes)

  const formattedValues = isServiceMDTRecordValues(instance.value)
    ? formatMDTRecordValuesToNacl(instance.value)
    : instance.value
  return createInstanceElement(formattedValues as MetadataValues, correctType)
}

const CUSTOM_METADATA_TYPE = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'CustomMetadata'),
  annotations: {
    suffix: 'md',
    dirName: 'customMetadata',
    metadataType: 'CustomMetadata',
  },
})

const toDeployableChange = async (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>
): Promise<Change<InstanceElement>> => {
  const deployableAfter = createInstanceElement(
    await formatRecordValuesForService(getChangeData(change)) as MetadataValues,
    CUSTOM_METADATA_TYPE,
  )
  return isModificationChange(change)
    ? toChange({ before: change.data.before, after: deployableAfter })
    : toChange({ after: deployableAfter })
}

const filterCreator: LocalFilterCreator = () => {
  let originalChangesByApiName: Record<string, Change>
  return {
    onFetch: async elements => {
      const customMetadataRecordTypes = await awu(elements)
        .filter(isObjectType)
        .filter(isCustomMetadataRecordType)
        .toArray()
      const oldInstances = await awu(elements)
        .filter(isInstanceElement)
        .filter(isInstanceOfType(CUSTOM_METADATA))
        .toArray()
      const newInstances = await awu(oldInstances)
        .map(instance => toInstanceWithCorrectType(instance, customMetadataRecordTypes))
        .toArray()
      _.pullAll(elements, oldInstances)
      elements.push(...newInstances)
    },

    preDeploy: async changes => {
      const originalChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => isCustomMetadataRecordInstance(getChangeData(change)))
        .toArray()
      originalChangesByApiName = await keyByAsync(
        originalChanges,
        c => apiName(getChangeData(c))
      )
      const deployableChanges = await awu(originalChanges).map(toDeployableChange).toArray()

      _.pullAll(changes, originalChanges)
      deployableChanges.forEach(change => changes.push(change))
    },

    onDeploy: async changes => {
      const appliedChanges = await awu(changes)
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => isInstanceOfType(CUSTOM_METADATA)(getChangeData(change)))
        .toArray()
      _.pullAll(changes, appliedChanges)
      await awu(appliedChanges).forEach(async appliedChange => {
        const name = await apiName(getChangeData(appliedChange))
        changes.push(originalChangesByApiName[name])
      })
    },
  }
}

export default filterCreator
