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
import { toChange, Change } from '@salto-io/adapter-api'
import SalesforceAdapter from '../../src/adapter'
import { FilterWith, FilterCreator } from '../../src/filter'
import mockAdapter from '../adapter'
import { mockFunction, MockInterface, MockFunction } from '../utils'
import { mockDeployResult, mockDeployMessage } from '../connection'
import { apiName, createInstanceElement, metadataType } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'

describe('SalesforceAdapter filters', () => {
  describe('when filter methods are implemented', () => {
    let adapter: SalesforceAdapter
    let filter: MockInterface<FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>>
    let filterCreator: MockFunction<FilterCreator>
    let connection: ReturnType<typeof mockAdapter>['connection']

    beforeEach(() => {
      filter = {
        onFetch: mockFunction<(typeof filter)['onFetch']>().mockResolvedValue(),
        preDeploy: mockFunction<(typeof filter)['preDeploy']>().mockResolvedValue(),
        onDeploy: mockFunction<(typeof filter)['onDeploy']>().mockResolvedValue([]),
      }

      filterCreator = mockFunction<FilterCreator>().mockReturnValue(filter)
      const mocks = mockAdapter({ adapterParams: { filterCreators: [filterCreator] } })
      adapter = mocks.adapter
      connection = mocks.connection
    })

    it('should call inner aspects upon fetch', async () => {
      await adapter.fetch()
      expect(filter.onFetch).toHaveBeenCalledTimes(1)
    })

    describe('deploy', () => {
      let originalChange: Change
      let replacementChange: Change
      let inputChanges: Change[]
      let preDeployInputChanges: Change[]
      beforeEach(async () => {
        const instance = createInstanceElement(
          { fullName: 'TestLayout' }, mockTypes.Layout,
        )
        connection.metadata.deploy.mockReturnValueOnce(mockDeployResult({
          componentSuccess: [mockDeployMessage(
            { fullName: apiName(instance), componentType: metadataType(instance) }
          )],
        }))

        originalChange = toChange({ after: instance })
        replacementChange = toChange({ before: instance })
        inputChanges = [originalChange]

        filter.preDeploy.mockImplementationOnce(async changes => {
          // Copy the input changes before modifying the list
          preDeployInputChanges = [...changes]
          changes.pop()
          changes.push(replacementChange)
        })

        await adapter.deploy({
          groupID: instance.elemID.getFullName(),
          changes: inputChanges,
        })
      })

      it('should not change the input changes list', () => {
        expect(inputChanges).toEqual([originalChange])
      })

      it('should call preDeploy', () => {
        expect(filter.preDeploy).toHaveBeenCalledTimes(1)
        // Because our preDeploy implementation changes its input in place, we cannot use the mock
        // to check the argument passed into the function.
        expect(preDeployInputChanges).toEqual(inputChanges)
      })

      it('should call onDeploy with the changes set by preDeploy', () => {
        expect(filter.onDeploy).toHaveBeenCalledTimes(1)
        expect(filter.onDeploy).toHaveBeenCalledWith([replacementChange])
      })

      it('should create the filter only once', () => {
        // This is needed to allow the filter to keep context between preDeploy and onDeploy
        expect(filterCreator).toHaveBeenCalledTimes(1)
      })
    })
  })
})
