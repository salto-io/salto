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
import { fileType } from '../src/types/file_cabinet_types'
import getChangeValidator from '../src/change_validator'
import netsuiteClientValidation from '../src/change_validators/client_validation'
import { FetchByQueryFunc, FetchByQueryReturnType } from '../src/change_validators/safe_deploy'
import { NetsuiteQuery } from '../src/query'
import NetsuiteClient from '../src/client/client'

const DEFAULT_OPTIONS = {
  withSuiteApp: false,
  warnStaleData: false,
  validate: false,
  additionalDependencies: {
    include: { features: [], objects: [] },
    exclude: { features: [], objects: [] },
  },
  deployReferencedElements: false,
}

jest.mock('../src/change_validators/client_validation')
const netsuiteClientValidationMock = netsuiteClientValidation as jest.Mock

describe('change validator', () => {
  const file = fileType()
  const client = {} as unknown as NetsuiteClient

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
          { ...DEFAULT_OPTIONS, client, fetchByQuery }
        )
        const instance = new InstanceElement('test', file)
        const changeErrors = await changeValidator([toChange({ before: instance })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(instance.elemID)
      })
    })

    describe('with SuiteApp', () => {
      it('should not have change error when removing an instance with file cabinet type', async () => {
        const changeValidator = getChangeValidator(
          { ...DEFAULT_OPTIONS, withSuiteApp: true, client, fetchByQuery }
        )
        const instance = new InstanceElement('test', file)
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
      const changeErrors = await getChangeValidator(
        { ...DEFAULT_OPTIONS, client, fetchByQuery }
      )([change])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have change error when warnOnStaleWorkspaceData is true', async () => {
      const changeErrors = await getChangeValidator(
        { ...DEFAULT_OPTIONS, warnStaleData: true, client, fetchByQuery }
      )([change])
      expect(changeErrors).toHaveLength(1)
    })
  })

  describe('netsuite client validation', () => {
    let fetchByQuery: FetchByQueryFunc
    netsuiteClientValidationMock.mockResolvedValue([])
    it('should not call netsuiteClientValidation when validate=false', async () => {
      await getChangeValidator(
        { ...DEFAULT_OPTIONS, client, fetchByQuery, validate: false }
      )([toChange({ after: new InstanceElement('test', file) })])
      expect(netsuiteClientValidationMock).not.toHaveBeenCalled()
    })
    it('should call netsuiteClientValidation when validate=true', async () => {
      const changes = [toChange({ after: new InstanceElement('test', file) })]
      await getChangeValidator(
        { ...DEFAULT_OPTIONS, client, fetchByQuery, validate: true }
      )(changes)
      expect(netsuiteClientValidationMock).toHaveBeenCalledWith(
        changes,
        client,
        DEFAULT_OPTIONS.additionalDependencies,
        DEFAULT_OPTIONS.deployReferencedElements
      )
    })
  })
})
