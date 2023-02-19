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
import { BuiltinTypes, Change, ElemID, Field, getChangeData, InstanceElement, isInstanceChange, isObjectTypeChange, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { FilterOpts } from '../../src/filter'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/additional_changes'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'

const noParams = { config: { deploy: {} } } as FilterOpts

describe('additional changes filter', () => {
  let customRecordType: ObjectType
  let customSegmentInstance: InstanceElement
  beforeEach(() => {
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        custom_field: { refType: BuiltinTypes.STRING },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    customSegmentInstance = new InstanceElement('cseg1', customsegmentType().type)
  })
  describe('field changes', () => {
    it('should add field parent', async () => {
      const changes: Change[] = [
        toChange({ after: customRecordType.fields.custom_field }),
      ]
      await filterCreator(noParams).preDeploy?.(changes)
      expect(changes).toHaveLength(2)
      const [parentChange] = changes.filter(isObjectTypeChange)
      expect(parentChange.action).toEqual('modify')
      expect(getChangeData(parentChange)).toBe(customRecordType)
    })
    it('should add field parent one time if there are multiple fields', async () => {
      customRecordType.fields.custom_new_field = new Field(customRecordType, 'custom_new_field', BuiltinTypes.BOOLEAN)
      const changes: Change[] = [
        toChange({ after: customRecordType.fields.custom_field }),
        toChange({ after: customRecordType.fields.custom_new_field }),
      ]
      await filterCreator(noParams).preDeploy?.(changes)
      expect(changes).toHaveLength(3)
      const parentChanges = changes.filter(isObjectTypeChange)
      expect(parentChanges).toHaveLength(1)
      expect(parentChanges[0].action).toEqual('modify')
      expect(getChangeData(parentChanges[0])).toBe(customRecordType)
    })
    it('should not add field parent if it\'s in changes', async () => {
      const changes: Change[] = [
        toChange({ after: customRecordType }),
        toChange({ after: customRecordType.fields.custom_field }),
      ]
      await filterCreator(noParams).preDeploy?.(changes)
      expect(changes).toHaveLength(2)
      const [parentChange] = changes.filter(isObjectTypeChange)
      expect(parentChange.action).toEqual('add')
    })
    it('should not add field parent if field is deleted', async () => {
      const changes: Change[] = [
        toChange({ before: customRecordType.fields.custom_field }),
      ]
      await filterCreator(noParams).preDeploy?.(changes)
      expect(changes).toHaveLength(1)
      expect(getChangeData(changes[0])).toBe(customRecordType.fields.custom_field)
    })
  })
  describe('required referenced elements', () => {
    beforeEach(() => {
      customRecordType.annotate({
        customsegment: new ReferenceExpression(customSegmentInstance.elemID, 'cseg1', customSegmentInstance),
      })
    })
    it('should add required referenced element', async () => {
      const changes: Change[] = [
        toChange({ after: customRecordType }),
      ]
      await filterCreator(noParams).preDeploy?.(changes)
      expect(changes).toHaveLength(2)
      const [requiredInstanceChange] = changes.filter(isInstanceChange)
      expect(requiredInstanceChange.action).toEqual('modify')
      expect(getChangeData(requiredInstanceChange)).toEqual(customSegmentInstance)
    })
    it('should add field parent and required referenced element', async () => {
      const changes: Change[] = [
        toChange({ after: customRecordType.fields.custom_field }),
      ]
      await filterCreator(noParams).preDeploy?.(changes)
      expect(changes).toHaveLength(3)
      expect(changes.map(getChangeData)).toEqual(expect.arrayContaining([
        customRecordType,
        customRecordType.fields.custom_field,
        customSegmentInstance,
      ]))
    })
    it('should not add required referenced element if it\'s in changes', async () => {
      const changes: Change[] = [
        toChange({ after: customRecordType }),
        toChange({ after: customSegmentInstance }),
      ]
      await filterCreator(noParams).preDeploy?.(changes)
      expect(changes).toHaveLength(2)
      const [requiredInstanceChange] = changes.filter(isInstanceChange)
      expect(requiredInstanceChange.action).toEqual('add')
      expect(getChangeData(requiredInstanceChange)).toBe(customSegmentInstance)
    })
  })
})
