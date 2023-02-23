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
import _ from 'lodash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { Element, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { APPLICATION_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { extractIdFromUrl } from '../utils'

type linkProperty = {
    href: string
}

const LINK_PROPERTY_SCHEME = Joi.object({
  href: Joi.string().required(),
}).unknown(true).required()

const isLinkProperty = createSchemeGuard<linkProperty>(LINK_PROPERTY_SCHEME, 'Received invalid link property')

const RELEVAT_FIELDS = ['profileEnrollment', 'accessPolicy']
const INSTANCE_LINKS_PATH = ['_links']

const extractIdsFromUrls = (instance: InstanceElement): void => {
  const linksObject = _.get(instance.value, INSTANCE_LINKS_PATH)
  Object.keys(linksObject)
    .filter(field => RELEVAT_FIELDS.includes(field))
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
 * The filter extract ids from urls in _links object in application type
 */
const filter: FilterCreator = () => ({
  name: 'urlReferencesFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === APPLICATION_TYPE_NAME)
      .forEach(instance => extractIdsFromUrls(instance))
  },
})

export default filter
