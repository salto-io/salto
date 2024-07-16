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
import { getParent } from '@salto-io/adapter-utils'
import { elements as elementUtils, config as configUtils } from '@salto-io/adapter-components'
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
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'
import { FilterCreator } from '../../filter'
import { FIELD_CONTEXT_TYPE_NAME } from '../fields/constants'
import { addAnnotationRecursively, findObject } from '../../utils'
import { ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE, JIRA } from '../../constants'
import { getWorkspaceId } from '../../workspace_id'

const { toBasicInstance } = elementUtils
const { getTransformationConfigByType } = configUtils
const log = logger(module)

const CmdbObjectFieldConfiguration = 'com.atlassian.jira.plugins.cmdb:cmdb-object-cftype'

export const getAssetsContextId = (instance: InstanceElement): string => {
  if (Number.isNaN(instance.value.id)) {
    throw new Error(`context id is not a number, received: ${instance.value.id}`)
  }
  // SALTO-6254 we need to figure out where to get the asset-context id from.
  // This heuristic works so far and a temporal implementation
  return _.toString(_.toInteger(instance.value.id) - 1)
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
    const fieldContextType = findObject(elements, FIELD_CONTEXT_TYPE_NAME)
    if (fieldContextType === undefined) {
      log.error('fieldContext type was not found')
      return
    }

    const assetsObjectFieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, ASSETS_OBJECT_FIELD_CONFIGURATION_TYPE),
      fields: {
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

    const fieldContexts = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(instance => getParent(instance).value.type === CmdbObjectFieldConfiguration)

    await Promise.all(
      fieldContexts.map(async instance => {
        try {
          const assetContextId = getAssetsContextId(instance)
          const result = await client.getPrivate({
            url: `/rest/servicedesk/cmdb/latest/fieldconfig/${assetContextId}`,
          })
          const assetObject = await toBasicInstance({
            entry: result.data,
            type: assetsObjectFieldConfigurationType,
            transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
            transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
            defaultName: 'AssetsObjectFieldConfiguration',
          })
          instance.value.assetsObjectFieldConfiguration = assetObject.value
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
