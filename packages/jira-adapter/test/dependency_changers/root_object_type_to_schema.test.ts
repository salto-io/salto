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
  InstanceElement,
  toChange,
  DependencyChange,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { createEmptyType } from '../utils'
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE } from '../../src/constants'
import { rootObjectTypeToObjectSchemaDependencyChanger } from '../../src/dependency_changers/root_object_type_to_schema'

describe('rootObjectTypeToObjectSchemaDependencyChanger', () => {
  let dependencyChanges: DependencyChange[]
  let objectTypeInstance: InstanceElement
  let objectSchemaInstance: InstanceElement
  describe('rootObjectTypeToObjectSchemaDependencyChanger with expected changes', () => {
    beforeEach(async () => {
      objectSchemaInstance = new InstanceElement('objectSchemaInstance', createEmptyType(OBJECT_SCHEMA_TYPE), {
        id: '0',
        name: 'objectSchemaInstanceName',
      })
      objectTypeInstance = new InstanceElement(
        'objectTypeInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          id: '1',
          name: 'objectTypeInstanceName',
          parentObjectTypeId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance)],
        },
      )
    })
    it('should remove dependencies from root objectType to objectSchema when they are both removal change', async () => {
      objectTypeInstance.value.parentObjectTypeId = new ReferenceExpression(
        objectSchemaInstance.elemID,
        objectSchemaInstance,
      )
      const inputChanges = new Map([
        [0, toChange({ before: objectTypeInstance })],
        [1, toChange({ before: objectSchemaInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await rootObjectTypeToObjectSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)
      expect(dependencyChanges[0].action).toEqual('remove')
      expect(dependencyChanges[0].dependency.source).toEqual(0)
      expect(dependencyChanges[0].dependency.target).toEqual(1)
    })
    it('should not remove dependencies from root objectType to objectSchema when objetType is modification change', async () => {
      const objectTypeInstanceAfter = objectTypeInstance.clone()
      objectTypeInstanceAfter.value.name = 'objectTypeInstanceName2'
      const inputChanges = new Map([
        [0, toChange({ before: objectTypeInstance, after: objectTypeInstanceAfter })],
        [1, toChange({ before: objectSchemaInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await rootObjectTypeToObjectSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not remove dependencies from root objectType to objectSchema when objectSchema is modification change', async () => {
      const objectSchemaInstanceAfter = objectSchemaInstance.clone()
      objectSchemaInstanceAfter.value.name = 'objectSchemaInstanceName2'
      const inputChanges = new Map([
        [0, toChange({ before: objectSchemaInstance, after: objectSchemaInstanceAfter })],
        [1, toChange({ after: objectTypeInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await rootObjectTypeToObjectSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not remove dependencies from objectType to objectSchema when objectType is not root', async () => {
      const childObjectTtpyeInstance = objectTypeInstance.clone()
      childObjectTtpyeInstance.value.parentObjectTypeId = new ReferenceExpression(
        objectTypeInstance.elemID,
        objectTypeInstance,
      )
      const inputChanges = new Map([
        [0, toChange({ before: childObjectTtpyeInstance })],
        [1, toChange({ before: objectSchemaInstance })],
        [2, toChange({ before: objectTypeInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await rootObjectTypeToObjectSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)
      expect(dependencyChanges[0].action).toEqual('remove')
      expect(dependencyChanges[0].dependency.source).toEqual(2)
      expect(dependencyChanges[0].dependency.target).toEqual(1)
    })
  })
  describe('rootObjectTypeToObjectSchemaDependencyChanger with unexpected changes', () => {
    beforeEach(async () => {
      objectSchemaInstance = new InstanceElement('objectSchemaInstance', createEmptyType(OBJECT_SCHEMA_TYPE), {
        id: '0',
        name: 'objectSchemaInstanceName',
      })
      objectTypeInstance = new InstanceElement(
        'objectTypeInstance',
        createEmptyType(OBJECT_TYPE_TYPE),
        {
          id: '1',
          name: 'objectTypeInstanceName',
          parentObjectTypeId: new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance),
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance)],
        },
      )
    })
    it('should not remove dependencies from root objectType to objectSchema when no parentObjectTypeId is defined', async () => {
      delete objectTypeInstance.value.parentObjectTypeId
      const inputChanges = new Map([
        [0, toChange({ before: objectTypeInstance })],
        [1, toChange({ before: objectSchemaInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await rootObjectTypeToObjectSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
  })
})
