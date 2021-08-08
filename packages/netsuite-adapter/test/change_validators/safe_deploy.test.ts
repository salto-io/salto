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
import { InstanceElement, ProgressReporter, toChange } from '@salto-io/adapter-api'
import { NetsuiteQuery } from '../../src/query'
import safeDeployValidator, { FetchByQueryReturnType } from '../../src/change_validators/safe_deploy'
import { customTypes } from '../../src/types'
import { CUSTOM_LIST, CUSTOM_RECORD_TYPE } from '../../src/constants'

describe('safe deploy change validator', () => {
  const origInstance = new InstanceElement(
    'instance',
    customTypes[CUSTOM_LIST],
    {
      customvalues: {
        customvalue: [
          {
            scriptid: 'val_1',
            value: 'Value 1',
          },
          {
            scriptid: 'val_2',
            value: 'Value 2',
          },
        ],
      },
    },
  )
  const origInstance1 = new InstanceElement(
    'instance1',
    customTypes[CUSTOM_LIST],
    {
      customvalues: {
        customvalue: [
          {
            scriptid: 'val_1',
            value: 'Value 1',
          },
          {
            scriptid: 'val_2',
            value: 'Value 2',
          },
        ],
      },
    },
  )

  const origInstance2 = new InstanceElement(
    'instance',
    customTypes[CUSTOM_RECORD_TYPE],
    {
      customvalues: {
        customvalue: [
          {
            scriptid: 'val_1',
            value: 'Value 1',
          },
          {
            scriptid: 'val_2',
            value: 'Value 2',
          },
        ],
      },
    },
  )

  let afterInstance: InstanceElement
  beforeEach(() => {
    afterInstance = origInstance.clone()
    afterInstance.value.customvalues.customvalue[0].value = 'Value 1!@!'
  })

  describe('When the instance has not changed in the service', () => {
    it('should have no change warning', async () => {
      const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
      Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: [],
        failedTypeToInstances: {},
        elements: [origInstance, origInstance1, origInstance2],
      }))
      const changeErrors = await safeDeployValidator(
        [toChange({ before: origInstance, after: afterInstance })],
        fetchByQuery
      )
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('When the instance has changed in the service in the same field', () => {
    it('should have warning', async () => {
      const serviceInstance = origInstance.clone()
      serviceInstance.value.customvalues.customvalue[0].value = 'Changed Value'

      const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: [],
        failedTypeToInstances: {},
        elements: [serviceInstance, origInstance1, origInstance2],
      }))
      const changeErrors = await safeDeployValidator(
        [toChange({ before: origInstance, after: afterInstance })],
        fetchByQuery
      )
      expect(changeErrors).toHaveLength(1)
    })
  })

  describe('When the instance has changed in the service in a different field', () => {
    it('should have warning', async () => {
      const serviceInstance = origInstance.clone()
      serviceInstance.value.customvalues.customvalue[1].value = 'Changed Value'
      const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: [],
        failedTypeToInstances: {},
        elements: [serviceInstance, origInstance1, origInstance2],
      }))

      const changeErrors = await safeDeployValidator(
        [toChange({ before: origInstance, after: afterInstance })],
        fetchByQuery
      )
      expect(changeErrors).toHaveLength(1)
    })
  })
  describe('When cannot match instance in service', () => {
    it('should throw Error when instance does not exist', async () => {
      const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: [],
        failedTypeToInstances: {},
        elements: [origInstance1, origInstance2],
      }))

      await expect(safeDeployValidator(
        [toChange({ before: origInstance, after: afterInstance })],
        fetchByQuery
      )).rejects.toThrow(new Error('Failed to find the instance instance in the service, or could not match it exactly'))
    })
    it('should throw Error when multiple matching instances exist', async () => {
      const serviceInstance = origInstance.clone()
      serviceInstance.value.customvalues.customvalue[1].value = 'Changed Value'
      const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: [],
        failedTypeToInstances: {},
        elements: [serviceInstance, serviceInstance.clone(), origInstance1, origInstance2],
      }))

      await expect(safeDeployValidator(
        [toChange({ before: origInstance, after: afterInstance })],
        fetchByQuery
      )).rejects.toThrow(new Error('Failed to find the instance instance in the service, or could not match it exactly'))
    })
  })
})
