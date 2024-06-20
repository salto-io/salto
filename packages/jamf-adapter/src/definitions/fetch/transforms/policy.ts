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
import { definitions } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'

/*
 * Convert site object to site id to make reference
 */
const adjustSiteObjectToSiteId = (value: Record<string, unknown>): void => {
  const siteId = _.get(value, 'general.site.id')
  _.set(value, 'general.site', siteId === -1 ? _.get(value, 'general.site.name') : siteId)
}

/*
 * Convert category object to category id to make reference
 */
const adjustCategoryObjectToCategoryId = (value: Record<string, unknown>): void => {
  const categoryId = _.get(value, 'general.category.id')
  _.set(value, 'general.category', categoryId === -1 ? _.get(value, 'general.category.name') : categoryId)
}

/*
 * Convert scripts object array to scripts ids to make reference
 */
const adjustScriptsObjectArrayToScriptsIds = (value: Record<string, unknown>): void => {
  const { scripts } = value
  if (Array.isArray(scripts)) {
    value.scripts = scripts.map(({ id }) => id)
  }
}

/*
 * Extract id field from being under "general" field to be top level
 */
const adjustServiceIdToTopLevel = (value: Record<string, unknown>): void => {
  const { general } = value
  if (!values.isPlainRecord(general)) {
    throw new Error('Expected value to be a record')
  }
  const id = _.get(general, 'id')
  _.set(general, 'id', undefined)
  value.id = id
}

/*
 * Adjust policy instance
 */
export const adjust: definitions.AdjustFunction = ({ value }) => {
  if (!values.isPlainRecord(value)) {
    throw new Error('Expected value to be a record')
  }
  ;[
    adjustCategoryObjectToCategoryId,
    adjustSiteObjectToSiteId,
    adjustScriptsObjectArrayToScriptsIds,
    adjustServiceIdToTopLevel,
  ].forEach(fn => fn(value))
  return { value }
}
