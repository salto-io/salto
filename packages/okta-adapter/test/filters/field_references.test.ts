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
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, isInstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import filterCreator from '../../src/filters/field_references'
import { APPLICATION_TYPE_NAME, OKTA, USERTYPE_TYPE_NAME } from '../../src/constants'
import { getFilterParams } from '../utils'

describe('fieldReferencesFilter', () => {
    type FilterType = filterUtils.FilterWith<'onFetch'>
    let filter: FilterType

    beforeAll(() => {
      filter = filterCreator(getFilterParams({})) as FilterType
    })

    const profileMappingSource = new ObjectType({
      elemID: new ElemID(OKTA, 'ProfileMappingSource'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        type: { refType: BuiltinTypes.STRING },
      },
    })
    const profileMappingType = new ObjectType({
      elemID: new ElemID(OKTA, 'ProfileMapping'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        source: { refType: profileMappingSource },
        target: { refType: profileMappingSource },
      },
    })
    const userTypeType = new ObjectType({ elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME) })
    const appType = new ObjectType({ elemID: new ElemID(OKTA, APPLICATION_TYPE_NAME) })
    const generateElements = (
    ): Element[] => ([
      profileMappingType,
      userTypeType,
      appType,
      profileMappingSource,
      new InstanceElement(
        'mapping1',
        profileMappingType,
        { source: { id: '111', type: 'user' }, target: { id: '222', type: 'appuser' } },
      ),
      new InstanceElement('app1', appType, { id: '222' }),
      new InstanceElement('userType1', userTypeType, { id: '111' }),
    ])

    describe('onFetch', () => {
      let elements: Element[]

      beforeAll(async () => {
        elements = generateElements()
        await filter.onFetch(elements)
      })

      it('should resolve field values when referenced element exists', () => {
        const mapping1 = elements.filter(
          e => isInstanceElement(e) && e.elemID.name === 'mapping1'
        )[0] as InstanceElement
        expect(mapping1.value.source.id).toBeInstanceOf(ReferenceExpression)
        expect(mapping1.value.source.id.elemID.getFullName()).toEqual('okta.UserType.instance.userType1')
        expect(mapping1.value.target.id).toBeInstanceOf(ReferenceExpression)
        expect(mapping1.value.target.id.elemID.getFullName()).toEqual('okta.Application.instance.app1')
      })
    })
})
