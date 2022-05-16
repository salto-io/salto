/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { FilterCreator } from '../filter'

const AVATAR_URLS_FIELD = 'avatarUrls'
const ICON_URL_FIELD = 'iconUrl'

const AVATAR_ID_PATTERN = new RegExp('/rest/api/\\d+/universal_avatar/view/type/\\w+/avatar/(\\d+)')

const removeDomainPrefix = (url: string, baseUrl: string): string => {
  // This is to make sure the url will always have '/' in the end
  const fixedBaseUrl = new URL(baseUrl).href
  return url.startsWith(fixedBaseUrl) ? url.slice(fixedBaseUrl.length - 1) : url
}

const filter: FilterCreator = ({ client }) => ({
  // There is no need to revert the changes of iconUrl and avatarUrls
  // pre deploy because they are not deployable
  // (and we already have a change validator for undeployable changes)
  onFetch: async elements => {
    elements
      .filter(isInstanceElement)
      .forEach(element => {
        walkOnElement({
          element,
          func: ({ value }) => {
            const objValues = isInstanceElement(value) ? value.value : value

            if (!_.isPlainObject(objValues)) {
              return WALK_NEXT_STEP.RECURSE
            }

            let url: string | undefined
            if (objValues[ICON_URL_FIELD] !== undefined) {
              objValues[ICON_URL_FIELD] = removeDomainPrefix(
                objValues[ICON_URL_FIELD],
                client.baseUrl
              )
              url = objValues[ICON_URL_FIELD]
            }

            if (!_.isEmpty(objValues[AVATAR_URLS_FIELD] ?? {})) {
              objValues[AVATAR_URLS_FIELD] = _.mapValues(
                objValues[AVATAR_URLS_FIELD],
                avatarUrl => removeDomainPrefix(avatarUrl, client.baseUrl)
              );
              [url] = Object.values(objValues[AVATAR_URLS_FIELD])
            }

            if (url !== undefined) {
              const match = AVATAR_ID_PATTERN.exec(url)
              if (match !== null) {
                delete objValues[AVATAR_URLS_FIELD]
                delete objValues[ICON_URL_FIELD]
              }
            }

            return WALK_NEXT_STEP.RECURSE
          },
        })
      })
  },
})

export default filter
