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
import { AdditionChange, Change, getChangeData, InstanceElement, isAdditionChange, isMapType, isObjectType, isRemovalChange, ModificationChange, ObjectType, Value, Values } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { naclCase, resolveValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getLookUpName } from '../../reference_mapping'
import { setDeploymentAnnotations } from '../../utils'

const log = logger(module)

const { awu } = collections.asynciterable

const convertOptionsToList = (options: Values): Values[] => (
  _(options)
    .values()
    .sortBy(option => option.position)
    .map(option => _.omit(option, 'position'))
    .value()
)

const getOptionsFromContext = (context: InstanceElement): Values[] => [
  ...(Object.values(context.value.options ?? {}) as Values[])
    .flatMap((option: Values) => convertOptionsToList(option.cascadingOptions)
      .map(cascadingOption => ({
        ...cascadingOption,
        optionId: option.id,
        parentValue: option.value,
      }))),
  ...convertOptionsToList(context.value.options ?? {}),
]

const getOptionChanges = (
  contextChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
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

// Transform option back to the format expected by Jira API
const transformOption = (option: Values): Values => ({
  ..._.omit(option, ['position', 'parentValue', 'cascadingOptions']),
})

type UpdateContextOptionsParams = {
  addedOptions: Value[]
  modifiedOptions: Value[]
  removedOptions: Value[]
  client: clientUtils.HTTPWriteClientInterface
  baseUrl: string
  contextChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>
}

const updateContextOptions = async ({
  addedOptions,
  modifiedOptions,
  removedOptions,
  client,
  baseUrl,
  contextChange,
}: UpdateContextOptionsParams): Promise<void> => {
  if (addedOptions.length !== 0) {
    const resp = await client.post({
      url: baseUrl,
      data: {
        options: addedOptions.map(transformOption),
      },
    })

    if (Array.isArray(resp.data)) {
      log.error('Received unexpected array response from Jira API: %o', resp.data)
      throw new Error('Received unexpected response from Jira API')
    }

    if (Array.isArray(resp.data.options)) {
      const idToOption = _.keyBy(contextChange.data.after.value.options, option => option.id)
      resp.data.options.forEach(newOption => {
        if (newOption.optionId !== undefined) {
          idToOption[newOption.optionId]
            .cascadingOptions[naclCase(newOption.value)].id = newOption.id
        } else {
          contextChange.data.after.value.options[naclCase(newOption.value)].id = newOption.id
        }
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

export const setContextOptions = async (
  contextChange: Change<InstanceElement>,
  parentField: InstanceElement,
  client: clientUtils.HTTPWriteClientInterface,
): Promise<void> => {
  if (isRemovalChange(contextChange)) {
    return
  }

  const { added, modified, removed } = getOptionChanges(contextChange)

  const [addedWithParentId, addedWithoutParentId] = _.partition(
    added,
    option => option.optionId !== undefined || option.parentValue === undefined
  )

  const url = `/rest/api/3/field/${parentField.value.id}/context/${getChangeData(contextChange).value.id}/option`
  await updateContextOptions({
    addedOptions: addedWithParentId,
    modifiedOptions: modified,
    removedOptions: removed,
    client,
    baseUrl: url,
    contextChange,
  })

  addedWithoutParentId.forEach((option: Values) => {
    option.optionId = getChangeData(contextChange).value.options[naclCase(option.parentValue)].id
  })

  // Because the cascading options are dependent on the other options,
  // we need to deploy them after the other options
  await updateContextOptions({
    addedOptions: addedWithoutParentId,
    modifiedOptions: [],
    removedOptions: [],
    client,
    baseUrl: url,
    contextChange,
  })

  await reorderContextOptions(contextChange, client, url)
}

export const setOptionTypeDeploymentAnnotations = async (
  fieldContextType: ObjectType,
): Promise<void> => {
  setDeploymentAnnotations(fieldContextType, 'options')

  const optionMapType = await fieldContextType.fields.options?.getType()
  if (!isMapType(optionMapType)) {
    throw new Error(`Expected field options ${fieldContextType.fields.options?.elemID.getFullName()} to be a map type`)
  }
  const optionType = await optionMapType.getInnerType()
  if (!isObjectType(optionType)) {
    throw new Error(`Expected inner type of field options ${fieldContextType.fields.options.elemID.getFullName()} to be an object type`)
  }

  ['value', 'optionId', 'disabled', 'position', 'cascadingOptions'].forEach((fieldName: string) => {
    if (fieldName in optionType.fields) {
      setDeploymentAnnotations(optionType, fieldName)
    }
  })
}
