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
import { ObjectType, ElemID, InstanceElement, Element, isInstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { SUPPORTED_TYPES } from '../../src/config'
import ZuoraClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZUORA_BILLING, SETTINGS_TYPE_PREFIX } from '../../src/constants'
import filterCreator from '../../src/filters/unordered_lists'

describe('Unordered lists filter', () => {
  let client: ZuoraClient
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const settingsRoleType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, `${SETTINGS_TYPE_PREFIX}Role`),
    })
    const roleWithAttrs = new InstanceElement('normal', settingsRoleType, {
      attributes: [
        { scope: 'a', name: 'b' },
        { scope: 'c', name: 'a', activationLevel: 'l1' },
        { name: 'a', activationLevel: 'l1' },
      ],
    })
    const emptyRole = new InstanceElement('empty', settingsRoleType, {})

    const settingsGatewayType = new ObjectType({
      elemID: new ElemID(ZUORA_BILLING, `${SETTINGS_TYPE_PREFIX}Gateway`),
    })
    const gatewayWithAttrs = new InstanceElement('normal', settingsGatewayType, {
      cardsAllowed: ['def', 'abc'],
      cardsAccepted: ['def', 'abc'],
    })

    const partialGateway = new InstanceElement('empty', settingsGatewayType, {
      cardsAllowed: ['def', 'abc'],
    })

    return [settingsRoleType, roleWithAttrs, emptyRole, settingsGatewayType, gatewayWithAttrs, partialGateway]
  }

  let elements: Element[]

  beforeAll(async () => {
    client = new ZuoraClient({
      credentials: { baseURL: 'http://localhost', clientId: 'id', clientSecret: 'secret' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: {
        fetch: {
          include: [],
          exclude: [],
        },
        apiDefinitions: {
          swagger: { url: 'ignore' },
          typeDefaults: {
            transformation: {
              idFields: ['name'],
            },
          },
          types: {},
          supportedTypes: SUPPORTED_TYPES,
        },
      },
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType

    elements = generateElements()
    await filter.onFetch(elements)
  })

  it('sort correctly even if fields are missing', async () => {
    const instances = elements.filter(isInstanceElement)
    expect(instances[0].value.attributes).toEqual([
      { name: 'a', activationLevel: 'l1' },
      { scope: 'a', name: 'b' },
      { scope: 'c', name: 'a', activationLevel: 'l1' },
    ])
    expect(instances[2].value.cardsAccepted).toEqual(['abc', 'def'])
    expect(instances[2].value.cardsAllowed).toEqual(['abc', 'def'])
    expect(instances[3].value.cardsAllowed).toEqual(['abc', 'def'])
  })

  it('do nothing when attributes are not specified', async () => {
    const instances = elements.filter(isInstanceElement)
    expect(instances[1].value.attributes).toBeUndefined()
    expect(instances[3].value.cardsAccepted).toBeUndefined()
  })
})
