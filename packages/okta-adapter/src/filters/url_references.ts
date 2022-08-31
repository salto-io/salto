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
import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { Element, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

type linkProperty = {
    href: string
}

const LINK_PROPERTY_SCHEME = Joi.object({
  href: Joi.string().required(),
}).unknown(true).required()

const isLinkProperty = createSchemeGuard<linkProperty>(LINK_PROPERTY_SCHEME, 'Received invalid link property')

const URL_REFERENCES_MAPPING: Record<string, string[]> = {
  Application: ['profileEnrollment', 'accessPolicy'],
}
const INSTANCE_LINKS_PATH = ['_links', 'additionalProperties']

const extractIdFromUrl = (url: string): string | undefined => {
  const urlParts = url.split('/')
  return urlParts.pop()
}

const replaceUrlsWithIds = (instance: InstanceElement): void => {
  const relevantFields = URL_REFERENCES_MAPPING[instance.elemID.typeName]
  const linksObject = _.get(instance.value, INSTANCE_LINKS_PATH)
  Object.keys(linksObject)
    .filter(field => relevantFields.includes(field))
    .forEach(field => {
      if (isLinkProperty(linksObject[field])) {
        const url = _.get(linksObject, [field, 'href'])
        const id = extractIdFromUrl(url)
        if (_.isString(id)) {
          _.set(instance.value, field, extractIdFromUrl(url))
        }
      }
    })
}

/**
 * The filter extract ids from urls based on predefined rules
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => Object.keys(URL_REFERENCES_MAPPING).includes(instance.elemID.typeName))
      .forEach(instance => replaceUrlsWithIds(instance))
  },

  // TODO Delete the added fields once we add deploy
  // preDeploy: async changes => {
  // },

  // OnDeploy: async changes => {
  // },
})

export default filter
