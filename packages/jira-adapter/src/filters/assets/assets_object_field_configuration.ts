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

import _ from 'lodash'
import { createSchemeGuard, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
import { parse } from 'node-html-parser'
import Joi from 'joi'
import {
  BuiltinTypes,
  ElemID,
  Field,
  isInstanceElement,
  ListType,
  ObjectType,
  CORE_ANNOTATIONS,
  isAdditionOrModificationChange,
  getChangeData,
  InstanceElement,
  Change,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../fields/constants'
import { addAnnotationRecursively, findObject } from '../../utils'
import { ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE, JIRA } from '../../constants'
import { getWorkspaceId } from '../../workspace_id'
import JiraClient from '../../client/client'

const { toBasicInstance } = elementUtils
const { getTransformationConfigByType } = configUtils
const log = logger(module)

const CMDB_OBJECT_FIELD_CONFIGURATION = 'com.atlassian.jira.plugins.cmdb:cmdb-object-cftype'
const CUSTOM_FIELD_ID_REGEX = /customfield_(\d+)/
const FIELD_CONFIG_ID_REGEX = /fieldConfigId=(\d+)/
const FIELD_CONTEXT_ID_REGEX = /fieldConfigSchemeId=(\d+)/

type HTMLResponse = {
  data: string
}

const HTML_RESPONSE_SCHEME = Joi.object({
  data: Joi.string().required(),
}).unknown(true)

const isHTMLResponse = createSchemeGuard<HTMLResponse>(
  HTML_RESPONSE_SCHEME,
  'Failed to get HTML response for assets context config id',
)

const extractFirstMatch = (input: string, pattern: RegExp): string => {
  const match = input.match(pattern)
  if (match === null || match.length < 2) {
    throw new Error(`Failed to extract a match from the input ${input}, using the pattern ${pattern}`)
  }
  return match[1]
}

const extractIdsFromHTML = (html: HTMLResponse): Record<string, string> => {
  const contextIdToConfigId: Record<string, string> = {}
  const root = parse(html.data)
  const linkElements = root.querySelectorAll('a[id$="-edit-cmdbObjectFieldConfig"]')

  linkElements.forEach(linkElement => {
    const href = linkElement.getAttribute('href')
    if (!href) {
      throw new Error('Failed to get href from link element')
    }
    const fieldConfigId = extractFirstMatch(href, FIELD_CONFIG_ID_REGEX)
    const fieldContextId = extractFirstMatch(href, FIELD_CONTEXT_ID_REGEX)
    contextIdToConfigId[fieldContextId] = fieldConfigId
  })
  return contextIdToConfigId
}

export const getAssetsContextIdsFromHTML = async (
  client: JiraClient,
  instance: InstanceElement,
): Promise<Record<string, string>> => {
  const fieldId = instance.value.id
  const numericCustomFieldId = extractFirstMatch(fieldId, CUSTOM_FIELD_ID_REGEX)
  const html = await client.getPrivate({
    url: 'secure/admin/ConfigureCustomField!default.jspa',
    queryParams: {
      customFieldId: numericCustomFieldId,
    },
  })

  if (!isHTMLResponse(html)) {
    throw new Error('Failed to get HTML for assets context id')
  }
  return extractIdsFromHTML(html)
}

const getRelevantAssetsObjectFieldConfiguration = (changes: Change[]): InstanceElement[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(isInstanceElement)
    .filter(instance => instance.value.assetsObjectFieldConfiguration !== undefined)

const filter: FilterCreator = ({ config, client }) => ({
  name: 'assetsObjectFieldConfigurationFilter',
  onFetch: async elements => {
    if (!config.fetch.enableAssetsObjectFieldConfiguration) {
      return
    }
    const assetsObjectFieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE),
      fields: {
        id: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true } },
        objectSchemaId: { refType: BuiltinTypes.STRING },
        workspaceId: { refType: BuiltinTypes.STRING },
        objectSchemaName: { refType: BuiltinTypes.STRING },
        objectFilterQuery: { refType: BuiltinTypes.STRING },
        issueScopeFilterQuery: { refType: BuiltinTypes.STRING },
        attributesIncludedInAutoCompleteSearch: { refType: new ListType(BuiltinTypes.STRING) },
        attributesDisplayedOnIssue: { refType: new ListType(BuiltinTypes.STRING) },
        multiple: { refType: BuiltinTypes.BOOLEAN },
        shouldSetDefaultValuesFromEmptySearch: { refType: BuiltinTypes.BOOLEAN },
        attributesLimit: { refType: BuiltinTypes.NUMBER },
      },
      path: [JIRA, elementUtils.TYPES_PATH, elementUtils.SUBTYPES_PATH, ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE],
    })

    await addAnnotationRecursively(assetsObjectFieldConfigurationType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(assetsObjectFieldConfigurationType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(assetsObjectFieldConfigurationType, CORE_ANNOTATIONS.DELETABLE)

    elements.push(assetsObjectFieldConfigurationType)

    const fieldContextType = findObject(elements, FIELD_CONTEXT_TYPE_NAME)
    if (fieldContextType === undefined) {
      log.error('fieldContext type was not found')
      return
    }

    fieldContextType.fields.assetsObjectFieldConfiguration = new Field(
      fieldContextType,
      'assetsObjectFieldConfiguration',
      assetsObjectFieldConfigurationType,
      {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
        [CORE_ANNOTATIONS.DELETABLE]: true,
      },
    )

    const fields = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      .filter(instance => instance.value.type === CMDB_OBJECT_FIELD_CONFIGURATION)
      .filter(instance => !_.isEmpty(instance.value.contexts))

    await Promise.all(
      fields.map(async instance => {
        try {
          const contextIdToConfigId = await getAssetsContextIdsFromHTML(client, instance)
          Object.entries(contextIdToConfigId).forEach(async ([contextId, configId]) => {
            const result = await client.getPrivate({
              url: `/rest/servicedesk/cmdb/latest/fieldconfig/${configId}`,
            })
            const assetObject = await toBasicInstance({
              entry: {
                id: configId,
                ...result.data,
              },
              type: assetsObjectFieldConfigurationType,
              transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
              transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
              defaultName: 'AssetsObjectFieldConfiguration',
            })
            const fieldContext = instance.value.contexts
              .filter(isResolvedReferenceExpression)
              .find((context: ReferenceExpression) => context.value.value.id === contextId)
            if (fieldContext === undefined) {
              throw new Error(`Failed to find field context with id ${contextId}`)
            }
            fieldContext.value.value.assetsObjectFieldConfiguration = assetObject.value
          })
        } catch (e) {
          log.error(`Failed to fetch asset object context for field context ${instance.elemID.getFullName()}: ${e}`)
        }
      }),
    )
  },
  preDeploy: async changes => {
    const relevantChanges = getRelevantAssetsObjectFieldConfiguration(changes)
    if (_.isEmpty(relevantChanges)) {
      return
    }
    const workspaceId = await getWorkspaceId(client, config)
    relevantChanges.forEach(instance => {
      instance.value.assetsObjectFieldConfiguration.workspaceId = workspaceId
      if (instance.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue === undefined) {
        instance.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue = []
      }
    })
  },
  onDeploy: async changes => {
    getRelevantAssetsObjectFieldConfiguration(changes).forEach(instance => {
      delete instance.value.assetsObjectFieldConfiguration.workspaceId
      if (_.isEmpty(instance.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue)) {
        delete instance.value.assetsObjectFieldConfiguration.attributesDisplayedOnIssue
      }
    })
  },
})
export default filter
