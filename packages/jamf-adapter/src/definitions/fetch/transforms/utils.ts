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
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'

type WithIdType = {
  id: number
}

const isWithIdType = (value: unknown): value is WithIdType => values.isPlainObject(value) && 'id' in value

/*
 * Convert site object to site id to make reference
 */
export const adjustSiteObjectToSiteId = (value: Record<string, unknown>): void => {
  const site = _.get(value, 'general.site')
  if (isWithIdType(site)) {
    _.set(value, 'general.site', site.id === -1 ? _.get(value, 'general.site.name') : site.id)
  }
}

/*
 * Convert category object to category id to make reference
 */
export const adjustCategoryObjectToCategoryId = (value: Record<string, unknown>): void => {
  const category = _.get(value, 'general.category')
  if (isWithIdType(category)) {
    _.set(value, 'general.category', category.id === -1 ? _.get(value, 'general.category.name') : category.id)
  }
}

/*
 * Convert scripts object array to scripts ids to make reference
 */
export const adjustScriptsObjectArrayToScriptsIds = (value: Record<string, unknown>): void => {
  const { scripts } = value
  if (Array.isArray(scripts) && scripts.every(isWithIdType)) {
    value.scripts = scripts.map(({ id }) => id)
  }
}

/*
 * Extract id field from being under "general" field to be top level
 */
export const adjustServiceIdToTopLevel = (value: Record<string, unknown>): void => {
  const { general } = value
  if (!values.isPlainRecord(general)) {
    throw new Error('Expected value to be a record')
  }
  const id = _.get(general, 'id')
  _.set(general, 'id', undefined)
  value.id = id
}

/*
 * Remove self_service_icon from self_service object
 */
export const removeSelfServiceIcon = (value: Record<string, unknown>): void => {
  const { self_service: selfService } = value
  if (values.isPlainRecord(selfService)) {
    delete selfService.self_service_icon
  }
}
