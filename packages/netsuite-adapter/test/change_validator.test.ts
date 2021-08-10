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
import { Change, ChangeValidator, ElemID, InstanceElement, ObjectType, ProgressReporter, toChange } from '@salto-io/adapter-api'
import { fileCabinetTypes } from '../src/types'
import getChangeValidator from '../src/change_validator'
import NetsuiteClient from '../src/client/client'
import SuiteAppClient from '../src/client/suiteapp_client/suiteapp_client'
import SdfClient from '../src/client/sdf_client'
import { FetchByQueryFunc, FetchByQueryReturnType } from '../src/change_validators/safe_deploy'
import { NetsuiteQuery } from '../src/query'

describe('change validator', () => {
  describe('SuiteApp', () => {
    describe('without SuiteApp', () => {
      let changeValidator: ChangeValidator
      beforeEach(() => {
        const sdfClient = {
          getCredentials: () => ({ accountId: 'someId' }),
        } as unknown as SdfClient
        const client = new NetsuiteClient(sdfClient)
        changeValidator = getChangeValidator(client, false)
      })

      it('should have change error when removing an instance with file cabinet type', async () => {
        const instance = new InstanceElement('test', fileCabinetTypes.file)
        const changeErrors = await changeValidator([toChange({ before: instance })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(instance.elemID)
      })
    })

    describe('with SuiteApp', () => {
      let changeValidator: ChangeValidator
      beforeEach(() => {
        const sdfClient = {
          getCredentials: () => ({ accountId: 'someId' }),
        } as unknown as SdfClient

        const suiteAppClient = {} as SuiteAppClient
        const client = new NetsuiteClient(sdfClient, suiteAppClient)
        changeValidator = getChangeValidator(client, false)
      })
      it('should not have change error when removing an instance with file cabinet type', async () => {
        const instance = new InstanceElement('test', fileCabinetTypes.file)
        const changeErrors = await changeValidator([toChange({ before: instance })])
        expect(changeErrors).toHaveLength(0)
      })
    })
  })

  describe('warnOnStaleWorkspaceData', () => {
    let change: Change
    let client: NetsuiteClient
    let fetchByQuery: FetchByQueryFunc
    beforeEach(() => {
      const sdfClient = {
        getCredentials: () => ({ accountId: 'someId' }),
      } as unknown as SdfClient

      const suiteAppClient = {} as SuiteAppClient
      client = new NetsuiteClient(sdfClient, suiteAppClient)

      const origInstance = new InstanceElement('testInstance', new ObjectType({ elemID: new ElemID('testType') }), { livingIn: 'lalaland' })
      const serviceInstance = origInstance.clone()
      serviceInstance.value.livingIn = 'a movie'
      const modifiedInstance = origInstance.clone()
      modifiedInstance.value.livingIn = 'a garden'
      change = toChange({ before: origInstance, after: modifiedInstance })

      fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
      Promise<FetchByQueryReturnType> => (Promise.resolve({
        failedToFetchAllAtOnce: false,
        failedFilePaths: [],
        failedTypeToInstances: {},
        elements: [serviceInstance],
      }))
    })
    it('should not have change error when warnOnStaleWorkspaceData is false', async () => {
      const changeErrors = await getChangeValidator(client, false, fetchByQuery)([change])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have change error when warnOnStaleWorkspaceData is true', async () => {
      const changeErrors = await getChangeValidator(client, true, fetchByQuery)([change])
      expect(changeErrors).toHaveLength(1)
    })
  })
})
