/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { role } from '../../src/types/custom_types/role'
import filterCreator from '../../src/filters/roles_internal_id'
import NetsuiteClient from '../../src/client/client'
import { FilterOpts } from '../../src/filter'

describe('roles_internal_ids', () => {
  describe('on fetch', () => {
    it('should add the internal id to roles instances', async () => {
      const instance = new InstanceElement(
        'role',
        role,
        { scriptid: 'scriptid' },
      )

      const client = {
        runSuiteQL: () => Promise.resolve([{ id: '1', scriptid: 'scriptid' }]),
        isSuiteAppConfigured: () => true,
      } as unknown as NetsuiteClient

      await filterCreator({ client } as FilterOpts).onFetch?.([instance])
      expect(instance.value.internalId).toBe('1')
    })

    it('should do nothing if suiteapp is not configured', async () => {
      const instance = new InstanceElement(
        'role',
        role,
        { scriptid: 'scriptid' },
      )

      const client = {
        runSuiteQL: () => Promise.resolve([{ id: '1', scriptid: 'scriptid' }]),
        isSuiteAppConfigured: () => false,
      } as unknown as NetsuiteClient

      await filterCreator({ client } as FilterOpts).onFetch?.([instance])
      expect(instance.value.internalId).toBeUndefined()
    })

    it('should do nothing if query failed', async () => {
      const instance = new InstanceElement(
        'role',
        role,
        { scriptid: 'scriptid' },
      )

      const client = {
        runSuiteQL: () => Promise.resolve(undefined),
        isSuiteAppConfigured: () => true,
      } as unknown as NetsuiteClient

      await filterCreator({ client } as FilterOpts).onFetch?.([instance])
      expect(instance.value.internalId).toBeUndefined()
    })

    it('should do nothing if got invalid results', async () => {
      const instance = new InstanceElement(
        'role',
        role,
        { scriptid: 'scriptid' },
      )

      const client = {
        runSuiteQL: () => Promise.resolve([{}]),
        isSuiteAppConfigured: () => true,
      } as unknown as NetsuiteClient

      await filterCreator({ client } as FilterOpts).onFetch?.([instance])
      expect(instance.value.internalId).toBeUndefined()
    })
  })

  it('preDeploy should remove the internal id to roles instances', async () => {
    const instance = new InstanceElement(
      'role',
      role,
      { internalId: '1' },
    )

    const client = {
    } as unknown as NetsuiteClient

    await filterCreator({ client } as FilterOpts).preDeploy?.(
      [toChange({ after: instance })],
    )
    expect(instance.value.internalId).toBeUndefined()
  })

  describe('onDeploy', () => {
    it('onDeploy should add the internal id to new roles instances', async () => {
      const instance = new InstanceElement(
        'role',
        role,
        { scriptid: 'scriptid' },
      )

      const client = {
        runSuiteQL: () => Promise.resolve([{ id: '1', scriptid: 'scriptid' }]),
        isSuiteAppConfigured: () => true,
      } as unknown as NetsuiteClient

      await filterCreator({ client } as FilterOpts).onDeploy?.(
        [toChange({ after: instance })],
        {
          appliedChanges: [],
          errors: [],
        },
      )
      expect(instance.value.internalId).toBe('1')
    })

    it('should do nothing if suiteapp is not configured', async () => {
      const instance = new InstanceElement(
        'role',
        role,
        { scriptid: 'scriptid' },
      )

      const client = {
        runSuiteQL: () => Promise.resolve([{ id: '1', scriptid: 'scriptid' }]),
        isSuiteAppConfigured: () => false,
      } as unknown as NetsuiteClient

      await filterCreator({ client } as FilterOpts).onDeploy?.(
        [toChange({ after: instance })],
        {
          appliedChanges: [],
          errors: [],
        },
      )
      expect(instance.value.internalId).toBeUndefined()
    })
  })
})
