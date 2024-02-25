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
import {
  ElemID,
  ObjectType,
  toChange,
  InstanceElement,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import cpqChangeValidator from '../../src/change_validators/cpq_trigger'
import { CUSTOM_OBJECT } from '../../src/constants'

describe('cpq trigger change validator', () => {
  const objCpq = new ObjectType({
    elemID: new ElemID('salesforce', 'SBQQ__ProductRule__c'),
    annotations: {
      metadataType: CUSTOM_OBJECT,
      apiName: 'SBQQ__ProductRule__c',
    },
    fields: {
      newField: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const before = new InstanceElement('myInst', objCpq)
  const after = new InstanceElement('myInst', objCpq, { newField: 'newValue' })
  describe('onUpdate', () => {
    it('should have error when cpq element has been modified', async () => {
      const changeErrors = await cpqChangeValidator([
        toChange({ before, after }),
      ])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(before.elemID)
      expect(changeError.severity).toEqual('Info')
      expect(changeError.deployActions).toBeDefined()
    })

    it('should have error when cpq element has been deleted', async () => {
      const changeErrors = await cpqChangeValidator([
        toChange({ before, after: undefined }),
      ])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(before.elemID)
      expect(changeError.severity).toEqual('Info')
      expect(changeError.deployActions).toBeDefined()
    })

    it('should have error when cpq element has been created', async () => {
      const changeErrors = await cpqChangeValidator([
        toChange({ before: undefined, after }),
      ])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.elemID).toEqual(after.elemID)
      expect(changeError.severity).toEqual('Info')
      expect(changeError.deployActions).toBeDefined()
    })
    it('should have no error when instance element is not instance of cpq namespace', async () => {
      const objNOTcpq = new ObjectType({
        elemID: new ElemID('salesforce', 'NOTcpqElement'),
        annotations: { metadataType: CUSTOM_OBJECT, apiName: 'NOTcpqElement' },
        fields: {
          newField: {
            refType: BuiltinTypes.STRING,
          },
        },
      })
      const beforeNOTcpq = new InstanceElement('myInst', objNOTcpq)
      const afterNOTcpq = new InstanceElement('myInst', objNOTcpq, {
        newField: 'newField',
      })
      const changeErrors = await cpqChangeValidator([
        toChange({ before: beforeNOTcpq, after: afterNOTcpq }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have a single error when there are many cpq related changes', async () => {
      const anotherBefore = before.clone()
      const anotherAfter = after.clone()
      const changeErrors = await cpqChangeValidator([
        toChange({ before, after }),
        toChange({ before: anotherBefore, after: anotherAfter }),
      ])
      expect(changeErrors).toHaveLength(1)
    })
  })
})
