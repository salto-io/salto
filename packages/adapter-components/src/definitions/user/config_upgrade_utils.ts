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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { objects } from '@salto-io/lowerdash'
import { InstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ElemIDCustomization } from './fetch_config'
import { AdapterApiConfig, dereferenceFieldName, isReferencedIdField } from '../../config_deprecated'

const log = logger(module)

/**
 * Convert elemID definitions from deprecated api definitions in user config to the new format
 * Note:
 * 1. config is changed in place
 * 2. only elemID related definitions are converted
 */
const updateElemIDDefinitions = <TCustomNameMappingOptions extends string>(
  apiDefinitions: AdapterApiConfig,
): Record<string, ElemIDCustomization<TCustomNameMappingOptions>> => {
  const { types } = apiDefinitions
  if (_.isEmpty(types)) {
    return {}
  }

  const convertedIds = _.mapValues(types, (defs, typeName) => {
    const transformationConfig = defs.transformation
    if (transformationConfig === undefined) {
      return undefined
    }
    const updatedElemIDConfig: ElemIDCustomization<TCustomNameMappingOptions> = {}
    const { idFields, extendsParentId, nameMapping } = transformationConfig
    if (extendsParentId !== undefined) {
      updatedElemIDConfig.extendsParent = extendsParentId
      delete transformationConfig.extendsParentId
    }
    if (idFields !== undefined) {
      const updatedIdFields = idFields.map(fieldName =>
        isReferencedIdField(fieldName)
          ? { fieldName: dereferenceFieldName(fieldName), isReference: true }
          : { fieldName },
      )
      updatedElemIDConfig.parts = updatedIdFields
      delete transformationConfig.idFields
    }
    if (nameMapping !== undefined) {
      if (updatedElemIDConfig.parts !== undefined) {
        updatedElemIDConfig.parts.forEach(part => _.set(part, 'mapping', nameMapping))
      } else {
        // handling the case of when mappings exists but idFields are missing is not trivial, because we don't know which parts should be updated
        log.warn('found nameMapping without idFields for type %s', typeName)
      }
      delete transformationConfig.nameMapping
    }

    log.debug(
      'converted elemIDs definitions for type %s from %o to %o',
      typeName,
      _.pick(transformationConfig, ['idFields', 'extendsParentId', 'nameMapping']),
      updatedElemIDConfig,
    )
    return updatedElemIDConfig
  })

  const typesWithIds = _.omitBy(convertedIds, _.isEmpty)

  return _.isEmpty(typesWithIds) ? {} : { elemID: typesWithIds }
}

/**
 * Partial upgrade of deprecated definitions in user config to the new format:
 * 1. Upgrades elemID definitions from apiDefinitions to fetch.elemID
 * 2. Removes empty parts in deprecated apiDefinitions
 */
export const updateDeprecatedConfig = (
  config: InstanceElement,
): { config: InstanceElement; message: string } | undefined => {
  const apiDefs = config.value?.apiDefinitions
  if (apiDefs === undefined) {
    return undefined
  }

  log.warn('adapter config contains deprecated api definitions: %s', safeJsonStringify(apiDefs))
  const updatedConfig = config.clone()
  const updatedElemIDs = updateElemIDDefinitions(updatedConfig.value.apiDefinitions)
  if (_.isEmpty(updatedElemIDs)) {
    log.debug('found no elemID definitions to update in config')
    return undefined
  }
  if (updatedConfig.value.fetch?.elemID !== undefined) {
    log.error(
      'found existing elemID definitions in config: %s, merging with new definitions',
      safeJsonStringify(updatedConfig.value.fetch.elemID),
    )
  }
  const mergedElemIDConfig = _.merge(_.pick(updatedConfig.value.fetch, 'elemID'), updatedElemIDs)

  const cleanedApiDefs = objects.cleanEmptyObjects(updatedConfig.value?.apiDefinitions)
  updatedConfig.value = {
    ...updatedConfig.value,
    fetch: {
      ...updatedConfig.value.fetch,
      ...mergedElemIDConfig,
    },
    apiDefinitions: cleanedApiDefs,
  }

  if (updatedConfig.value.apiDefinitions !== undefined) {
    log.error(
      'some deprecated apiDefinitions remained in config: %s',
      safeJsonStringify(updatedConfig.value.fetch.apiDefinitions),
    )
  }
  return {
    config: updatedConfig,
    message:
      'Elem ID customizations are now under `fetch.elemID`. The following changes will upgrade the deprecated definitions from `apiDefinitions` to the new location.',
  }
}
