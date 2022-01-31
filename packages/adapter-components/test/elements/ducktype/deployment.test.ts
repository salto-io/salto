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
// import _ from 'lodash'
import { ObjectType, ElemID, InstanceElement, BuiltinTypes, ReferenceExpression, toChange, getChangeData, Change } from '@salto-io/adapter-api'
import { TYPES_PATH } from '../../../src/elements'
import { replaceInstanceTypeForDeploy, restoreInstanceTypeFromDeploy } from '../../../src/elements/ducktype'

/* eslint-disable camelcase */
const ADAPTER_NAME = 'myAdapter'

describe('ducktype deployment functions', () => {
  const objType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'obj') })
  const instance = new InstanceElement(
    'inst',
    objType,
    {
      name: 'test',
      id: 4,
      success: true,
      ref: new ReferenceExpression(new ElemID(ADAPTER_NAME, 'obj', 'instance', 'test')),
    },
  )
  const expectedType = new ObjectType({
    elemID: objType.elemID,
    fields: {
      name: { refType: BuiltinTypes.STRING },
      id: { refType: BuiltinTypes.NUMBER },
      success: { refType: BuiltinTypes.BOOLEAN },
      ref: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [ADAPTER_NAME, TYPES_PATH, 'obj'],
  })
  describe('replaceInstanceTypeForDeploy', () => {
    it('should generate correct type based on instance values', () => {
      const instanceForDeploy = replaceInstanceTypeForDeploy(
        instance.clone(),
        {
          typeDefaults: { transformation: { idFields: ['id'] } },
          types: { obj: { transformation: { idFields: ['id'] } } },
        }
      )
      expect(instanceForDeploy).toBeDefined()
      expect(instanceForDeploy.refType.value).toEqual(expectedType)
    })
  })
  describe('restoreInstanceTypeFromDeploy', () => {
    it('should generate correct type based on instance values', () => {
      const originalChanges = [toChange({ after: instance.clone() })]
      const deployInstance = new InstanceElement(
        instance.elemID.name,
        expectedType,
        instance.value
      )
      const appliedChanges = [toChange({ after: deployInstance })]
      const changes = restoreInstanceTypeFromDeploy(appliedChanges, originalChanges)
      expect(changes).toHaveLength(1)
      const [change] = changes as Change<InstanceElement>[]
      expect(change.action).toEqual('add')
      expect(getChangeData(change).refType.value).toEqual(objType)
    })
  })
})
