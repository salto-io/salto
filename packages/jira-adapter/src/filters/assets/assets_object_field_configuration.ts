/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { createSchemeGuard, getParent, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { elements as elementUtils, config as configUtils, resolveValues } from '@salto-io/adapter-components'
import { parse } from 'node-html-parser'
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
  isRemovalChange,
  isAdditionChange,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../fields/constants'
import { addAnnotationRecursively, findObject, HTMLResponse, isHTMLResponse } from '../../utils'
import { ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE, JIRA } from '../../constants'
import { getWorkspaceId } from '../../workspace_id'
import JiraClient from '../../client/client'
import { JiraConfig } from '../../config/config'
import { getLookUpName } from '../../reference_mapping'
import { removeCustomFieldPrefix } from '../jql/template_expression_generator'

const { toBasicInstance } = elementUtils
const { getTransformationConfigByType } = configUtils
const log = logger(module)

const CMDB_OBJECT_FIELD_CONFIGURATION = 'com.atlassian.jira.plugins.cmdb:cmdb-object-cftype'
const FIELD_CONFIG_ID_REGEX = /fieldConfigId=(\d+)/
const FIELD_CONTEXT_ID_REGEX = /fieldConfigSchemeId=(\d+)/

type CMBD_ERROR = {
  errorMessage: string
}

type CMBD_ERROR_RESPONSE = {
  response: {
    data: {
      errors: CMBD_ERROR[]
    }
  }
}

const CMBD_ERROR_RESPONSE_SCHEME = Joi.object({
  response: Joi.object({
    data: Joi.object({
      errors: Joi.array()
        .items(
          Joi.object({
            errorMessage: Joi.string().required(),
          })
            .required()
            .unknown(true),
        )
        .required(),
    })
      .required()
      .unknown(true),
  })
    .required()
    .unknown(true),
}).unknown(true)

const isCMBDErrorResponse = createSchemeGuard<CMBD_ERROR_RESPONSE>(
  CMBD_ERROR_RESPONSE_SCHEME,
  'Received an invalid CMBD error response',
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

const getAssetsContextIdsFromHTML = async (client: JiraClient, fieldId: string): Promise<Record<string, string>> => {
  const numericCustomFieldId = removeCustomFieldPrefix(fieldId)
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

const getFieldConfigId = async (client: JiraClient, change: Change<InstanceElement>): Promise<string | undefined> => {
  const instance = getChangeData(change)
  if (!isAdditionChange(change)) {
    return instance.value.assetsObjectFieldConfiguration.id
  }
  const contextIdToConfigId = await getAssetsContextIdsFromHTML(client, getParent(instance).value.id)
  const configId = contextIdToConfigId[instance.value.id]
  if (configId === undefined) {
    throw new Error(`Failed to find field context with id ${instance.value.id}`)
  }
  return configId
}

export const deployAssetObjectContext = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  config: JiraConfig,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  if (!config.fetch.enableAssetsObjectFieldConfiguration) {
    return
  }
  const instance = getChangeData(change)
  if (isRemovalChange(change) || instance.value.assetsObjectFieldConfiguration?.objectSchemaId === undefined) {
    return
  }
  const { workspaceId } = instance.value.assetsObjectFieldConfiguration
  // we insert the workspaceId to the instance in assetsObjectFieldConfigurationFilter
  if (workspaceId === undefined) {
    log.error('Skip deployment of assetsObjectFieldConfiguration because workspaceId is undefined')
    throw new Error(
      `assetsObjectFieldConfiguration won't be deployed for instance ${instance.elemID.getFullName()}, due to error with the workspaceId. The context might be deployed partially.`,
    )
  }

  // we need the elementsSource when the change was added from contexts_projects_filter because the change can not be resolved without it
  // we can remove the elementsSource when SALTO-6322 is done
  const resolvedInstance = await resolveValues(instance, getLookUpName, elementsSource)
  try {
    const configId = await getFieldConfigId(client, change)
    await client.putPrivate({
      url: `rest/servicedesk/cmdb/latest/fieldconfig/${configId}`,
      data: _.omit(resolvedInstance.value.assetsObjectFieldConfiguration, 'id'),
    })
  } catch (e) {
    const errorMessages = isCMBDErrorResponse(e)
      ? e.response.data.errors.map(error => error.errorMessage).join(', ')
      : e.message
    throw new Error(
      `Failed to deploy asset object field configuration for instance ${instance.elemID.getFullName()} with error: ${errorMessages}. The context might be deployed partially.`,
    )
  }
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
    assetsObjectFieldConfigurationType.fields.id.annotations = {
      [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
    }

    elements.push(assetsObjectFieldConfigurationType)

    if (!config.fetch.enableAssetsObjectFieldConfiguration) {
      return
    }

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
          const contextIdToConfigId = await getAssetsContextIdsFromHTML(client, instance.value.id)
          await Promise.all(
            Object.entries(contextIdToConfigId).map(async ([contextId, configId]) => {
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
            }),
          )
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
