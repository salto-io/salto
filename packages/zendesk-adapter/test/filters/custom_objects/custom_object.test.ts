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
import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../../src/filters/custom_objects/custom_object'
import { createFilterCreatorParams } from '../../utils'
import { CUSTOM_OBJECT_TYPE_NAME, ZENDESK } from '../../../src/constants'

type FilterType = filterUtils.FilterWith<'preDeploy' | 'onDeploy'>

const createCustomObjectInstance = (): InstanceElement =>
  new InstanceElement('customObject', new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_TYPE_NAME) }), {
    raw_title: 'raw_title',
    raw_title_pluralized: 'raw_title_pluralized',
    raw_description: 'raw_description',
  })

describe('customObjectFilter', () => {
  const customObjectFilter = filterCreator(createFilterCreatorParams({})) as FilterType
  it('should copy raw fields into regular field on preDeploy', async () => {
    const customObject = createCustomObjectInstance()
    await customObjectFilter.preDeploy([toChange({ before: customObject, after: customObject })])

    expect(customObject.value.title).toBe(customObject.value.raw_title)
    expect(customObject.value.title_pluralized).toBe(customObject.value.raw_title_pluralized)
    expect(customObject.value.description).toBe(customObject.value.raw_description)
  })
  it('should remove raw fields on onDeploy', async () => {
    const customObject = createCustomObjectInstance()
    await customObjectFilter.preDeploy([toChange({ before: customObject, after: customObject })])
    await customObjectFilter.onDeploy([toChange({ before: customObject, after: customObject })])

    expect(customObject.value.title).toBeUndefined()
    expect(customObject.value.title_pluralized).toBeUndefined()
    expect(customObject.value.description).toBeUndefined()
  })
})
