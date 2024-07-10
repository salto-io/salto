/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { InstanceElement, isMapType, isObjectType, ObjectType, Value, Values } from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard, getParent, naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import JiraClient from '../../client/client'
import { setFieldDeploymentAnnotations } from '../../utils'
import { FIELD_CONTEXT_OPTION_TYPE_NAME } from './constants'

const log = logger(module)
const { makeArray } = collections.array
const { toArrayAsync } = collections.asynciterable
const { awu } = collections.asynciterable

const OPTIONS_MAXIMUM_BATCH_SIZE = 1000
const PUBLIC_API_OPTIONS_LIMIT = 10000

// Transform option back to the format expected by Jira API
const transformOption = (option: Values): Values => ({
  ..._.omit(option, ['position', 'parentValue', 'cascadingOptions']),
})

type UpdateContextOptionsParams = {
  addedOptions: Value[]
  modifiedOptions: Value[]
  removedOptions: Value[]
  client: JiraClient
  baseUrl: string
  contextId: string
  paginator: clientUtils.Paginator | undefined
  isCascade: boolean
  numberOfAlreadyAddedOptions: number
}

type Option = {
  id: string
  value: string
  optionId?: string
}

const EXPECTED_OPTION_SCHEMA = Joi.object({
  id: Joi.string().required(),
  value: Joi.string().required(),
}).unknown(true)

const isOption = createSchemeGuard<Option>(EXPECTED_OPTION_SCHEMA, 'Received invalid response from private API')

const processContextOptionsPrivateApiResponse = (resp: Option[], addedOptions: Value[]): void => {
  const idToOption = _.keyBy(addedOptions, option => option.id)
  const optionsMap = _.keyBy(addedOptions, option => naclCase(option.value))
  const optionIds = new Set(Object.keys(idToOption))
  const respToProcess = resp.filter(newOption => !optionIds.has(newOption.id))
  respToProcess.forEach(newOption => {
    if (newOption.optionId !== undefined) {
      idToOption[newOption.optionId].cascadingOptions[naclCase(newOption.value)].id = newOption.id
    } else {
      optionsMap[naclCase(newOption.value)].id = newOption.id
    }
  })
}
const getAllOptionPaginator = async (paginator: clientUtils.Paginator, baseUrl: string): Promise<Option[]> => {
  const paginationArgs: clientUtils.ClientGetWithPaginationParams = {
    url: baseUrl,
    paginationField: 'startAt',
    queryParams: {
      maxResults: '1000',
    },
    pageSizeArgName: 'maxResults',
  }

  const options = await toArrayAsync(
    paginator(paginationArgs, page => makeArray(page.values) as clientUtils.ResponseValue[]),
  )
  const values = options.flat().filter(isOption)
  return values
}

const updateContextOptions = async ({
  addedOptions,
  modifiedOptions,
  removedOptions,
  contextId,
  client,
  baseUrl,
  paginator,
  isCascade,
  numberOfAlreadyAddedOptions,
}: UpdateContextOptionsParams): Promise<void> => {
  if (removedOptions.length !== 0) {
    await Promise.all(
      removedOptions.map(async (option: Value) => {
        await client.delete({
          url: `${baseUrl}/${option.id}`,
        })
      }),
    )
  }

  if (addedOptions.length !== 0) {
    const optionLengthBefore = modifiedOptions.length + numberOfAlreadyAddedOptions
    const numberOfPublicApiOptions = Math.max(PUBLIC_API_OPTIONS_LIMIT - optionLengthBefore, 0)
    const publicApiOptions = addedOptions.slice(0, numberOfPublicApiOptions)
    const privateApiOptions = addedOptions.slice(numberOfPublicApiOptions, addedOptions.length)
    const addedOptionsChunks = _.chunk(publicApiOptions, OPTIONS_MAXIMUM_BATCH_SIZE)
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
        const optionsMap = _.keyBy(addedOptions, option => naclCase(option.value))
        resp.data.options.forEach(newOption => {
          optionsMap[naclCase(newOption.value)].id = newOption.id
        })
      }
    })
    // Jira API doesn't support adding more than 10000 through the API.
    // We need to add the rest through the private API.
    await awu(privateApiOptions).forEach(async option => {
      const commonData = {
        addValue: option.value,
        fieldConfigId: contextId,
      }
      const data: Record<string, string> = isCascade
        ? { ...commonData, selectedParentOptionId: option.optionId }
        : commonData
      await client.jspPost({
        url: '/secure/admin/EditCustomFieldOptions!add.jspa',
        data,
      })
    })
    if (privateApiOptions.length !== 0) {
      if (paginator === undefined) {
        log.error('Received unexpected paginator undefined')
        return
      }
      const resp = await getAllOptionPaginator(paginator, baseUrl)
      processContextOptionsPrivateApiResponse(resp, addedOptions)
    }
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
}

