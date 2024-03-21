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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { DeployApiDefinitions } from '../../../src/definitions/system/deploy'
import {
  getChangeGroupIdFromDefinition,
  groupByType,
  groupWithFirstParent,
  selfGroup,
} from '../../../src/deployment/grouping/functions'

describe('grouping functions', () => {
  let type: ObjectType
  let instance: InstanceElement

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        creatable: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: true,
            [CORE_ANNOTATIONS.UPDATABLE]: false,
          },
        },

        updatable: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: false,
            [CORE_ANNOTATIONS.UPDATABLE]: true,
          },
        },
      },
      annotations: {
        [CORE_ANNOTATIONS.PARENT]: [
          new ReferenceExpression(new ElemID('adapter', 'parentType')),
          new ReferenceExpression(new ElemID('adapter', 'parentType2')),
        ],
      },
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        creatable: 'aaa',
        updatable: 'bbb',
        other: 'ccc',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(new ElemID('adapter', 'type', 'instance', 'parent'))],
      },
    )
  })

  describe('selfGroup', () => {
    it('should use full elem id as group name', async () => {
      expect(await selfGroup(toChange({ before: instance }))).toEqual(instance.elemID.getFullName())
      expect(await selfGroup(toChange({ after: instance }))).toEqual(instance.elemID.getFullName())
      expect(await selfGroup(toChange({ before: instance, after: instance }))).toEqual(instance.elemID.getFullName())
      expect(await selfGroup(toChange({ after: type }))).toEqual(type.elemID.getFullName())
    })
  })

  describe('groupByType', () => {
    it('should use type name as group name', async () => {
      expect(await groupByType(toChange({ before: instance }))).toEqual(instance.elemID.typeName)
      expect(await groupByType(toChange({ after: instance }))).toEqual(instance.elemID.typeName)
      expect(await groupByType(toChange({ before: instance, after: instance }))).toEqual(instance.elemID.typeName)
      expect(await groupByType(toChange({ after: type }))).toEqual(type.elemID.typeName)
    })

    describe('groupWithFirstParent', () => {
      it('should group with first parent when available', async () => {
        expect(await groupWithFirstParent(toChange({ before: instance }))).toEqual('adapter.type.instance.parent')
        expect(await groupWithFirstParent(toChange({ after: instance }))).toEqual('adapter.type.instance.parent')
        expect(await groupWithFirstParent(toChange({ before: instance, after: instance }))).toEqual(
          'adapter.type.instance.parent',
        )
        expect(await groupWithFirstParent(toChange({ after: type }))).toEqual('adapter.parentType')
      })
      it('should return undefined when no parent is available', async () => {
        instance.annotations[CORE_ANNOTATIONS.PARENT] = undefined
        type.annotations[CORE_ANNOTATIONS.PARENT] = undefined
        expect(await groupWithFirstParent(toChange({ before: instance }))).toBeUndefined()
        expect(await groupWithFirstParent(toChange({ after: instance }))).toBeUndefined()
        expect(await groupWithFirstParent(toChange({ before: instance, after: instance }))).toBeUndefined()
        expect(await groupWithFirstParent(toChange({ after: type }))).toBeUndefined()
      })
      it('should return undefined and not throw when parent is invalud', async () => {
        instance.annotations[CORE_ANNOTATIONS.PARENT] = 'abc'
        expect(await groupWithFirstParent(toChange({ after: instance }))).toBeUndefined()
      })
    })
  })

  describe('getChangeGroupIdFromDefinition', () => {
    let deployDef: DeployApiDefinitions<'activate' | 'deactivate', 'main'>
    beforeEach(() => {
      deployDef = {
        instances: {
          default: {
            changeGroupId: () => 'DEFAULT_GROUP',
          },
          customizations: {
            A: {
              requestsByAction: {
                customizations: {},
              },
              changeGroupId: selfGroup,
            },
            B: {
              requestsByAction: {
                customizations: {},
              },
              changeGroupId: groupByType,
            },
          },
        },
      }
    })

    it('should choose grouping function based on definition', async () => {
      const instanceA = new InstanceElement('inst', new ObjectType({ elemID: new ElemID('adapter', 'A') }))
      const instanceB = new InstanceElement('inst', new ObjectType({ elemID: new ElemID('adapter', 'B') }))
      const instanceC = new InstanceElement('inst', new ObjectType({ elemID: new ElemID('adapter', 'C') }))

      const groupingFunc = getChangeGroupIdFromDefinition(deployDef.instances)
      expect(await groupingFunc(toChange({ before: instanceA }))).toEqual('adapter.A.instance.inst')
      expect(await groupingFunc(toChange({ before: instanceB }))).toEqual('B')
      expect(await groupingFunc(toChange({ before: instanceC }))).toEqual('DEFAULT_GROUP')
    })
  })
})
