/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ReadOnlyElementsSource, Value } from '@salto-io/adapter-api'
import { getInstancesFromElementSource, getParent, naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { client as clientUtils } from '@salto-io/adapter-components'
import JiraClient from '../../client/client'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, OPTIONS_ORDER_TYPE_NAME } from './constants'
import {
  getAllOptionPaginator,
  OPTIONS_MAXIMUM_BATCH_SIZE,
  PUBLIC_API_OPTIONS_LIMIT,
  transformOption,
  Option,
} from './context_options'
import { getContextParentAsync } from '../../common/fields'

const log = logger(module)
const { awu } = collections.asynciterable

const processContextOptionsPrivateApiResponse = (allUpdatedOptions: Option[], addedOptions: Value[]): void => {
  const optionsMap = _.keyBy(allUpdatedOptions, option => naclCase(option.value))
  addedOptions.forEach(option => {
    option.id = optionsMap[naclCase(option.value)]?.id
  })
}

const addPrivateApiOptions = async ({
  addedOptions,
  privateApiOptions,
  contextId,
  client,
  baseUrl,
  paginator,
  isCascade,
}: {
  addedOptions: Value[]
  privateApiOptions: Value[]
  client: JiraClient
  baseUrl: string
  contextId: string
  paginator: clientUtils.Paginator | undefined
  isCascade: boolean
  optionsCount: number
}): Promise<void> => {
  if (paginator === undefined) {
    log.error('Received unexpected paginator undefined')
    throw new Error('Received unexpected paginator undefined')
  }
  // This is done one after the other. It might be ok to do it in parallel, needs some testing
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
  const allUpdatedOptions = await getAllOptionPaginator(paginator, baseUrl)
  processContextOptionsPrivateApiResponse(allUpdatedOptions, addedOptions)
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
  optionsCount,
}: {
  addedOptions: Value[]
  modifiedOptions: Value[]
  removedOptions: Value[]
  client: JiraClient
  baseUrl: string
  contextId: string
  paginator: clientUtils.Paginator | undefined
  isCascade: boolean
  optionsCount: number
}): Promise<void> => {
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
    const numberOfPublicApiOptions = Math.max(addedOptions.length + PUBLIC_API_OPTIONS_LIMIT - optionsCount, 0) // options count includes also addedOptions
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
        const optionsMap = _.keyBy(chunk, option => naclCase(option.value))
        resp.data.options.forEach(newOption => {
          optionsMap[naclCase(newOption.value)].id = newOption.id
        })
      }
    })
    if (privateApiOptions.length !== 0) {
      // Jira API doesn't support adding more than 10000 through the API.
      // We need to add the rest through the private API.
      await addPrivateApiOptions({
        addedOptions,
        privateApiOptions,
        contextId,
        client,
        baseUrl,
        paginator,
        isCascade,
        optionsCount,
      })
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

const isCascadeOption = (option: InstanceElement): boolean =>
  getParent(option).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME

const updateParentIds = (options: InstanceElement[], parentOptions: InstanceElement[]): void => {
  const elemIdToOption = _.keyBy(parentOptions, parentOption => parentOption.elemID.getFullName())
  options
    .filter(option => option.value.optionId === undefined)
    .forEach(option => {
      option.value.optionId = elemIdToOption[getParent(option).elemID.getFullName()]?.value.id
      option.value.parentValue = elemIdToOption[getParent(option).elemID.getFullName()]?.value.value
    })
}
const setCascadeOptions = (options: InstanceElement[]): void => {
  options.filter(isCascadeOption).forEach(option => {
    option.value.optionId = getParent(option).value.id
    option.value.parentValue = getParent(option).value.value
  })
}

const unsetOptions = (options: InstanceElement[]): void =>
  options.forEach(option => {
    delete option.value.optionId
    delete option.value.parentValue
  })

export const setContextOptionsSplitted = async ({
  contextId,
  fieldId,
  added,
  modified,
  removed,
  client,
  paginator,
  elementsSource,
}: {
  contextId: string
  fieldId: string
  added: InstanceElement[]
  modified: InstanceElement[]
  removed: InstanceElement[]
  client: JiraClient
  elementsSource: ReadOnlyElementsSource
  paginator?: clientUtils.Paginator
}): Promise<void> => {
  const [addedCascade, addedSimple] = _.partition(added, isCascadeOption)

  setCascadeOptions(modified)
  setCascadeOptions(addedCascade)
  const optionsCount = _.sum(
    await Promise.all(
      (await getInstancesFromElementSource(elementsSource, [OPTIONS_ORDER_TYPE_NAME])).map(async instance =>
        (await getContextParentAsync(instance, elementsSource)).value.id === contextId
          ? instance.value.options.length
          : 0,
      ),
    ),
  )

  const baseUrl = `/rest/api/3/field/${fieldId}/context/${contextId}/option`
  await updateContextOptions({
    addedOptions: addedSimple.map(option => option.value),
    modifiedOptions: modified.map(option => option.value),
    removedOptions: removed.map(option => option.value),
    contextId,
    client,
    baseUrl,
    paginator,
    isCascade: false,
    optionsCount: optionsCount - addedCascade.length, // the cascade were not added yet
  })
  updateParentIds(addedCascade, addedSimple)

  await updateContextOptions({
    addedOptions: addedCascade.map(option => option.value),
    modifiedOptions: [],
    removedOptions: [],
    contextId,
    client,
    baseUrl,
    paginator,
    isCascade: true,
    optionsCount,
  })
  unsetOptions(added)
  unsetOptions(modified)
  unsetOptions(removed)
}
