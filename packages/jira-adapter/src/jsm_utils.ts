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

/**
 * Fetch JSM elements of service desk project.
*/

import { InstanceElement } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'

const ATTRIBUTE_ENTRY_SCHEMA = Joi.object({
  objectType: Joi.object({
    id: Joi.string().required(),
  }).unknown(true).required(),
}).unknown(true).required()

type AttributeEntry = {
  objectType: {
    id: string
  } | string
}

const isAttributeEntry = createSchemeGuard<AttributeEntry>(ATTRIBUTE_ENTRY_SCHEMA)

const { getEntriesResponseValues } = elementUtils.ducktype
const { makeArray } = collections.array
const log = logger(module)

export const jiraJSMEntriesFunc = (
  projectInstance: InstanceElement,
): elementUtils.ducktype.EntriesRequester => {
  const getJiraJSMEntriesResponseValues = async ({
    paginator,
    args,
    typeName,
    typesConfig,
  } : {
      paginator: clientUtils.Paginator
      args: clientUtils.ClientGetWithPaginationParams
      typeName: string
      typesConfig: Record<string, configUtils.TypeDuckTypeConfig>
    }): Promise<clientUtils.ResponseValue[]> => {
    log.debug(`Fetching type ${typeName} entries for service desk project ${projectInstance.elemID.name}`)
    const jsmResponseValues = (await getEntriesResponseValues({
      paginator,
      args,
      typeName,
      typesConfig,
    })).flat()
    const responseEntryName = typesConfig[typeName].transformation?.dataField
    return jsmResponseValues.flatMap(response => {
      if (responseEntryName === undefined) {
        return makeArray(response)
      }
      const responseEntries = makeArray(
        (responseEntryName !== configUtils.DATA_FIELD_ENTIRE_OBJECT)
          ? response[responseEntryName]
          : response
      ) as clientUtils.ResponseValue[]
      // Defining JSM element to its corresponding project
      responseEntries.forEach(entry => {
        entry.projectKey = projectInstance.value.key
      })
      if (responseEntryName === configUtils.DATA_FIELD_ENTIRE_OBJECT) {
        return responseEntries
      }
      return {
        ...response,
        [responseEntryName]: responseEntries,
      }
    }) as clientUtils.ResponseValue[]
  }

  return getJiraJSMEntriesResponseValues
}

export const jiraJSMAssetsEntriesFunc = (): elementUtils.ducktype.EntriesRequester => {
  const getJiraJSMAssetsEntriesResponseValues = async ({
    paginator,
    args,
    typeName,
    typesConfig,
  } : {
      paginator: clientUtils.Paginator
      args: clientUtils.ClientGetWithPaginationParams
      typeName: string
      typesConfig: Record<string, configUtils.TypeDuckTypeConfig>
    }): Promise<clientUtils.ResponseValue[]> => {
    const jsmResponseValues = (await getEntriesResponseValues({
      paginator,
      args,
      typeName,
      typesConfig,
    })).flat()
    const responseEntryName = typesConfig[typeName].transformation?.dataField
    return jsmResponseValues.flatMap(response => {
      if (responseEntryName === undefined) {
        return makeArray(response)
      }
      const responseEntries = makeArray(
        (responseEntryName !== configUtils.DATA_FIELD_ENTIRE_OBJECT)
          ? response[responseEntryName]
          : response
      ) as clientUtils.ResponseValue[]

      responseEntries.forEach(entry => {
        if (typeName === 'AssetsObjectTypeAttribute' && isAttributeEntry(entry)) {
          if (typeof entry.objectType !== 'string') {
            entry.objectType = entry.objectType.id
          }
        }
      })
      if (responseEntryName === configUtils.DATA_FIELD_ENTIRE_OBJECT) {
        return responseEntries
      }
      return {
        ...response,
        [responseEntryName]: responseEntries,
      }
    }) as clientUtils.ResponseValue[]
  }

  return getJiraJSMAssetsEntriesResponseValues
}
