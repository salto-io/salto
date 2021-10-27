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
import { ElemID, InstanceElement, ObjectType, toChange, Element } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../../src/filters/internal_ids/sdf_internal_ids'
import { NETSUITE } from '../../../src/constants'
import NetsuiteClient from '../../../src/client/client'
import { FilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'

describe('sdf internal ids tests', () => {
  let filterOpts: FilterOpts
  let instances: InstanceElement[]
  let elements: Element[]
  let customTypeObject: ObjectType
  let accountInstance: InstanceElement
  let customTypeInstance: InstanceElement
  let customScriptInstance: InstanceElement
  let savedSearchInstance: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(SDFClient, suiteAppClient)
  beforeEach(() => {
    customTypeObject = new ObjectType({ elemID: new ElemID(NETSUITE, 'customrecordtype') })
    accountInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    customTypeInstance = new InstanceElement('customRecordType', customTypeObject)
    customScriptInstance = new InstanceElement('customScript', new ObjectType({ elemID: new ElemID(NETSUITE, 'clientscript') }))
    savedSearchInstance = new InstanceElement('savedSearch', new ObjectType({ elemID: new ElemID(NETSUITE, 'savedseach') }))
    accountInstance.value.internalId = '1'
    customTypeInstance.value.scriptid = 'scriptId2'
    customScriptInstance.value.scriptid = 'scriptId3'
    savedSearchInstance.value.scriptid = 'scriptId4'
    instances = [accountInstance, customTypeInstance, customScriptInstance, savedSearchInstance]
    elements = [...instances, customTypeObject]
    filterOpts = {
      client,
      elementsSourceIndex: { getIndexes: () => Promise.resolve({
        serviceIdsIndex: {},
        internalIdsIndex: {},
        customFieldsIndex: {},
      }) },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'scriptId2', id: '2' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'scriptId3', id: '3' },
    ])
  })
  describe('no suite app client', () => {
    it('should not change any elements in fetch', async () => {
      const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: { getIndexes: () => Promise.resolve({
          serviceIdsIndex: {},
          internalIdsIndex: {},
          customFieldsIndex: {},
        }) },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      }
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(customTypeInstance.value.internalId).not.toBeDefined()
      expect(customScriptInstance.value.internalId).not.toBeDefined()
    })
    it('should not change any elements in pre deploy', async () => {
      customTypeInstance.value.internalId = '2'
      customScriptInstance.value.internalId = '3'
      const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: { getIndexes: () => Promise.resolve({
          serviceIdsIndex: {},
          internalIdsIndex: {},
          customFieldsIndex: {},
        }) },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      }
      await filterCreator(filterOpts).preDeploy?.(
        instances.map(instance => toChange({ after: instance }))
      )
      expect(accountInstance.value.internalId).toBe('1')
      expect(customTypeInstance.value.internalId).toBe('2')
      expect(customScriptInstance.value.internalId).toBe('3')
    })
    it('should not change any elements in deploy', async () => {
      const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: { getIndexes: () => Promise.resolve({
          serviceIdsIndex: {},
          internalIdsIndex: {},
          customFieldsIndex: {},
        }) },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      }
      await filterCreator(filterOpts).onDeploy?.(
        [
          toChange({ before: accountInstance, after: accountInstance }),
          toChange({ after: customTypeInstance }),
          toChange({ after: customScriptInstance }),
        ],
        {
          appliedChanges: [],
          errors: [],
        },
      )
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(customTypeInstance.value.internalId).not.toBeDefined()
      expect(customScriptInstance.value.internalId).not.toBeDefined()
    })
  })
  describe('bad schema', () => {
    it('bad record id schema', async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce({ scriptid: 'scriptId3' })
      await expect(filterCreator(filterOpts).onFetch?.(elements)).rejects.toThrow()
    })
  })
  describe('fetch', () => {
    beforeEach(async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
    })
    it('should query information from api', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid, internalid as id FROM customrecordtype ORDER BY id ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, 'SELECT scriptid, id as id FROM clientscript ORDER BY id ASC')
      expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
    })
    it('should add internal ids to elements', () => {
      expect(accountInstance.value.internalId).toBe('1')
      expect(customTypeInstance.value.internalId).toBe('2')
      expect(customScriptInstance.value.internalId).toBe('3')
    })
    it('should add field to object', () => {
      expect(customTypeObject.fields.internalId).toBeDefined()
    })
  })
  describe('pre deploy', () => {
    it('should remove internal ids from elements', async () => {
      customTypeInstance.value.internalId = '2'
      customScriptInstance.value.internalId = '3'
      await filterCreator(filterOpts).preDeploy?.(
        instances.map(instance => toChange({ after: instance }))
      )
      expect(accountInstance.value.internalId).toBe('1')
      expect(customTypeInstance.value.internalId).toBe(undefined)
      expect(customScriptInstance.value.internalId).toBe(undefined)
    })
  })
  describe('deploy', () => {
    describe('success', () => {
      beforeEach(async () => {
        await filterCreator(filterOpts).onDeploy?.(
          [
            toChange({ before: accountInstance, after: accountInstance }),
            toChange({ after: customTypeInstance }),
            toChange({ after: customScriptInstance }),
          ],
          {
            appliedChanges: [],
            errors: [],
          },
        )
      })
      it('should query information from api', () => {
        expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid, internalid as id FROM customrecordtype ORDER BY id ASC')
        expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, 'SELECT scriptid, id as id FROM clientscript ORDER BY id ASC')
        expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
      })
      it('should add internal ids to new elements', () => {
        expect(customTypeInstance.value.internalId).toBe('2')
        expect(customScriptInstance.value.internalId).toBe('3')
      })
      it('should do nothing to modified elements', () => {
        expect(accountInstance.value.internalId).toBe('1')
      })
    })
    describe('failure', () => {
      it('No addition instances', async () => {
        await filterCreator(filterOpts).onDeploy?.(
          [
            toChange({ before: accountInstance, after: accountInstance }),
            toChange({ before: customTypeInstance, after: customTypeInstance }),
            toChange({ before: customScriptInstance, after: customScriptInstance }),
          ],
          {
            appliedChanges: [],
            errors: [],
          },
        )
        expect(customTypeInstance.value.internalId).not.toBeDefined()
        expect(customScriptInstance.value.internalId).not.toBeDefined()
      })
    })
  })
})
