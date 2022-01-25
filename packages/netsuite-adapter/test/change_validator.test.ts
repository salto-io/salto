/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, ElemID, InstanceElement, ObjectType, ProgressReporter, toChange } from '@salto-io/adapter-api'
import { fileCabinetTypes } from '../src/types'
import getChangeValidator from '../src/change_validator'
import { FetchByQueryFunc, FetchByQueryReturnType } from '../src/change_validators/safe_deploy'
import { NetsuiteQuery } from '../src/query'

describe('change validator', () => {
  describe('SuiteApp', () => {
    let fetchByQuery: FetchByQueryFunc
    beforeEach(() => {
      fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
      Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: { lockedError: [], otherError: [] },
        failedTypes: { lockedError: {}, unexpectedError: {} },
        elements: [],
      }))
    })
    describe('without SuiteApp', () => {
      it('should have change error when removing an instance with file cabinet type', async () => {
        const changeValidator = getChangeValidator(
          { withSuiteApp: false, warnStaleData: false, fetchByQuery }
        )
        const instance = new InstanceElement('test', fileCabinetTypes.file)
        const changeErrors = await changeValidator([toChange({ before: instance })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(instance.elemID)
      })
    })

    describe('with SuiteApp', () => {
      it('should not have change error when removing an instance with file cabinet type', async () => {
        const changeValidator = getChangeValidator(
          { withSuiteApp: true, warnStaleData: false, fetchByQuery }
        )
        const instance = new InstanceElement('test', fileCabinetTypes.file)
        const changeErrors = await changeValidator([toChange({ before: instance })])
        expect(changeErrors).toHaveLength(0)
      })
    })
  })

  describe('warnOnStaleWorkspaceData', () => {
    let change: Change
    let fetchByQuery: FetchByQueryFunc
    beforeEach(() => {
      const origInstance = new InstanceElement('testInstance', new ObjectType({ elemID: new ElemID('testType') }), { livingIn: 'lalaland' })
      const serviceInstance = origInstance.clone()
      serviceInstance.value.livingIn = 'a movie'
      const modifiedInstance = origInstance.clone()
      modifiedInstance.value.livingIn = 'a garden'
      change = toChange({ before: origInstance, after: modifiedInstance })

      fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
      Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: { lockedError: [], otherError: [] },
        failedTypes: { lockedError: {}, unexpectedError: {} },
        elements: [serviceInstance],
      }))
    })
    it('should not have change error when warnOnStaleWorkspaceData is false', async () => {
      const changeErrors = await getChangeValidator({ withSuiteApp: false,
        warnStaleData: false,
        fetchByQuery })([change])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have change error when warnOnStaleWorkspaceData is true', async () => {
      const changeErrors = await getChangeValidator({ withSuiteApp: false,
        warnStaleData: true,
        fetchByQuery })([change])
      expect(changeErrors).toHaveLength(1)
    })
  })
})
