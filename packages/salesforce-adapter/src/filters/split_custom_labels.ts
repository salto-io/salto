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
import {
  BuiltinTypes,
  Change, ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isObjectType, ListType,
  ObjectType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import Joi from 'joi'
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard, pathNaclCase } from '@salto-io/adapter-utils'
import { LocalFilterCreator, FilterWith } from '../filter'
import { apiName, createInstanceElement, metadataAnnotationTypes } from '../transformers/transformer'
import { getDataFromChanges, isInstanceOfType } from './utils'
import {
  CUSTOM_LABEL_METADATA_TYPE,
  CUSTOM_LABELS_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD, METADATA_TYPE, RECORDS_PATH,
  SALESFORCE,
} from '../constants'


const log = logger(module)

const CUSTOM_LABELS_FULL_NAME = 'CustomLabels'
const CUSTOM_LABEL_INSTANCES_FILE_NAME = 'All'
export const CUSTOM_LABEL_INSTANCES_FILE_PATH = [
  SALESFORCE,
  RECORDS_PATH,
  pathNaclCase(CUSTOM_LABEL_METADATA_TYPE),
  pathNaclCase(CUSTOM_LABEL_INSTANCES_FILE_NAME),
]


const { awu } = collections.asynciterable
const { makeArray } = collections.array


type CustomLabel = {
  [INSTANCE_FULL_NAME_FIELD]: string
}

type CustomLabels = {
  labels: CustomLabel[]
}

type CustomLabelsInstance = InstanceElement & {
  value: CustomLabels
}

const CUSTOM_LABEL_SCHEMA = Joi.object({
  [INSTANCE_FULL_NAME_FIELD]: Joi.string().required(),
}).unknown(true)


const isCustomLabelsType = isInstanceOfType(CUSTOM_LABELS_METADATA_TYPE)

const isCustomLabel = createSchemeGuard(CUSTOM_LABEL_SCHEMA)

const isCustomLabelsInstance = async (e: InstanceElement): Promise<boolean> => (
  await isCustomLabelsType(e) && makeArray(e.value.labels).every(isCustomLabel)
)

const isCustomLabelType = isInstanceOfType(CUSTOM_LABEL_METADATA_TYPE)

const isCustomLabelChange = async (change: Change): Promise<boolean> => (
  isCustomLabelType(getChangeData(change))
)

const isCustomLabelsChange = async (change: Change): Promise<boolean> => (
  isCustomLabelsType(getChangeData(change))
)

const resolveCustomLabelsType = async (
  changes: Change[]): Promise<ObjectType> => {
  const customLabelInstance = getChangeData(changes[0])
  if (!isInstanceElement(customLabelInstance)) {
    throw new Error('Could not determine CustomLabel type')
  }
  const customLabelType = await customLabelInstance.getType()
  return new ObjectType({
    elemID: new ElemID(SALESFORCE, CUSTOM_LABELS_METADATA_TYPE),
    fields: {
      [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.SERVICE_ID },
      labels: { refType: new ListType(customLabelType) },
    },
    annotationRefsOrTypes: metadataAnnotationTypes,
    annotations: {
      [METADATA_TYPE]: CUSTOM_LABELS_METADATA_TYPE,
      dirName: 'labels',
      suffix: 'labels',
    },
  })
}

const createCustomLabelsChange = async (customLabelChanges: Change[]): Promise<Change> => {
  const customLabelsType = await resolveCustomLabelsType(customLabelChanges)
  const beforeCustomLabelsInstance = createInstanceElement(
    {
      [INSTANCE_FULL_NAME_FIELD]: CUSTOM_LABELS_FULL_NAME,
      labels: getDataFromChanges('before', customLabelChanges)
        .filter(isInstanceElement)
        .map(e => e.value),
    },
    customLabelsType,
  )
  const afterCustomLabelsInstance = createInstanceElement(
    {
      [INSTANCE_FULL_NAME_FIELD]: CUSTOM_LABELS_FULL_NAME,
      labels: getDataFromChanges('after', customLabelChanges)
        .filter(isInstanceElement)
        .map(e => e.value),
    },
    customLabelsType,
  )
  return {
    action: 'modify',
    data: {
      before: beforeCustomLabelsInstance,
      after: afterCustomLabelsInstance,
    },
  }
}

/**
 * Split custom labels into individual instances
 */
const filterCreator: LocalFilterCreator = () : FilterWith<'onFetch'> & FilterWith<'onDeploy'> => {
  let customLabelChanges: Change[]
  return {
    name: 'splitCustomLabels',
    onFetch: async elements => {
      const customLabelType = await awu(elements)
        .filter(isObjectType)
        .find(async e => await apiName(e) === CUSTOM_LABEL_METADATA_TYPE)
      if (customLabelType === undefined) {
        log.info('CustomLabel type does not exist, skipping filter')
        return
      }
      const customLabelsInstances = await awu(elements)
        .filter(isInstanceElement)
        .filter(isCustomLabelsInstance)
        .toArray() as CustomLabelsInstance[]
      if (_.isEmpty(customLabelsInstances)) {
        log.info('CustomLabels instance does not exist, skipping filter')
        return
      }
      if (customLabelsInstances.length > 1) {
        log.error('Found more than one instance of CustomLabels, skipping filter')
        return
      }
      const customLabelsInstance = customLabelsInstances[0]
      const customLabelInstances = makeArray(customLabelsInstance.value.labels)
        .map(label => new InstanceElement(
          label[INSTANCE_FULL_NAME_FIELD],
          customLabelType,
          label,
          CUSTOM_LABEL_INSTANCES_FILE_PATH,
        ))
      _.pull(elements, customLabelsInstance)
      elements.push(...customLabelInstances)
    },
    preDeploy: async changes => {
      customLabelChanges = await awu(changes)
        .filter(isCustomLabelChange)
        .toArray()
      if (_.isEmpty(customLabelChanges)) {
        return
      }
      changes.push(await createCustomLabelsChange(customLabelChanges))
      _.pullAll(changes, customLabelChanges)
    },
    onDeploy: async changes => {
      const customLabelsChanges = await awu(changes)
        .filter(isCustomLabelsChange)
        .toArray()
      if (_.isEmpty(customLabelsChanges)) {
        return
      }
      _.pullAll(changes, customLabelsChanges)
      changes.push(...customLabelChanges)
    },
  }
}

export default filterCreator
