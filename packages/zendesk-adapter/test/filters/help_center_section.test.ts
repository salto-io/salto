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

import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import ZendeskClient from '../../src/client/client'
import filterCreator from '../../src/filters/help_center_section'
import { paginate } from '../../src/client/pagination'
import { DEFAULT_CONFIG } from '../../src/config'
import { ZENDESK } from '../../src/constants'

describe('guid section filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType

  const sectionTypeName = 'section'
  const sectionTranslationTypename = 'section_translation'
  const sectionType = new ObjectType({ elemID: new ElemID(ZENDESK, sectionTypeName) })
  const sectionTranslationType = new ObjectType(
    { elemID: new ElemID(ZENDESK, sectionTranslationTypename) }
  )

  const sectionTranslationInstance = new InstanceElement(
    'instance',
    sectionTranslationType,
    {
      locale: 'he',
      title: 'name',
      body: 'description',
    }
  )

  const sectionInstance = new InstanceElement(
    'instance',
    sectionType,
    {
      name: 'name',
      description: 'description',
      source_locale: 'he',
      translations: [
        sectionTranslationInstance.value,
      ],
    }
  )


  beforeEach(async () => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })

  describe('onFetch', () => {
    it('should omit the name and description fields', async () => {
      const sectionInstanceCopy = sectionInstance.clone()
      await filter.onFetch([sectionTranslationInstance, sectionInstanceCopy])
      expect(sectionInstanceCopy.value).toEqual({
        source_locale: 'he',
        translations: [
          sectionTranslationInstance.value,
        ],
      })
    })
  })

  describe('preDeploy', () => {
    it('should add the name and description fields before deploy', async () => {
      const sectionInstanceCopy = sectionInstance.clone()
      await filter.onFetch([sectionTranslationInstance, sectionInstanceCopy])
      expect(sectionInstanceCopy).not.toEqual(sectionInstance)
      await filter.preDeploy([toChange({ after: sectionInstanceCopy })])
      expect(sectionInstanceCopy).toEqual(sectionInstance)
    })
  })

  describe('onDeploy', () => {
    it('should omit the name and description fields after deploy', async () => {
      const sectionInstanceCopy = sectionInstance.clone()
      await filter.onFetch([sectionTranslationInstance, sectionInstanceCopy])
      await filter.preDeploy([toChange({ after: sectionInstanceCopy })])
      await filter.onDeploy([toChange({ after: sectionInstanceCopy })])
      expect(sectionInstanceCopy.value).toEqual({
        source_locale: 'he',
        translations: [
          sectionTranslationInstance.value,
        ],
      })
    })
  })
})
