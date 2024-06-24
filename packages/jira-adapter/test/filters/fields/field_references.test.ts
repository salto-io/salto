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

import { ElemID, InstanceElement, Element, ObjectType, ReferenceExpression, BuiltinTypes } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getFilterParams } from '../../utils'
import { JIRA, SCREEN_SCHEME_TYPE } from '../../../src/constants'
import fieldReferencesFilter from '../../../src/filters/field_references'
import { getDefaultConfig } from '../../../src/config/config'

describe('fieldReferencesFilter', () => {
  type filterType = filterUtils.FilterWith<'onFetch'>
  let elements: Element[]
  const screenTypesType = new ObjectType({
    elemID: new ElemID(JIRA, 'ScreenTypes'),
    fields: {
      default: { refType: BuiltinTypes.NUMBER },
    },
  })

  const screenSchemeType = new ObjectType({
    elemID: new ElemID(JIRA, SCREEN_SCHEME_TYPE),
    fields: {
      screens: { refType: screenTypesType },
    },
  })
  const screenType = new ObjectType({
    elemID: new ElemID(JIRA, 'Screen'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })

  const generateElements = (): Element[] => [
    screenSchemeType,
    screenType,
    screenTypesType,
    new InstanceElement('screen1', screenType, { id: 111 }),
    new InstanceElement('screenScheme1', screenSchemeType, { id: 222, screens: { default: 111 } }),
    new InstanceElement('screenScheme2', screenSchemeType, { id: 333, screens: { default: 444 } }),
  ]
  beforeEach(() => {
    elements = generateElements()
  })

  describe('on fetch', () => {
    it('should resolve field values when referenced element exists', async () => {
      const filter = fieldReferencesFilter(getFilterParams({})) as filterType
      await filter.onFetch(elements)
      const screenScheme1 = elements.find(e => e.elemID.name === 'screenScheme1') as InstanceElement
      expect(screenScheme1.value.screens.default).toBeInstanceOf(ReferenceExpression)
      expect(screenScheme1.value.screens.default.elemID.name).toEqual('screen1')
    })
    it('should create missing references if enableMissingReferences flag is enabled', async () => {
      const configWithMissingRefs = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      const filter = fieldReferencesFilter(getFilterParams({ config: configWithMissingRefs })) as filterType
      await filter.onFetch(elements)
      const screenScheme2 = elements.find(e => e.elemID.name === 'screenScheme2') as InstanceElement
      expect(screenScheme2.value.screens.default).toBeInstanceOf(ReferenceExpression)
      expect(screenScheme2.value.screens.default.elemID.getFullName()).toEqual('jira.Screen.instance.missing_444')
    })
    it('should not create missing references if enableMissingReferences flag is disabled', async () => {
      const configWithMissingRefs = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      configWithMissingRefs.fetch.enableMissingReferences = false
      const filter = fieldReferencesFilter(getFilterParams({ config: configWithMissingRefs })) as filterType
      await filter.onFetch(elements)
      const screenScheme2 = elements.find(e => e.elemID.name === 'screenScheme2') as InstanceElement
      expect(screenScheme2.value.screens.default).toBe(444)
    })
  })
})
