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

import { InstanceElement } from '@salto-io/adapter-api'
import { config as configUtils, definitions, elements as elementUtils, client as clientUtils } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import Joi from 'joi'
import { OBJECT_TYPE_ATTRIBUTE_TYPE } from './constants'

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

// Common function to process entries
const processEntries = async ({
  paginator,
  args,
  typeName,
  typesConfig,
  additionalProcessing,
} : {
  paginator: clientUtils.Paginator
  args: clientUtils.ClientGetWithPaginationParams
  typeName: string
  typesConfig: Record<string, configUtils.TypeDuckTypeConfig>
  additionalProcessing: (entry: clientUtils.ResponseValue) => void
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
      (responseEntryName !== definitions.DATA_FIELD_ENTIRE_OBJECT)
        ? response[responseEntryName]
        : response
    ) as clientUtils.ResponseValue[]

    responseEntries.forEach(entry => additionalProcessing(entry))
    if (responseEntryName === definitions.DATA_FIELD_ENTIRE_OBJECT) {
      return responseEntries
    }
    return {
      ...response,
      [responseEntryName]: responseEntries,
    }
  }) as clientUtils.ResponseValue[]
}

export const jiraJSMEntriesFunc = (projectInstance: InstanceElement):
elementUtils.ducktype.EntriesRequester => async ({ paginator, args, typeName, typesConfig }) => {
  log.debug(`Fetching type ${typeName} entries for service desk project ${projectInstance.elemID.name}`)
  return processEntries({
    paginator,
    args,
    typeName,
    typesConfig,
    additionalProcessing: entry => {
      entry.projectKey = projectInstance.value.key
    },
  })
}

export const jiraJSMAssetsEntriesFunc = ():
elementUtils.ducktype.EntriesRequester => async ({ paginator, args, typeName, typesConfig }) => processEntries({
  paginator,
  args,
  typeName,
  typesConfig,
  additionalProcessing: entry => {
    if (typeName === OBJECT_TYPE_ATTRIBUTE_TYPE && isAttributeEntry(entry)) {
      if (typeof entry.objectType !== 'string') {
        entry.objectType = entry.objectType.id
      }
    }
  },
})
