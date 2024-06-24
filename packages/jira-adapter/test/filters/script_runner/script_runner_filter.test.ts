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
import { filterUtils } from '@salto-io/adapter-components'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import scriptRunnerFilter from '../../../src/filters/script_runner/script_runner_filter'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import {
  JIRA,
  SCRIPTED_FIELD_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
  SCRIPT_RUNNER_SETTINGS_TYPE,
} from '../../../src/constants'
import * as users from '../../../src/users'

type FilterType = filterUtils.FilterWith<'preDeploy' | 'onFetch'>

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('my-uuid'),
}))

describe('script_runner_filter', () => {
  let filter: FilterType
  let auditInstance: InstanceElement
  let listenerInstance: InstanceElement
  let fragmentInstance: InstanceElement
  beforeEach(() => {
    auditInstance = new InstanceElement('instance', createEmptyType(SCRIPTED_FIELD_TYPE), {})
    listenerInstance = new InstanceElement('instance', createEmptyType(SCRIPT_RUNNER_LISTENER_TYPE), {})
    fragmentInstance = new InstanceElement('instance', createEmptyType(SCRIPT_FRAGMENT_TYPE), {})
  })
  describe('when script runner is enabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = true
      filter = scriptRunnerFilter(getFilterParams({ config })) as FilterType
      const now = 10000
      jest.spyOn(Date, 'now').mockReturnValue(now)
      jest.spyOn(users, 'getCurrentUserInfo').mockResolvedValueOnce({
        userId: 'salto',
        displayName: 'saltoName',
      })
    })
    it('should add annotations to script runner types', async () => {
      const scriptedFields = new ObjectType({
        elemID: new ElemID(JIRA, SCRIPTED_FIELD_TYPE),
        fields: {
          notImportant: { refType: BuiltinTypes.STRING },
        },
      })
      const settings = new ObjectType({
        elemID: new ElemID(JIRA, SCRIPT_RUNNER_SETTINGS_TYPE),
        fields: {
          notImportant: { refType: BuiltinTypes.STRING },
        },
      })
      await filter.onFetch([scriptedFields, settings])
      expect(scriptedFields.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeTrue()
      expect(scriptedFields.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
      expect(scriptedFields.annotations[CORE_ANNOTATIONS.DELETABLE]).toBeTrue()
      expect(scriptedFields.fields.notImportant.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeTrue()
      expect(scriptedFields.fields.notImportant.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
      expect(scriptedFields.fields.notImportant.annotations[CORE_ANNOTATIONS.DELETABLE]).toBeTrue()
      expect(settings.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeFalse()
      expect(settings.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
      expect(settings.annotations[CORE_ANNOTATIONS.DELETABLE]).toBeFalse()
      expect(settings.fields.notImportant.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
    })
    it('should remove empty instances', async () => {
      const emptyListenerInstance = new InstanceElement('unnamed_0', createEmptyType(SCRIPT_RUNNER_LISTENER_TYPE), {
        spaceRemaining: 99.9,
      })
      const elements = [emptyListenerInstance]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(0)
    })
    it('should not remove non empty instances', async () => {
      const nonEmptyListenerInstance = new InstanceElement('unnamed_0', createEmptyType(SCRIPT_RUNNER_LISTENER_TYPE), {
        description: 'not empty',
      })
      const elements = [nonEmptyListenerInstance]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(1)
    })

    describe('on creation', () => {
      it('should add audit info to relevant types', async () => {
        await filter.preDeploy([
          toChange({ after: auditInstance }),
          toChange({ after: listenerInstance }),
          toChange({ after: fragmentInstance }),
        ])
        expect(auditInstance.value.auditData).toEqual({
          createdByAccountId: 'salto',
          createdTimestamp: 10,
        })
        expect(listenerInstance.value.createdByAccountId).toEqual('salto')
        expect(listenerInstance.value.createdTimestamp).toEqual('10')
        expect(fragmentInstance.value.createdByAccountId).toBeUndefined()
        expect(fragmentInstance.value.createdTimestamp).toBeUndefined()
      })
      it('should add uuid', async () => {
        await filter.preDeploy([toChange({ after: auditInstance }), toChange({ after: listenerInstance })])
        expect(auditInstance.value.uuid).toEqual('my-uuid')
        expect(listenerInstance.value.uuid).toEqual('my-uuid')
      })
      it('should add audit info when not defined', async () => {
        jest.spyOn(users, 'getCurrentUserInfo').mockReset()
        jest.spyOn(users, 'getCurrentUserInfo').mockResolvedValueOnce(undefined)
        await filter.preDeploy([toChange({ after: auditInstance })])
        expect(auditInstance.value.auditData).toEqual({
          createdByAccountId: '',
          createdTimestamp: 10,
        })
      })
    })
    describe('on update', () => {
      beforeEach(() => {
        auditInstance.value.auditData = {
          createdByAccountId: 'not-salto',
          createdTimestamp: 1,
        }
        listenerInstance.value = {
          createdByAccountId: 'not-salto',
          createdTimestamp: '1',
        }
      })
      it('should add audit info for relevant types', async () => {
        await filter.preDeploy([
          toChange({ before: auditInstance, after: auditInstance }),
          toChange({ before: listenerInstance, after: listenerInstance }),
        ])
        expect(auditInstance.value.auditData).toEqual({
          createdByAccountId: 'not-salto',
          createdTimestamp: 1,
          updatedByAccountId: 'salto',
          updatedTimestamp: 10,
        })
        expect(listenerInstance.value.updatedByAccountId).toEqual('salto')
        expect(listenerInstance.value.updatedTimestamp).toEqual('10')
      })
      it('should not change the  uuid', async () => {
        auditInstance.value.uuid = 'not-my-uuid'
        listenerInstance.value.uuid = 'not-my-uuid'
        fragmentInstance.value.id = 'not-my-uuid'

        await filter.preDeploy([
          toChange({ before: auditInstance, after: auditInstance }),
          toChange({ before: listenerInstance, after: listenerInstance }),
          toChange({ before: fragmentInstance, after: auditInstance }),
        ])
        expect(auditInstance.value.uuid).toEqual('not-my-uuid')
        expect(listenerInstance.value.uuid).toEqual('not-my-uuid')
        expect(fragmentInstance.value.id).toEqual('not-my-uuid')
      })
      it('should add audit info when not defined', async () => {
        jest.spyOn(users, 'getCurrentUserInfo').mockReset()
        jest.spyOn(users, 'getCurrentUserInfo').mockResolvedValueOnce(undefined)
        await filter.preDeploy([toChange({ before: auditInstance, after: auditInstance })])
        expect(auditInstance.value.auditData).toEqual({
          createdByAccountId: 'not-salto',
          createdTimestamp: 1,
          updatedByAccountId: '',
          updatedTimestamp: 10,
        })
      })
    })
  })
  describe('when script runner is disabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = false
      filter = scriptRunnerFilter(getFilterParams({ config })) as FilterType
    })
    it('should not add annotations on fetch', async () => {
      const scriptedFields = new ObjectType({
        elemID: new ElemID(JIRA, SCRIPTED_FIELD_TYPE),
        fields: {
          notImportant: { refType: BuiltinTypes.STRING },
        },
      })
      await filter.onFetch([scriptedFields])
      expect(scriptedFields.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    })
    it('should not add audit info on creation', async () => {
      await filter.preDeploy([toChange({ after: auditInstance })])
      expect(auditInstance.value.auditData).toBeUndefined()
    })
  })
})
