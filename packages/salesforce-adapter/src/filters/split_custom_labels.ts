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
import {
  BuiltinTypes,
  Change,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isObjectType, ListType,
  ObjectType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import Joi from 'joi'
import { collections, promises } from '@salto-io/lowerdash'
import { FilterContext, FilterCreator, FilterWith } from '../filter'
import { createInstanceElement } from '../transformers/transformer'
import { getDataFromChanges, isInstanceOfType } from './utils'
import { CUSTOM_LABEL_METADATA_TYPE, CUSTOM_LABELS_METADATA_TYPE, INSTANCE_FULL_NAME_FIELD } from '../constants'

const { removeAsync } = promises.array

const log = logger(module)

const CUSTOM_LABELS_FULL_NAME = 'CustomLabels'

const { awu } = collections.asynciterable


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

const CUSTOM_LABELS_SCHEMA = Joi.object({
  labels: Joi.array().items(CUSTOM_LABEL_SCHEMA).required(),
}).unknown(true)


const isCustomLabelsType = isInstanceOfType(CUSTOM_LABELS_METADATA_TYPE)

const isCustomLabelsInstance = async (e: InstanceElement): Promise<boolean> => (
  await isCustomLabelsType(e) && _.isUndefined(CUSTOM_LABELS_SCHEMA.validate(e.value).error)
)

const isCustomLabelType = isInstanceOfType(CUSTOM_LABEL_METADATA_TYPE)

const isCustomLabelChange = async (change: Change): Promise<boolean> => (
  isCustomLabelType(getChangeData(change))
)

const isCustomLabelsChange = async (change: Change): Promise<boolean> => (
  isCustomLabelsType(getChangeData(change))
)

const resolveCustomLabelsType = async (
  changes: Change[],
  filterContext: FilterContext): Promise<ObjectType> => {
  const customLabelInstance = getChangeData(changes[0])
  if (!isInstanceElement(customLabelInstance)) {
    throw new Error('Could not determine CustomLabel type')
  }
  const customLabelType = await customLabelInstance.getType()
  const customLabelsType = await awu(await filterContext.elementsSource.getAll())
    .filter(isObjectType)
    .find(e => e.elemID.typeName === CUSTOM_LABELS_METADATA_TYPE)
  if (customLabelsType === undefined) {
    throw new Error('CustomLabels type does not exist, aborting deploy. Consider fetching again')
  }
  return new ObjectType({
    ...customLabelsType,
    fields: {
      ...customLabelsType.fields,
      [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.SERVICE_ID },
      labels: { refType: new ListType(customLabelType) },
    },
  })
}

const createCustomLabelsChange = async (
  customLabelChanges: Change[],
  filterContext: FilterContext): Promise<Change> => {
  const customLabelsType = await resolveCustomLabelsType(customLabelChanges, filterContext)
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
const filterCreator: FilterCreator = ({ config }) : FilterWith<'onFetch'> & FilterWith<'onDeploy'> => {
  let customLabelChanges: Change[]
  return {
    onFetch: async elements => {
      const customLabelType = elements
        .filter(isObjectType)
        .find(e => e.elemID.typeName === CUSTOM_LABEL_METADATA_TYPE)
      if (customLabelType === undefined) {
        log.warn('CustomLabel type does not exist, skipping split into CustomLabel instances')
        return
      }
      const customLabelsInstances = await awu(elements)
        .filter(isInstanceElement)
        .filter(isCustomLabelsInstance)
        .map(e => e as CustomLabelsInstance)
        .toArray()
      if (_.isEmpty(customLabelsInstances)) {
        log.warn('CustomLabels instance does not exist, skipping split into CustomLabel instances')
        return
      }
      if (customLabelsInstances.length > 1) {
        log.warn('Found more than one instance of CustomLabels, using first')
      }
      const customLabelsInstance = customLabelsInstances[0]
      const customLabelInstances = customLabelsInstance.value.labels
        .map(label => createInstanceElement(
          label,
          customLabelType,
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
      changes.push(await createCustomLabelsChange(customLabelChanges, config))
      _.pullAll(changes, customLabelChanges)
    },
    onDeploy: async changes => {
      await removeAsync(changes, isCustomLabelsChange)
      changes.push(...customLabelChanges)
    },
  }
}

export default filterCreator
