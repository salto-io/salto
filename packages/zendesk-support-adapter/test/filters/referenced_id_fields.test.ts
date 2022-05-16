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
import { ObjectType, ElemID, InstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG, FETCH_CONFIG, SUPPORTED_TYPES } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { ZENDESK_SUPPORT } from '../../src/constants'
import { paginate } from '../../src/client/pagination'
import filterCreator from '../../src/filters/referenced_id_fields'

describe('referenced id fields filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const localeObj = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'locales') })
  const localeIns = new InstanceElement('es', localeObj, { id: 123, locale: 'es-US', name: 'English' })
  const dynamicContentItemVarObj = new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'dynamic_content_item__variants') })
  const dynamicContentItemVarIns = new InstanceElement(
    '123',
    dynamicContentItemVarObj,
    { locale_id: new ReferenceExpression(localeIns.elemID, localeIns), content: 'abc' },
  )
  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
  })

  it('should resolve ids in instances names if & exist in the config', async () => {
    const elements = [dynamicContentItemVarIns].map(e => e.clone())
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
    await filter.onFetch(elements)
    expect(elements.map(e => e.elemID.getFullName()).sort())
      .toEqual(['zendesk_support.dynamic_content_item__variants.instance.es'])
  })
  it('should not add referenced id fields if & is not in the config', async () => {
    const elements = [dynamicContentItemVarIns].map(e => e.clone())
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: DEFAULT_CONFIG[FETCH_CONFIG],
        apiDefinitions: {
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {
            dynamic_content_item__variants: {
              transformation: {
                idFields: ['locale_id'],
              },
            },
          },
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
    await filter.onFetch(elements)
    expect(elements.map(e => e.elemID.getFullName()).sort())
      .toEqual(['zendesk_support.dynamic_content_item__variants.instance.123'])
  })
})
