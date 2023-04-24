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
import { Element, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { extractTemplate } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { ORG_SETTING_TYPE_NAME } from '../constants'

const log = logger(module)

/**
 * Create template expressions for url in BrandTheme type
 */
const filter: FilterCreator = () => ({
  name: 'templateUrlsFilter',
  onFetch: async (elements: Element[]) => {
    const instances = elements.filter(isInstanceElement)
    const orgSettingsInstance = instances.find(instance => instance.elemID.typeName === ORG_SETTING_TYPE_NAME)
    if (orgSettingsInstance === undefined) {
      log.warn(`Could not find ${ORG_SETTING_TYPE_NAME} instance, skipping templateUrlsFilter`)
      return
    }
    const { subdomain } = orgSettingsInstance.value
    if (!_.isString(subdomain)) {
      log.warn('Could not find subdomain, skipping templateUrlsFilter')
    }
    const subdomainRegString = `://${subdomain}`
    const subdomainReg = new RegExp(`(${subdomainRegString})`)

    const brandThemeInstance = instances.find(instance => instance.elemID.typeName === 'BrandTheme')
    const faviconUrl = brandThemeInstance?.value?.favicon
    if (brandThemeInstance === undefined || !_.isString(faviconUrl)) {
      log.warn('Could not change favicon field in BrandTheme with TemplateExpression')
      return
    }
    const template = extractTemplate(
      faviconUrl,
      [subdomainReg],
      expression => {
        if (expression === `${subdomainRegString}`) {
          return ['://', new ReferenceExpression(orgSettingsInstance.elemID.createNestedID('subdomain'), subdomain)]
        }
        return expression
      },
    )
    brandThemeInstance.value.favicon = template
  },
})

export default filter
