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
import {
  CORE_ANNOTATIONS,
  Element,
  isElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { LocalFilterCreator } from '../filter'
import { buildElementsSourceForFetch, ENDS_WITH_CUSTOM_SUFFIX_REGEX, getNamespace } from './utils'
import { NAMESPACE_SEPARATOR } from '../constants'
import { isMetadataInstanceElement, MetadataInstanceElement } from '../transformers/transformer'


const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

const getAliasFromFullName = (instanceFullName: string): string => {
  const nameWithoutParent = _.last(instanceFullName.split(/[.-]/)) ?? instanceFullName
  return _.last(nameWithoutParent
    .replace(ENDS_WITH_CUSTOM_SUFFIX_REGEX, '')
    .split(NAMESPACE_SEPARATOR)) ?? instanceFullName
}

const getParentAlias = async (
  instance: MetadataInstanceElement,
  elementsSource: ReadOnlyElementsSource
): Promise<string | undefined> => {
  const [parent] = getParents(instance)
  if (!isReferenceExpression(parent)) {
    log.debug('parent is not a reference expression. %o', parent)
    return undefined
  }
  const resolvedParent = await parent.getResolvedValue(elementsSource)
  return isElement(resolvedParent)
    ? resolvedParent.annotations[CORE_ANNOTATIONS.ALIAS]
    : undefined
}

const setInstanceAlias = async (
  instance: MetadataInstanceElement,
  elementsSource: ReadOnlyElementsSource
): Promise<void> => {
  const namespace = await getNamespace(instance)
  const parentAlias = await getParentAlias(instance, elementsSource)
  const alias = [
    parentAlias ? `${parentAlias}:` : undefined,
    getAliasFromFullName(instance.value.fullName),
    namespace ? `(${namespace})` : undefined,
  ].filter(isDefined)
    .join(' ')
    .replace(/_/g, ' ') // replace all underscores with spaces
  if (alias !== instance.value.fullName) {
    instance.annotations[CORE_ANNOTATIONS.ALIAS] = alias
  }
}

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'metadataInstancesAliases',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config.fetchProfile.isFeatureEnabled('skipAliases')) {
      log.debug('not adding aliases to metadata instances.')
      return
    }
    const elementsSource = buildElementsSourceForFetch(elements, config)
    await awu(elements)
      .filter(isMetadataInstanceElement)
      .forEach(metadataInstance => setInstanceAlias(metadataInstance as MetadataInstanceElement, elementsSource))
  },
})

export default filterCreator
