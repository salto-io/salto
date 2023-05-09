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
import { AdditionChange, Change, getChangeData, InstanceElement, isAdditionChange, isEqualValues, isMapType, isModificationChange, isObjectType, isRemovalChange, ModificationChange, ObjectType, ReadOnlyElementsSource, Value, Values } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { getParents, naclCase, resolveValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import JiraClient from '../../client/client'
import { getLookUpName } from '../../reference_mapping'
import { setFieldDeploymentAnnotations } from '../../utils'

const log = logger(module)

const { awu } = collections.asynciterable

const OPTIONS_MAXIMUM_BATCH_SIZE = 1000

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
    const addedOptionsChunks = _.chunk(addedOptions, OPTIONS_MAXIMUM_BATCH_SIZE)

    await awu(addedOptionsChunks).forEach(async chunk => {
      const resp = await client.post({
        url: baseUrl,
        data: {
          options: chunk.map(transformOption),
        },
      })

      if (Array.isArray(resp.data)) {
        log.error('Received unexpected array response from Jira API: %o', resp.data)
        throw new Error('Received unexpected response from Jira API')
      }
      if (Array.isArray(resp.data.options)) {
        const idToOption = _.keyBy(contextChange.data.after.value.options, option => option.id)
        const optionsMap = _(contextChange.data.after.value.options).values()
          .keyBy(option => naclCase(option.value)).value()
        resp.data.options.forEach(newOption => {
          if (newOption.optionId !== undefined) {
            idToOption[newOption.optionId]
              .cascadingOptions[naclCase(newOption.value)].id = newOption.id
          } else {
            optionsMap[naclCase(newOption.value)].id = newOption.id
          }
        })
      }
    })
  }

  if (modifiedOptions.length !== 0) {
    const modifiedOptionsChunks = _.chunk(modifiedOptions, OPTIONS_MAXIMUM_BATCH_SIZE)

    await awu(modifiedOptionsChunks).forEach(async chunk => {
      await client.put({
        url: baseUrl,
        data: {
          options: chunk.map(transformOption).map(option => _.omit(option, 'optionId')),
        },
      })
    })
  }
  if (removedOptions.length !== 0) {
    await Promise.all(removedOptions.map(async (option: Value) => {
      await client.delete({
        url: `${baseUrl}/${option.id}`,
      })
    }))
  }
}


const reorderContextOptions = async (
  contextChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  client: JiraClient,
  baseUrl: string,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  const afterOptions = getOptionsFromContext(
    await resolveValues(contextChange.data.after, getLookUpName, elementsSource)
  )

  const beforeOptions = isModificationChange(contextChange)
    ? getOptionsFromContext(
      await resolveValues(contextChange.data.before, getLookUpName, elementsSource)
    )
    : []

  if (isEqualValues(beforeOptions, afterOptions)) {
    return
  }

  const optionsGroups = _(afterOptions).groupBy(option => option.optionId).values().value()
  // Data center plugin expects all options in one request.
  const requestBodies = client.isDataCenter ? optionsGroups.map(
    group => [{
      url: `${baseUrl}/move`,
      data: {
        customFieldOptionIds: group.map(option => option.id),
        position: 'First',
      },
    }]
  ) : optionsGroups.map(group =>
    _.chunk(group, OPTIONS_MAXIMUM_BATCH_SIZE).map((chunk, index) =>
      ({
        url: `${baseUrl}/move`,
        data: {
          customFieldOptionIds: chunk.map(option => option.id),
          position: index === 0 ? 'First' : 'Last',
        },
      })))
  await awu(requestBodies).flat().forEach(async body => client.put(body))
}

export const setContextOptions = async (
  contextChange: Change<InstanceElement>,
  client: JiraClient,
  elementsSource?: ReadOnlyElementsSource
): Promise<void> => {
  if (isRemovalChange(contextChange)) {
    return
  }

  const { added, modified, removed } = getOptionChanges(contextChange)

  if (added.length === 0 && modified.length === 0 && removed.length === 0) {
    return
  }

  const [addedWithParentId, addedWithoutParentId] = _.partition(
    added,
    option => option.optionId !== undefined || option.parentValue === undefined
  )

  const fieldId = (
    await getParents(getChangeData(contextChange))[0].value
  ).value.id

  const url = `/rest/api/3/field/${fieldId}/context/${getChangeData(contextChange).value.id}/option`
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

  await reorderContextOptions(contextChange, client, url, elementsSource)
}

export const setOptionTypeDeploymentAnnotations = async (
  fieldContextType: ObjectType,
): Promise<void> => {
  setFieldDeploymentAnnotations(fieldContextType, 'options')

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
      setFieldDeploymentAnnotations(optionType, fieldName)
    }
  })
}