export const reorderContextOptions = async (
  // Should get order change
  options: Value[],
  client: JiraClient,
  baseUrl: string,
): Promise<void> => {
  const optionsGroups = _(options)
    .groupBy(option => option.optionId)
    .values()
    .value()

  // Data center plugin expects all options in one request.
  const requestBodies = client.isDataCenter
    ? optionsGroups.map(group => [
        {
          url: `${baseUrl}/move`,
          data: {
            customFieldOptionIds: group.map(option => option.id),
            position: 'First',
          },
        },
      ])
    : optionsGroups.map(group =>
        _.chunk(group, OPTIONS_MAXIMUM_BATCH_SIZE).map((chunk, index) => ({
          url: `${baseUrl}/move`,
          data: {
            customFieldOptionIds: chunk.map(option => option.id),
            position: index === 0 ? 'First' : 'Last',
          },
        })),
      )
  await awu(requestBodies)
    .flat()
    .forEach(async body => client.put(body))
}

const isCascadeOption = (option: InstanceElement): boolean =>
  getParent(option).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME

export const setContextOptionsSplitted = async ({
  contextId,
  fieldId,
  added,
  modified,
  removed,
  client,
  paginator,
}: {
  contextId: string
  fieldId: string
  added: InstanceElement[]
  modified: InstanceElement[]
  removed: InstanceElement[]
  client: JiraClient
  paginator?: clientUtils.Paginator
}): Promise<void> => {
  if (added.length === 0 && modified.length === 0 && removed.length === 0) {
    return
  }

  const [addedCascade, addedSimple] = _.partition(added, isCascadeOption)

  const url = `/rest/api/3/field/${fieldId}/context/${contextId}/option`
  await updateContextOptions({
    addedOptions: addedSimple.map(option => option.value),
    modifiedOptions: modified.map(option => option.value),
    removedOptions: removed.map(option => option.value),
    contextId,
    client,
    baseUrl: url,
    paginator,
    isCascade: false,
    numberOfAlreadyAddedOptions: 0,
  })
  addedCascade.forEach(cascadingOption => {
    const parentValue = getParent(cascadingOption).value
    cascadingOption.value.optionId = parentValue?.id
    cascadingOption.value.parentValue = parentValue?.value
  })
  await updateContextOptions({
    addedOptions: addedCascade.map(option => option.value),
    modifiedOptions: [],
    removedOptions: [],
    contextId,
    client,
    baseUrl: url,
    paginator,
    isCascade: true,
    numberOfAlreadyAddedOptions: addedSimple.length,
  })
}

export const setOptionTypeDeploymentAnnotations = async (fieldContextType: ObjectType): Promise<void> => {
  // TODO what here?
  setFieldDeploymentAnnotations(fieldContextType, 'options')

  const optionMapType = await fieldContextType.fields.options?.getType()
  if (!isMapType(optionMapType)) {
    throw new Error(`Expected field options ${fieldContextType.fields.options?.elemID.getFullName()} to be a map type`)
  }
  const optionType = await optionMapType.getInnerType()
  if (!isObjectType(optionType)) {
    throw new Error(
      `Expected inner type of field options ${fieldContextType.fields.options.elemID.getFullName()} to be an object type`,
    )
  }

  ;['value', 'optionId', 'disabled', 'position', 'cascadingOptions'].forEach((fieldName: string) => {
    if (fieldName in optionType.fields) {
      setFieldDeploymentAnnotations(optionType, fieldName)
    }
  })
}
