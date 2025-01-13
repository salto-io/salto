/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  getChangeData,
  isModificationChange,
  toChange,
} from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import { createChangesForSubResources } from '../../../src/deployment/deploy/subresources'
import { ApiDefinitions } from '../../../src/definitions'
import { noPagination } from '../../../src/fetch/request/pagination'
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../../src/client'

describe('createChangesForSubResources', () => {
  let instance: InstanceElement
  let typeB: ObjectType
  let typeA: ObjectType
  let definitions: types.PickyRequired<ApiDefinitions, 'deploy'>
  let client: MockInterface<HTTPReadClientInterface & HTTPWriteClientInterface>

  beforeEach(() => {
    jest.clearAllMocks()
    typeB = new ObjectType({ elemID: new ElemID('adapter', 'typeB') })
    typeA = new ObjectType({
      elemID: new ElemID('adapter', 'typeA'),
      fields: {
        items: {
          refType: new ListType(typeB),
        },
      },
    })
    instance = new InstanceElement('instance', typeA, {
      name: 'the change',
      items: [
        { name: 'name', role: 'role' },
        { name: 'name', role: 'role2' },
      ],
    })
    definitions = {
      deploy: {
        instances: {
          customizations: {
            typeA: {
              requestsByAction: {
                customizations: {
                  add: [
                    {
                      request: { endpoint: { path: '/change', method: 'post' } },
                    },
                  ],
                  modify: [
                    {
                      request: { endpoint: { path: '/change/{id}', method: 'put' } },
                    },
                  ],
                  remove: [
                    {
                      request: { endpoint: { path: '/change/{id}', method: 'delete' } },
                    },
                  ],
                },
              },
              recurseIntoPath: [
                {
                  typeName: 'typeB',
                  fieldPath: ['items'],
                  changeIdFields: ['name', 'role'],
                  condition: {
                    skipIfIdentical: true,
                  },
                },
              ],
            },
            typeB: {
              requestsByAction: {
                customizations: {
                  add: [
                    {
                      request: { endpoint: { path: '/subresource', method: 'post' } },
                    },
                  ],
                  modify: [
                    {
                      request: { endpoint: { path: '/subresource/{id}', method: 'put' } },
                    },
                  ],
                  remove: [
                    {
                      request: { endpoint: { path: '/subresource/{id}', method: 'delete' } },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      clients: {
        default: 'main',
        options: {
          main: {
            httpClient: client,
            endpoints: {
              default: {
                get: {
                  readonly: true,
                },
              },
              customizations: {},
            },
          },
        },
      },
      pagination: {
        none: {
          funcCreator: noPagination,
        },
      },
    }
  })

  describe('creating changes for subresources', () => {
    describe('addition changes', () => {
      it('should create the correct changes for subresources', async () => {
        const change = toChange({ after: instance })
        const subChanges = await createChangesForSubResources({
          change,
          definitions,
          context: {
            changeGroup: { groupID: 'testGroup', changes: [change] },
            elementSource: buildElementsSourceFromElements([]),
            sharedContext: {},
          },
        })
        expect(subChanges).toHaveLength(2)
        expect(subChanges.map(c => c.action)).toEqual(['add', 'add'])
        expect(subChanges.map(c => getChangeData(c).value)).toEqual([
          { name: 'name', role: 'role' },
          { name: 'name', role: 'role2' },
        ])
        expect(subChanges.map(c => getChangeData(c).annotations[CORE_ANNOTATIONS.PARENT][0])).toEqual([
          new ReferenceExpression(getChangeData(change).elemID, getChangeData(change).value),
          new ReferenceExpression(getChangeData(change).elemID, getChangeData(change).value),
        ])
        expect(subChanges.map(c => getChangeData(c).refType.type)).toEqual([typeB, typeB])
      })
    })
    describe('modification changes', () => {
      it('should create the correct changes for subresources', async () => {
        const afterInst = new InstanceElement('after', typeA, {
          name: 'the change',
          items: [
            { name: 'name', role: 'role', prop: 'modified' },
            { name: 'name', role: 'role3' },
          ],
        })
        const change = toChange({ before: instance, after: afterInst })
        const subChanges = (
          await createChangesForSubResources({
            change,
            definitions,
            context: {
              changeGroup: { groupID: 'testGroup', changes: [change] },
              elementSource: buildElementsSourceFromElements([]),
              sharedContext: {},
            },
          })
        ).sort((a, b) => a.action.localeCompare(b.action)) // sort changes by action
        expect(subChanges).toHaveLength(3)
        expect(subChanges.map(c => c.action)).toEqual(['add', 'modify', 'remove'])
        expect(subChanges.map(c => getChangeData(c).value)).toEqual([
          { name: 'name', role: 'role3' },
          { name: 'name', role: 'role', prop: 'modified' },
          { name: 'name', role: 'role2' },
        ])
        expect(subChanges.map(c => getChangeData(c).annotations[CORE_ANNOTATIONS.PARENT][0])).toEqual([
          new ReferenceExpression(getChangeData(change).elemID, getChangeData(change).value),
          new ReferenceExpression(getChangeData(change).elemID, getChangeData(change).value),
          new ReferenceExpression(getChangeData(change).elemID, getChangeData(change).value),
        ])
        expect(subChanges.map(c => getChangeData(c).refType.type)).toEqual([typeB, typeB, typeB])
      })
    })
    describe('removal changes', () => {
      it('should create the correct changes for subresources', async () => {
        const change = toChange({ before: instance })
        const subChanges = await createChangesForSubResources({
          change,
          definitions,
          context: {
            changeGroup: { groupID: 'testGroup', changes: [change] },
            elementSource: buildElementsSourceFromElements([]),
            sharedContext: {},
          },
        })
        expect(subChanges).toHaveLength(2)
        expect(subChanges.map(c => c.action)).toEqual(['remove', 'remove'])
        expect(subChanges.map(c => getChangeData(c).value)).toEqual([
          { name: 'name', role: 'role' },
          { name: 'name', role: 'role2' },
        ])
        expect(subChanges.map(c => getChangeData(c).annotations[CORE_ANNOTATIONS.PARENT][0])).toEqual([
          new ReferenceExpression(getChangeData(change).elemID, getChangeData(change).value),
          new ReferenceExpression(getChangeData(change).elemID, getChangeData(change).value),
        ])
        expect(subChanges.map(c => getChangeData(c).refType.type)).toEqual([typeB, typeB])
      })
    })
  })

  describe('with a condition', () => {
    describe('skipIfIdentical', () => {
      it('should not create changes for subresources if the condition is not met', async () => {
        const afterInstance = instance.clone()
        afterInstance.value.type = 'update'
        const change = toChange({ before: instance, after: afterInstance })
        const subChanges = await createChangesForSubResources({
          change,
          definitions,
          context: {
            changeGroup: { groupID: 'testGroup', changes: [change] },
            elementSource: buildElementsSourceFromElements([]),
            sharedContext: {},
          },
        })
        expect(subChanges).toHaveLength(0)
      })
    })
  })
  describe('custom condition', () => {
    it('should not create changes for subresources if the condition is not met', async () => {
      if (!definitions.deploy.instances.customizations?.typeA?.recurseIntoPath?.[0]) {
        return
      }
      definitions.deploy.instances.customizations.typeA.recurseIntoPath[0].condition = {
        custom:
          () =>
          ({ change }) =>
            isModificationChange(change) &&
            change.data.after?.value?.items?.length !== change.data.before?.value?.items?.length,
      }

      const afterInstance = instance.clone()
      afterInstance.value.items = [
        { name: 'name', role: 'role' },
        { name: 'name', role: 'change' },
      ]
      const change = toChange({ before: instance, after: afterInstance })
      const subChanges = await createChangesForSubResources({
        change,
        definitions,
        context: {
          changeGroup: { groupID: 'testGroup', changes: [change] },
          elementSource: buildElementsSourceFromElements([]),
          sharedContext: {},
        },
      })
      expect(subChanges).toHaveLength(0)
    })
  })
  describe('with specific actions provided', () => {
    beforeEach(() => {
      if (!definitions.deploy.instances.customizations?.typeA?.recurseIntoPath?.[0]) {
        return
      }
      definitions.deploy.instances.customizations.typeA.recurseIntoPath[0].onActions = ['modify']
    })
    it('should create changes for the provided actions', async () => {
      const afterInstance = instance.clone()
      afterInstance.value.items = [
        { name: 'name', role: 'role' },
        { name: 'name', role: 'change' },
      ]
      const change = toChange({ before: instance, after: afterInstance })
      const subChanges = await createChangesForSubResources({
        change,
        definitions,
        context: {
          changeGroup: { groupID: 'testGroup', changes: [change] },
          elementSource: buildElementsSourceFromElements([]),
          sharedContext: {},
        },
      })
      expect(subChanges).toHaveLength(2)
      expect(subChanges.map(c => c.action)).toEqual(['add', 'remove'])
    })
    it('should not create changes for other actions', async () => {
      const change = toChange({ after: instance })
      const subChanges = await createChangesForSubResources({
        change,
        definitions,
        context: {
          changeGroup: { groupID: 'testGroup', changes: [change] },
          elementSource: buildElementsSourceFromElements([]),
          sharedContext: {},
        },
      })
      expect(subChanges).toHaveLength(0)
    })
  })
  describe('when change id fields are pointing a reference that is not yet resolved', () => {
    it('should user reference getFullName as the field value', async () => {
      const roleType = new ObjectType({ elemID: new ElemID('adapter', 'role') })
      const role1 = new InstanceElement('role1', roleType, { name: 'role1' })
      const role2 = new InstanceElement('role2', roleType, { name: 'role2' })
      const afterInstance = instance.clone()
      afterInstance.value.items = [
        { name: 'name', role: new ReferenceExpression(role1.elemID, role1) },
        { name: 'name', role: new ReferenceExpression(role2.elemID, role2) },
      ]
      const change = toChange({ after: afterInstance })
      const subChanges = await createChangesForSubResources({
        change,
        definitions,
        context: {
          changeGroup: { groupID: 'testGroup', changes: [change] },
          elementSource: buildElementsSourceFromElements([]),
          sharedContext: {},
        },
      })
      expect(subChanges).toHaveLength(2)
      expect(subChanges.map(c => c.action)).toEqual(['add', 'add'])
      expect(subChanges.map(c => getChangeData(c).elemID.name)).toEqual([
        'name_adapter.role.instance.role1',
        'name_adapter.role.instance.role2',
      ])
      expect(subChanges.map(c => getChangeData(c).value)).toEqual([
        { name: 'name', role: new ReferenceExpression(role1.elemID, role1) },
        { name: 'name', role: new ReferenceExpression(role2.elemID, role2) },
      ])
    })
  })
})
