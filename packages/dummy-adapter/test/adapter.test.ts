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
import { ElemID, ObjectType, toChange, InstanceElement } from '@salto-io/adapter-api'
import DummyAdapter from '../src/adapter'
import * as generator from '../src/generator'
import testParams from './test_params'
import { ChangeErrorFromConfigFile } from '../src/generator'

const mockChangeError: ChangeErrorFromConfigFile = {
  elemID: 'dummy.Full.instance.myIns2',
  severity: 'Error',
  message: 'mock message',
  detailedMessage: 'mock detailedMessage',
}

const objType = new ObjectType({
  elemID: ElemID.fromFullName('dummy.Full'),
})

const myInst1Change = toChange({ before: new InstanceElement('myIns1', objType) })
const myInst2Change = toChange({ before: new InstanceElement('myIns2', objType) })


describe('dummy adapter', () => {
  const adapter = new DummyAdapter(testParams)
  describe('deploy', () => {
    it('should be defined', () => {
      expect(adapter.deploy).toBeDefined()
    })
    it('should do nothing', async () => {
      expect(await adapter.deploy({ changeGroup: { changes: [], groupID: ':)' } })).toEqual({
        appliedChanges: [],
        errors: [],
      })
    })
  })
  describe('validate', () => {
    it('should be defined', () => {
      expect(adapter.validate).toBeDefined()
    })
    it('should do nothing', async () => {
      expect(await adapter.validate({ changeGroup: { changes: [], groupID: ':)' } })).toEqual({
        appliedChanges: [],
        errors: [],
      })
    })
  })

  describe('fetch', () => {
    const progressReportMock = {
      reportProgress: jest.fn(),
    }
    it('should return the result of the generateElement command withuot modifications', async () => {
      const mockReporter = { reportProgress: jest.fn() }
      const fetchResult = await adapter.fetch({ progressReporter: mockReporter })
      expect(fetchResult)
        .toEqual({ elements: await generator.generateElements(testParams, mockReporter) })
    })
    it('should report fetch progress', async () => {
      await adapter.fetch({ progressReporter: progressReportMock })
      expect(progressReportMock.reportProgress).toHaveBeenCalledTimes(7)
      expect(progressReportMock.reportProgress).toHaveBeenLastCalledWith({
        message: 'Generation done',
      })
    })
  })

  describe('deployModifier', () => {
    const adapterWithDeployModifiers = new DummyAdapter(
      { ...testParams, changeErrors: [mockChangeError] }
    )
    it('should be defined', () => {
      expect(adapterWithDeployModifiers.deployModifiers).toBeDefined()
    })
    it('should return changeError when same element exists in changes list', async () => {
      expect(await adapterWithDeployModifiers.deployModifiers.changeValidator?.([myInst2Change]))
        .toHaveLength(1)
    })
    it('should NOT return changeError when element is not exist in changes list', async () => {
      expect(await adapterWithDeployModifiers.deployModifiers.changeValidator?.([myInst1Change]))
        .toHaveLength(0)
    })
  })
})
