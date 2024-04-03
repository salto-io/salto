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
  ObjectType,
  ElemID,
  InstanceElement,
  BuiltinTypes,
  ReferenceExpression,
  toChange,
  getChangeData,
  Change,
  ListType,
} from '@salto-io/adapter-api'
import { SUBTYPES_PATH, TYPES_PATH } from '../../../src/elements_deprecated'
import {
  replaceInstanceTypeForDeploy,
  restoreInstanceTypeFromDeploy,
} from '../../../src/elements_deprecated/ducktype/deployment_placeholder_types'

const ADAPTER_NAME = 'myAdapter'

// copied with adjustments to deployment/placeholder_types.test.ts
describe('ducktype deployment functions', () => {
  const objType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'obj') })
  const instance = new InstanceElement('inst', objType, {
    name: 'test',
    id: 4,
    success: true,
    ref: new ReferenceExpression(new ElemID(ADAPTER_NAME, 'obj', 'instance', 'test')),
    complex: [
      {
        field1: 'test1',
        field2: 1,
        field3: [{ nested: 1 }, { nested: 2 }],
        field4: [
          { nested: 1 },
          { nested: new ReferenceExpression(new ElemID(ADAPTER_NAME, 'obj', 'instance', 'test')) },
        ],
      },
      {
        field1: 'test2',
        field2: 2,
        field3: [{ nested: 3 }],
        field4: [
          { nested: 3 },
          { nested: new ReferenceExpression(new ElemID(ADAPTER_NAME, 'obj', 'instance', 'test')) },
        ],
      },
    ],
  })
  const expectedType = new ObjectType({
    elemID: objType.elemID,
    fields: {
      name: { refType: BuiltinTypes.STRING },
      id: { refType: BuiltinTypes.NUMBER },
      success: { refType: BuiltinTypes.BOOLEAN },
      ref: { refType: BuiltinTypes.UNKNOWN },
      complex: {
        refType: new ListType(
          new ObjectType({
            elemID: new ElemID(ADAPTER_NAME, 'obj__complex'),
            fields: {
              field1: { refType: BuiltinTypes.STRING },
              field2: { refType: BuiltinTypes.NUMBER },
              field3: {
                refType: new ListType(
                  new ObjectType({
                    elemID: new ElemID(ADAPTER_NAME, 'obj__complex__field3'),
                    fields: {
                      nested: { refType: BuiltinTypes.NUMBER },
                    },
                    path: [ADAPTER_NAME, TYPES_PATH, SUBTYPES_PATH, 'obj', 'complex', 'field3'],
                  }),
                ),
              },
              field4: {
                refType: new ListType(
                  new ObjectType({
                    elemID: new ElemID(ADAPTER_NAME, 'obj__complex__field4'),
                    fields: {
                      nested: { refType: BuiltinTypes.UNKNOWN },
                    },
                    path: [ADAPTER_NAME, TYPES_PATH, SUBTYPES_PATH, 'obj', 'complex', 'field4'],
                  }),
                ),
              },
            },
            path: [ADAPTER_NAME, TYPES_PATH, SUBTYPES_PATH, 'obj', 'complex'],
          }),
        ),
      },
    },
    path: [ADAPTER_NAME, TYPES_PATH, 'obj'],
  })
  describe('replaceInstanceTypeForDeploy', () => {
    it('should generate correct type based on instance values', () => {
      const instanceForDeploy = replaceInstanceTypeForDeploy({
        instance,
        config: {
          typeDefaults: { transformation: { idFields: ['id'] } },
          types: { obj: { transformation: { idFields: ['id'] } } },
          supportedTypes: {},
        },
      })
      expect(instanceForDeploy).toBeDefined()
      expect(instanceForDeploy.refType.type).toEqual(expectedType)
    })
    it('should replace and restore correctly', () => {
      const originalType = instance.clone().refType
      const originalChanges = [toChange({ after: instance.clone() })]
      const instanceForDeploy = replaceInstanceTypeForDeploy({
        instance,
        config: {
          typeDefaults: { transformation: { idFields: ['id'] } },
          types: { obj: { transformation: { idFields: ['id'] } } },
          supportedTypes: {},
        },
      })
      expect(instanceForDeploy).toBeDefined()
      expect(instanceForDeploy.refType.type).toEqual(expectedType)
      const changes = restoreInstanceTypeFromDeploy({
        appliedChanges: [toChange({ after: instanceForDeploy.clone() })],
        originalInstanceChanges: originalChanges,
      })
      expect(changes).toHaveLength(1)
      const [change] = changes as Change<InstanceElement>[]
      expect(change.action).toEqual('add')
      expect(getChangeData(change).refType).toEqual(originalType)
    })
  })
  describe('restoreInstanceTypeFromDeploy', () => {
    it('should generate correct type based on instance values', () => {
      const originalChanges = [toChange({ after: instance.clone() })]
      const deployInstance = new InstanceElement(instance.elemID.name, expectedType, instance.value)
      const appliedChanges = [toChange({ after: deployInstance })]
      const changes = restoreInstanceTypeFromDeploy({
        appliedChanges,
        originalInstanceChanges: originalChanges,
      })
      expect(changes).toHaveLength(1)
      const [change] = changes as Change<InstanceElement>[]
      expect(change.action).toEqual('add')
      expect(getChangeData(change).refType.type).toEqual(objType)
    })
  })
})
