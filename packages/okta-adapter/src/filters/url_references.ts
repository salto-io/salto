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
import { APPLICATION_TYPE_NAME, APP_USER_TYPE_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { extractIdFromUrl } from '../utils'

type LinkProperty = {
    href: string
}

type NamedLinksProperty = {
  name: string
  link: LinkProperty
}

const LINK_PROPERTY_SCHEME = Joi.object({
  href: Joi.string().required(),
}).unknown(true).required()

const NAMED_LINKS_PROPERTY_SCHEME = Joi.array().items(
  Joi.object({
    name: Joi.string().required(),
    link: LINK_PROPERTY_SCHEME,
  }).unknown(true)
).required()

const isLinkProperty = createSchemeGuard<LinkProperty>(LINK_PROPERTY_SCHEME, 'Received invalid link property')
const isNamedLinksProperty = createSchemeGuard<NamedLinksProperty[]>(NAMED_LINKS_PROPERTY_SCHEME, 'Received invalid named links property')

const RELEVAT_FIELDS_BY_TYPE: Record<string, string[]> = {
  [APPLICATION_TYPE_NAME]: ['profileEnrollment', 'accessPolicy'],
  AppUserType: ['app'],
}
const INSTANCE_LINKS_PATH = ['_links']

const extractIdsFromUrls = (instance: InstanceElement): void => {
  const linksObject = _.get(instance.value, INSTANCE_LINKS_PATH)
  Object.keys(linksObject)
    .filter(field => RELEVAT_FIELDS_BY_TYPE[instance.elemID.typeName]?.includes(field))
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

const extractSchemaIds = (instance: InstanceElement): void => {
  const linksObject = _.get(instance.value, INSTANCE_LINKS_PATH.concat('schemas'))
  if (!isNamedLinksProperty(linksObject)) {
    return
  }
  const namedSchemas = Object.fromEntries(linksObject.map(obj => ([obj.name, extractIdFromUrl(obj.link.href)])))
  _.set(instance.value, 'schemas', namedSchemas)
}

/**
 * The filter extract ids from urls in _links object in relevant types (application, app user type)
 */
const filter: FilterCreator = () => ({
  name: 'urlReferencesFilter',
  onFetch: async (elements: Element[]) => {
    const relevantTypes = Object.keys(RELEVAT_FIELDS_BY_TYPE)
    const relevantElements = elements
      .filter(isInstanceElement)
      .filter(instance => relevantTypes.includes(instance.elemID.typeName))

    // TODO currently not used, can remove
    relevantElements.forEach(instance => extractIdsFromUrls(instance))
    relevantElements.filter(instance => instance.elemID.typeName === APP_USER_TYPE_TYPE_NAME).forEach(extractSchemaIds)
  },
})

export default filter
