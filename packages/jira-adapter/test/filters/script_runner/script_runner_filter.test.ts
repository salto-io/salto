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
import { filterUtils } from '@salto-io/adapter-components'
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import scriptRunnerFilter from '../../../src/filters/script_runner/script_runner_filter'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA, SCRIPTED_FIELD_TYPE } from '../../../src/constants'
import * as users from '../../../src/users'

type FilterType = filterUtils.FilterWith<'preDeploy' | 'onFetch'>

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('my-uuid'),
}))


describe('script_runner_filter', () => {
  let filter: FilterType
  let instance: InstanceElement
  describe('when script runner is enabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = true
      filter = scriptRunnerFilter(getFilterParams({ config })) as FilterType
      const now = 10000
      jest.spyOn(Date, 'now').mockReturnValueOnce(now)
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
      await filter.onFetch([scriptedFields])
      expect(scriptedFields.annotations[CORE_ANNOTATIONS.CREATABLE]).toEqual(true)
      expect(scriptedFields.annotations[CORE_ANNOTATIONS.UPDATABLE]).toEqual(true)
      expect(scriptedFields.annotations[CORE_ANNOTATIONS.DELETABLE]).toEqual(true)
      expect(scriptedFields.fields.notImportant.annotations[CORE_ANNOTATIONS.CREATABLE]).toEqual(true)
      expect(scriptedFields.fields.notImportant.annotations[CORE_ANNOTATIONS.UPDATABLE]).toEqual(true)
      expect(scriptedFields.fields.notImportant.annotations[CORE_ANNOTATIONS.DELETABLE]).toEqual(true)
    })
    describe('on creation', () => {
      it('should add audit info', async () => {
        instance = new InstanceElement(
          'instance',
          createEmptyType(SCRIPTED_FIELD_TYPE),
          {}
        )
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.auditData).toEqual({
          createdByAccountId: 'salto',
          createdTimestamp: 10,
        })
      })
      it('should add uuid', async () => {
        instance = new InstanceElement(
          'instance',
          createEmptyType(SCRIPTED_FIELD_TYPE),
          {}
        )
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.uuid).toEqual('my-uuid')
      })
      it('should add audit info when not defined', async () => {
        instance = new InstanceElement(
          'instance',
          createEmptyType(SCRIPTED_FIELD_TYPE),
          {}
        )
        jest.spyOn(users, 'getCurrentUserInfo').mockReset()
        jest.spyOn(users, 'getCurrentUserInfo').mockResolvedValueOnce(undefined)
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.auditData).toEqual({
          createdByAccountId: '',
          createdTimestamp: 10,
        })
      })
    })
    describe('on update', () => {
      it('should add audit info', async () => {
        instance = new InstanceElement(
          'instance',
          createEmptyType(SCRIPTED_FIELD_TYPE),
          {
            auditData: {
              createdByAccountId: 'not-salto',
              createdTimestamp: 1,
            },
          }
        )
        await filter.preDeploy([toChange({ before: instance, after: instance })])
        expect(instance.value.auditData).toEqual({
          createdByAccountId: 'not-salto',
          createdTimestamp: 1,
          updatedByAccountId: 'salto',
          updatedTimestamp: 10,
        })
      })
      it('should not change the  uuid', async () => {
        instance = new InstanceElement(
          'instance',
          createEmptyType(SCRIPTED_FIELD_TYPE),
          {
            uuid: 'not-my-uuid',
            auditData: {
              createdByAccountId: 'not-salto',
              createdTimestamp: 1,
            },
          }
        )
        await filter.preDeploy([toChange({ before: instance, after: instance })])
        expect(instance.value.uuid).toEqual('not-my-uuid')
      })
      it('should add audit info when not defined', async () => {
        instance = new InstanceElement(
          'instance',
          createEmptyType(SCRIPTED_FIELD_TYPE),
          {
            auditData: {
              createdByAccountId: 'not-salto',
              createdTimestamp: 1,
            },
          }
        )
        jest.spyOn(users, 'getCurrentUserInfo').mockReset()
        jest.spyOn(users, 'getCurrentUserInfo').mockResolvedValueOnce(undefined)
        await filter.preDeploy([toChange({ before: instance, after: instance })])
        expect(instance.value.auditData).toEqual({
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
      instance = new InstanceElement(
        'instance',
        createEmptyType(SCRIPTED_FIELD_TYPE),
        {}
      )
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.auditData).toBeUndefined()
    })
  })
})
