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
import { ElemID, InstanceElement, ObjectType, toChange, ChangeDataType, BuiltinTypes } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../../src/filters/internal_ids/sdf_internal_ids'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../../src/constants'
import NetsuiteClient from '../../../src/client/client'
import { RemoteFilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../../utils'
import { clientscriptType } from '../../../src/autogen/types/standard_types/clientscript'
import { savedsearchType } from '../../../src/autogen/types/standard_types/savedsearch'

describe('sdf internal ids tests', () => {
  let filterOpts: RemoteFilterOpts
  let elements: ChangeDataType[]
  let customRecordType: ObjectType
  let accountInstance: InstanceElement
  let customScriptInstance: InstanceElement
  let instanceWithoutScriptid: InstanceElement
  let savedSearchInstance: InstanceElement
  let otherCustomFieldInstance: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient
  const savedsearch = savedsearchType().type
  const clientScriptType = clientscriptType().type

  const client = new NetsuiteClient(SDFClient, suiteAppClient)
  beforeEach(async () => {
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        custom_field: { refType: BuiltinTypes.STRING },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        [SCRIPT_ID]: 'customrecord1',
      },
    })
    accountInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    customScriptInstance = new InstanceElement('customScript', clientScriptType)
    instanceWithoutScriptid = new InstanceElement('customScript', clientScriptType)
    savedSearchInstance = new InstanceElement('savedSearch', savedsearch, { scriptid: 'scriptId4' })
    otherCustomFieldInstance = new InstanceElement(
      'othercustomfield',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'othercustomfield') }),
    )
    accountInstance.value.internalId = '1'
    customScriptInstance.value.scriptid = 'scriptId3'
    otherCustomFieldInstance.value.scriptid = 'scriptid5'

    elements = [
      accountInstance,
      customScriptInstance,
      instanceWithoutScriptid,
      savedSearchInstance,
      otherCustomFieldInstance,
      customRecordType,
    ]
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })
  describe('no suite app client', () => {
    it('should not change any elements in fetch', async () => {
      const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(customRecordType.annotations.internalId).not.toBeDefined()
      expect(customScriptInstance.value.internalId).not.toBeDefined()
      expect(savedSearchInstance.value.internalId).not.toBeDefined()
      expect(otherCustomFieldInstance.value.internalId).not.toBeDefined()
    })
    it('should not change any elements in pre deploy', async () => {
      customRecordType.annotations.internalId = '2'
      customScriptInstance.value.internalId = '3'
      const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(filterOpts).preDeploy?.(elements.map(element => toChange({ after: element })))
      expect(accountInstance.value.internalId).toBe('1')
      expect(customRecordType.annotations.internalId).toBe('2')
      expect(customScriptInstance.value.internalId).toBe('3')
    })
    it('should not change any elements in deploy', async () => {
      const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(filterOpts).onDeploy?.(
        [
          toChange({ before: accountInstance, after: accountInstance }),
          toChange({ after: customRecordType }),
          toChange({ after: customScriptInstance }),
        ],
        {
          appliedChanges: [],
          errors: [],
        },
      )
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(customRecordType.annotations.internalId).not.toBeDefined()
      expect(customScriptInstance.value.internalId).not.toBeDefined()
    })
  })
  describe('bad schema', () => {
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSavedSearchQueryMock.mockReset()
    })
    it('bad record id schema', async () => {
      runSuiteQLMock.mockResolvedValueOnce({ scriptid: 'scriptId3' })
      runSavedSearchQueryMock.mockResolvedValue([{ id: 'scriptId4' }])
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(customRecordType.annotations.internalId).not.toBeDefined()
      expect(customScriptInstance.value.internalId).not.toBeDefined()
      expect(savedSearchInstance.value.internalId).not.toBeDefined()
    })

    it('saved search query failure', async () => {
      runSavedSearchQueryMock.mockResolvedValue(undefined)
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(savedSearchInstance.value.internalId).not.toBeDefined()
    })
  })
  describe('fetch', () => {
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSavedSearchQueryMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'scriptId3', id: '3' }])
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'scriptId5', id: '5' }])
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord1', id: '2' }])
      runSavedSearchQueryMock.mockResolvedValueOnce([{ id: 'scriptId4', internalid: [{ value: '4' }] }])
      await filterCreator(filterOpts).onFetch?.(elements.concat(clientScriptType))
    })
    it('should query information from api', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid, id FROM clientscript ORDER BY id ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(
        2,
        'SELECT scriptid, internalid FROM customfield ORDER BY internalid ASC',
      )
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(
        3,
        'SELECT scriptid, internalid FROM customrecordtype ORDER BY internalid ASC',
      )
      expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
      expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
        { type: 'savedsearch', filters: [], columns: ['id', 'internalid'] },
        undefined,
      )
      expect(runSavedSearchQueryMock).toHaveBeenCalledTimes(1)
    })
    it('should add internal ids to elements', () => {
      expect(accountInstance.value.internalId).toBe('1')
      expect(customRecordType.annotations.internalId).toBe('2')
      expect(customScriptInstance.value.internalId).toBe('3')
      expect(savedSearchInstance.value.internalId).toBe('4')
      expect(otherCustomFieldInstance.value.internalId).toBe('5')
    })
    it('should add field to object', () => {
      expect(customRecordType.annotationRefTypes.internalId).toBeDefined()
      expect(clientScriptType.fields.internalId).toBeDefined()
    })
  })
  describe('pre deploy', () => {
    it('should remove internal ids from elements', async () => {
      customRecordType.annotations.internalId = '2'
      customScriptInstance.value.internalId = '3'
      savedSearchInstance.value.internalId = '4'
      await filterCreator(filterOpts).preDeploy?.(elements.map(element => toChange({ after: element })))
      expect(accountInstance.value.internalId).toBe('1')
      expect(customRecordType.annotations.internalId).toBe(undefined)
      expect(customScriptInstance.value.internalId).toBe(undefined)
      expect(savedSearchInstance.value.internalId).toBe(undefined)
    })
  })
  describe('deploy', () => {
    describe('success', () => {
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSavedSearchQueryMock.mockReset()
        runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'scriptId3', id: '3' }])
        runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord1', id: '2' }])
        runSavedSearchQueryMock.mockResolvedValueOnce([{ id: 'scriptId4', internalid: [{ value: '4' }] }])
        await filterCreator(filterOpts).onDeploy?.(
          [
            toChange({ before: accountInstance, after: accountInstance }),
            toChange({ after: customRecordType }),
            toChange({ after: customScriptInstance }),
            toChange({ after: savedSearchInstance }),
          ],
          {
            appliedChanges: [],
            errors: [],
          },
        )
      })
      it('should query information from api', () => {
        expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid, id FROM clientscript ORDER BY id ASC')
        expect(runSuiteQLMock).toHaveBeenNthCalledWith(
          2,
          'SELECT scriptid, internalid FROM customrecordtype ORDER BY internalid ASC',
        )
        expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
          { type: 'savedsearch', filters: [], columns: ['id', 'internalid'] },
          undefined,
        )
        expect(runSavedSearchQueryMock).toHaveBeenCalledTimes(1)
      })
      it('should add internal ids to new elements', () => {
        expect(customRecordType.annotations.internalId).toBe('2')
        expect(customScriptInstance.value.internalId).toBe('3')
        expect(savedSearchInstance.value.internalId).toBe('4')
      })
      it('should do nothing to modified elements', () => {
        expect(accountInstance.value.internalId).toBe('1')
      })
    })
    describe('failure', () => {
      beforeEach(async () => {
        runSuiteQLMock.mockReset()
        runSavedSearchQueryMock.mockReset()
      })
      it('No addition instances', async () => {
        await filterCreator(filterOpts).onDeploy?.(
          [
            toChange({ before: accountInstance, after: accountInstance }),
            toChange({ before: customRecordType, after: customRecordType }),
            toChange({ before: customScriptInstance, after: customScriptInstance }),
            toChange({ before: savedSearchInstance, after: savedSearchInstance }),
          ],
          {
            appliedChanges: [],
            errors: [],
          },
        )
        expect(runSavedSearchQueryMock).toHaveBeenCalledTimes(0)
        expect(runSuiteQLMock).toHaveBeenCalledTimes(0)
        expect(customRecordType.annotations.internalId).not.toBeDefined()
        expect(customScriptInstance.value.internalId).not.toBeDefined()
        expect(savedSearchInstance.value.internalId).not.toBeDefined()
      })
    })
  })
})
