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
import { AdditionChange, Change, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isMapType, isObjectType, isReferenceExpression, isRemovalChange, ModificationChange, ObjectType, Value, Values } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { resolveValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getLookUpName } from '../../references'

const log = logger(module)

const { awu } = collections.asynciterable

const getOptionsFromContext = (context: InstanceElement): Values[] => (
  _(context.value.options ?? {})
    .values()
    .sortBy(option => option.position)
    .value()
)

const getOptionChanges = (
  contextChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): {
  added: Value[]
  modified: Value[]
  removed: Value[]
} => {
  const afterOptions = getOptionsFromContext(contextChange.data.after)

  if (isAdditionChange(contextChange)) {
    return {
      added: afterOptions,
      modified: [],
      removed: [],
    }
  }

  const beforeOptions = getOptionsFromContext(contextChange.data.before)

  const afterIds = new Set(afterOptions.map(option => option.id))

  const beforeOptionsById = _.keyBy(
    beforeOptions, option => option.id,
  )

  const addedOptions = afterOptions.filter(option => !(option.id in beforeOptionsById))
  const removedOptions = beforeOptions.filter(option => !afterIds.has(option.id))
  const modifiedOptions = afterOptions
    .filter(option => option.id in beforeOptionsById)
    .filter(option => !_.isEqual(_.omit(option, 'optionId'), _.omit(beforeOptionsById[option.id], 'optionId')))

  return {
    added: addedOptions,
    modified: modifiedOptions,
    removed: removedOptions,
  }
}

const transformOption = (option: Values): Values => _.pickBy({
  ..._.omit(option, 'position'),
  optionId: isReferenceExpression(option.optionId) ? option.optionId.value.id : option.optionId,
}, values.isDefined)


const updateContextOptions = async (
  addedOptions: Value[],
  modifiedOptions: Value[],
  removedOptions: Value[],
  client: clientUtils.HTTPWriteClientInterface,
  baseUrl: string,
  contextChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
): Promise<void> => {
  if (addedOptions.length !== 0) {
    const resp = await client.post({
      url: baseUrl,
      data: {
        options: addedOptions.map(transformOption),
      },
    })

    if (Array.isArray(resp.data)) {
      log.error('Received unexpected response from Jira API: %o', resp.data)
      throw new Error('Received unexpected response from Jira API')
    }

    if (Array.isArray(resp.data.options)) {
      resp.data.options.forEach(newOption => {
        contextChange.data.after.value.options[newOption.value].id = newOption.id
      })
    }
  }

  if (modifiedOptions.length !== 0) {
    await client.put({
      url: baseUrl,
      data: {
        options: modifiedOptions
          .map(transformOption)
          .map(option => _.omit(option, 'optionId')),
      },
    })
  }

  if (removedOptions.length !== 0) {
    await awu(removedOptions).forEach(async (option: Value) => {
      await client.delete({
        url: `${baseUrl}/${option.id}`,
      })
    })
  }
}

const reorderContextOptions = async (
  contextChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface,
  baseUrl: string,
): Promise<void> => {
  const afterOptions = getOptionsFromContext(
    await resolveValues(contextChange.data.after, getLookUpName)
  )
  const optionsGroups = _(afterOptions).groupBy(option => option.optionId).values().value()
  await Promise.all(optionsGroups.map(
    group => client.put({
      url: `${baseUrl}/move`,
      data: {
        customFieldOptionIds: group.map(option => option.id),
        position: 'First',
      },
    })
  ))
}

const hasReferences = (option: Values): boolean =>
  !_.isEmpty(_.pickBy(option, value => isReferenceExpression(value)))

export const setContextOptions = async (
  contextChange: Change<InstanceElement>,
  parentField: InstanceElement,
  client: clientUtils.HTTPWriteClientInterface,
): Promise<void> => {
  if (isRemovalChange(contextChange)) {
    return
  }

  const { added, modified, removed } = getOptionChanges(contextChange)

  const url = `/rest/api/3/field/${parentField.value.id}/context/${getChangeData(contextChange).value.id}/option`
  await updateContextOptions(
    added.filter(option => !hasReferences(option)),
    modified,
    removed,
    client,
    url,
    contextChange,
  )
  // Because the cascading options is dependent on the other options,
  // we need to deploy them after the other options
  await updateContextOptions(
    added.filter(hasReferences),
    [],
    [],
    client,
    url,
    contextChange,
  )

  await reorderContextOptions(contextChange, client, url)
}

export const setOptionTypeDeploymentAnnotations = async (
  fieldContextType: ObjectType,
): Promise<void> => {
  fieldContextType.fields.options.annotations[CORE_ANNOTATIONS.CREATABLE] = true
  fieldContextType.fields.options.annotations[CORE_ANNOTATIONS.UPDATABLE] = true

  const optionMapType = await fieldContextType.fields.options?.getType()
  if (!isMapType(optionMapType)) {
    throw new Error(`Expected field options ${fieldContextType.fields.options?.elemID.getFullName()} to be a map type`)
  }
  const optionType = await optionMapType.getInnerType()
  if (!isObjectType(optionType)) {
    throw new Error(`Expected inner type of field options ${fieldContextType.fields.options.elemID.getFullName()} to be an object type`)
  }

  ['value', 'optionId', 'disabled', 'position'].forEach((fieldName: string) => {
    if (fieldName in optionType.fields) {
      optionType.fields[fieldName].annotations[CORE_ANNOTATIONS.CREATABLE] = true
      optionType.fields[fieldName].annotations[CORE_ANNOTATIONS.UPDATABLE] = true
    }
  })
}
