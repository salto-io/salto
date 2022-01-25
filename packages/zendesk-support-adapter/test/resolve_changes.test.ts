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
import { BuiltinTypes, ElemID, getChangeData, InstanceElement, ListType, ObjectType,
  ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { references as referencesUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { fieldNameToTypeMappingDefs, ZendeskSupportFieldReferenceResolver } from '../src/filters/field_references'
import { ZENDESK_SUPPORT } from '../src/constants'

const { awu } = collections.asynciterable

describe('resolveChanges', () => {
  it('should resolve changes correctly for dynamic content item', async () => {
    const localeType = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, 'locale'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        locale: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        default: { refType: BuiltinTypes.BOOLEAN },
      },
    })
    const variantType = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, 'dynamic_content_item__variants'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        content: { refType: BuiltinTypes.STRING },
        locale_id: { refType: BuiltinTypes.NUMBER },
        default: { refType: BuiltinTypes.BOOLEAN },
      },
    })
    const dynamicContentItemType = new ObjectType({
      elemID: new ElemID(ZENDESK_SUPPORT, 'dynamic_content_item'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        name: { refType: BuiltinTypes.STRING },
        default_locale_id: { refType: BuiltinTypes.NUMBER },
        variants: { refType: new ListType(variantType) },
      },
    })
    const english = new InstanceElement('En', localeType, { id: 1 })
    const variant1 = new InstanceElement(
      'variant1',
      variantType,
      {
        id: 2001,
        content: 'abc',
        locale_id: new ReferenceExpression(english.elemID, english),
        default: true,
      },
    )
    const item1 = new InstanceElement('item1', dynamicContentItemType, {
      id: 1001,
      name: 'item1',
      default_locale_id: new ReferenceExpression(english.elemID, english),
      variants: [
        new ReferenceExpression(variant1.elemID, variant1),
      ],
    })
    const lookupFunc = referencesUtils.generateLookupFunc(
      fieldNameToTypeMappingDefs,
      defs => new ZendeskSupportFieldReferenceResolver(defs)
    )
    const resolvedChanges = await awu([toChange({ after: item1 })])
      .map(change => resolveChangeElement(change, lookupFunc))
      .toArray()
    expect(resolvedChanges).toHaveLength(1)
    expect(getChangeData(resolvedChanges[0]).value).toEqual({
      id: 1001,
      name: 'item1',
      default_locale_id: 1,
      variants: [1],
    })
  })
})
