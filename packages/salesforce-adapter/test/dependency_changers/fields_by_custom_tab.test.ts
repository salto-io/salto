/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { InstanceElement, ObjectType, ElemID, INSTANCE_ANNOTATIONS, ReferenceExpression, BuiltinTypes, ChangeDataType, Change, ChangeId, ChangeEntry, DependencyChange, dependencyChange } from '@salto-io/adapter-api'
import { fieldsByCustomTab, FIELDS_CREATED_BY_CUSTOM_TAB } from '../../src/dependency_changers/fields_by_custom_tab'
import { SALESFORCE, CUSTOM_TAB_METADATA_TYPE, METADATA_TYPE } from '../../src/constants'

describe('fields_by_custom_tab dependency changer', () => {
  const toChange = (action: 'add' | 'remove', data: ChangeDataType): Change => (
    action === 'add'
      ? { action, data: { after: data } }
      : { action, data: { before: data } }
  )

  const customTabType = new ObjectType({
    elemID: new ElemID(SALESFORCE, CUSTOM_TAB_METADATA_TYPE),
    annotations: { [METADATA_TYPE]: CUSTOM_TAB_METADATA_TYPE },
  })
  const testTypeId = new ElemID(SALESFORCE, 'Test')
  const testType = new ObjectType({
    elemID: testTypeId,
    fields: FIELDS_CREATED_BY_CUSTOM_TAB.map(name => ({ name, type: BuiltinTypes.STRING })),
  })
  let tabInstance: InstanceElement

  const createChanges = (action: 'add' | 'remove'): Map<ChangeId, Change> => {
    const fieldAdditions = FIELDS_CREATED_BY_CUSTOM_TAB
      .map((field, idx): ChangeEntry => [idx, toChange(action, testType.fields[field])])
    return new Map([
      ...fieldAdditions,
      [fieldAdditions.length, toChange(action, tabInstance)],
    ])
  }

  beforeAll(() => {
    tabInstance = new InstanceElement(
      'TestObj',
      customTabType,
      {},
      undefined,
      { [INSTANCE_ANNOTATIONS.PARENT]: [new ReferenceExpression(testType.elemID)] },
    )
  })

  describe('when custom tab and relevant fields are being added', () => {
    let depChanges: DependencyChange[]
    beforeAll(async () => {
      depChanges = [...await fieldsByCustomTab(createChanges('add'), new Map())]
    })
    it('should add dependency from fields to custom tab', () => {
      _.times(FIELDS_CREATED_BY_CUSTOM_TAB.length).forEach(i => {
        expect(depChanges).toContainEqual(
          dependencyChange('add', i, FIELDS_CREATED_BY_CUSTOM_TAB.length)
        )
      })
    })
  })
  describe('when custom tab and relevant fields are being removed', () => {
    let depChanges: DependencyChange[]
    beforeAll(async () => {
      depChanges = [...await fieldsByCustomTab(createChanges('remove'), new Map())]
    })
    it('should not change dependencies', () => {
      expect(depChanges).toHaveLength(0)
    })
  })
  describe('when custom tab has no parent', () => {
    let depChanges: DependencyChange[]
    beforeAll(async () => {
      delete tabInstance.annotations[INSTANCE_ANNOTATIONS.PARENT]
      depChanges = [...await fieldsByCustomTab(createChanges('add'), new Map())]
    })
    it('should not change dependencies', () => {
      expect(depChanges).toHaveLength(0)
    })
  })
})
