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

import { ElemID, InstanceElement, ObjectType, ReferenceExpression, TemplateExpression, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../utils'
import templateUrlsFilter from '../../src/filters/template_urls'
import { OKTA, ORG_SETTING_TYPE_NAME } from '../../src/constants'

describe('templateUrlsFilter', () => {
      type FilterType = filterUtils.FilterWith<'onFetch'>
      let filter: FilterType
      const orgType = new ObjectType({ elemID: new ElemID(OKTA, ORG_SETTING_TYPE_NAME) })
      const themeType = new ObjectType({ elemID: new ElemID(OKTA, 'BrandTheme') })
      const orgInst = new InstanceElement(
        ElemID.CONFIG_NAME,
        orgType,
        { subdomain: 'myOkta', companyName: 'comp', status: 'ACTIVE' },
      )
      const themeInstance = new InstanceElement(
        ElemID.CONFIG_NAME,
        themeType,
        { id: '111', favicon: 'https://myOkta.oktapreview.com/favicon.ico' },
      )

      const faviconTemplate = new TemplateExpression({
        parts: [
          'https://',
          new ReferenceExpression(orgInst.elemID.createNestedID('subdomain'), orgInst.value.subdomain),
          '.oktapreview.com/favicon.ico',
        ],
      })

      beforeEach(() => {
        filter = templateUrlsFilter(getFilterParams()) as typeof filter
      })

      describe('onFetch', () => {
        it('should resolve templates in urls', async () => {
          const elements = [orgType, orgInst, themeInstance.clone(), themeType]
          await filter.onFetch(elements)
          const theme = elements.filter(isInstanceElement).find(i => i.elemID.typeName === 'BrandTheme')
          expect(theme?.value?.favicon).toEqual(faviconTemplate)
        })

        it('should not create reference for org settings if org settings instance does not exist', async () => {
          const elements = [orgType, themeInstance.clone(), themeType]
          await filter.onFetch(elements)
          const theme = elements.filter(isInstanceElement).find(i => i.elemID.typeName === 'BrandTheme')
          expect(theme?.value?.favicon).toEqual('https://myOkta.oktapreview.com/favicon.ico')
        })

        it('should not create referene if subdomain exist somewhere else in the url', async () => {
          const themeWithSub = themeInstance.clone()
          themeWithSub.value.favicon = 'https://myOkta.oktapreview.com/myOkta/favicon.ico'
          const elements = [orgType, orgInst, themeWithSub, themeType]
          await filter.onFetch(elements)
          const theme = elements.filter(isInstanceElement).find(i => i.elemID.typeName === 'BrandTheme')
          expect(theme?.value?.favicon).toEqual(new TemplateExpression({
            parts: [
              'https://',
              new ReferenceExpression(orgInst.elemID.createNestedID('subdomain'), orgInst.value.subdomain),
              '.oktapreview.com/myOkta/favicon.ico',
            ],
          }))
        })
      })
})
