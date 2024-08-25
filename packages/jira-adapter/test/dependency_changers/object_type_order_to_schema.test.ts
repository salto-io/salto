/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { OBJECT_SCHEMA_TYPE, OBJECT_TYPE_ORDER_TYPE, OBJECT_TYPE_TYPE } from '../../src/constants'
import { objectTypeOrderToSchemaDependencyChanger } from '../../src/dependency_changers/object_type_order_to_schema'

describe('objectTypeOrderToSchemaDependencyChanger', () => {
  let dependencyChanges: DependencyChange[]
  let objectTypeInstance: InstanceElement
  let objectSchemaInstance: InstanceElement
  let objectTypeOrderInstance: InstanceElement
  describe('objectTypeOrderToSchemaDependencyChanger with expected changes', () => {
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
      objectTypeOrderInstance = new InstanceElement(
        'objectTypeOrderInstance',
        createEmptyType(OBJECT_TYPE_ORDER_TYPE),
        {
          objectTypes: [new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance)],
        },
        undefined,
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(objectSchemaInstance.elemID, objectSchemaInstance)],
        },
      )
    })
    it('should remove dependencies from objectTypeOrderInstance to objectSchema when they are both removal change', async () => {
      const inputChanges = new Map([
        [0, toChange({ before: objectTypeOrderInstance })],
        [1, toChange({ before: objectSchemaInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await objectTypeOrderToSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)
      expect(dependencyChanges[0].action).toEqual('remove')
      expect(dependencyChanges[0].dependency.source).toEqual(0)
      expect(dependencyChanges[0].dependency.target).toEqual(1)
    })
    it('should not remove dependencies from objectTypeOrderInstance to objectSchema when objectTypeOrderInstance is modification change', async () => {
      const objectTypeOrderInstanceAfter = objectTypeOrderInstance.clone()
      const inputChanges = new Map([
        [0, toChange({ before: objectTypeOrderInstance, after: objectTypeOrderInstanceAfter })],
        [1, toChange({ before: objectSchemaInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await objectTypeOrderToSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not remove dependencies from objectTypeOrderInstance to objectSchema when objectSchema is modification change', async () => {
      const objectSchemaInstanceAfter = objectSchemaInstance.clone()
      objectSchemaInstanceAfter.value.name = 'objectSchemaInstanceName2'
      const inputChanges = new Map([
        [0, toChange({ before: objectSchemaInstance, after: objectSchemaInstanceAfter })],
        [1, toChange({ after: objectTypeOrderInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await objectTypeOrderToSchemaDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
  })
})
