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
import { isInstanceElement } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { ISSUE_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

const AVATAR_URLS_FIELD = 'avatarUrls'
const ICON_URL_FIELD = 'iconUrl'

export const removeDomainPrefix = (url: string, baseUrl: string): string => {
  // This is to make sure the url will always have '/' in the end
  const fixedBaseUrl = new URL(baseUrl).href
  return url.startsWith(fixedBaseUrl) ? url.slice(fixedBaseUrl.length - 1) : url
}

const filter: FilterCreator = ({ client }) => ({
  name: 'avatarsFilter',
  // There is no need to revert the changes of iconUrl and avatarUrls
  // pre deploy because they are not deployable
  // (and we already have a change validator for undeployable changes)
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .forEach(element => {
        walkOnElement({
          element,
          func: ({ value, path }) => {
            const objValues = isInstanceElement(value) ? value.value : value

            if (!_.isPlainObject(objValues)) {
              return WALK_NEXT_STEP.RECURSE
            }
            if (path.typeName === ISSUE_TYPE_NAME) {
              delete objValues[ICON_URL_FIELD]
            } else if (objValues[ICON_URL_FIELD] !== undefined) {
              objValues[ICON_URL_FIELD] = removeDomainPrefix(
                objValues[ICON_URL_FIELD],
                client.baseUrl
              )
            }
            delete objValues[AVATAR_URLS_FIELD]
            return WALK_NEXT_STEP.RECURSE
          },
        })
      })
  },
})

export default filter
