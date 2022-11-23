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
import { ElemID, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { configType } from '../src/types'
import { configOptObjectType, configWithCPQ, getConfig } from '../src/config_opt'

const mockDefaultInstanceFromTypeResult = new InstanceElement('mock name', configType)
const mockCreateDefaultInstanceFromType = jest.fn()
  .mockResolvedValue(mockDefaultInstanceFromTypeResult)

jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  createDefaultInstanceFromType: jest.fn()
    .mockImplementation((...args) => mockCreateDefaultInstanceFromType(...args)),
}))

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn()
    .mockReturnValue({
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn((...args) => mockLogError(...args)),
    }),
}))

describe('config_opt', () => {
  let configOpt: InstanceElement | undefined
  let resultConfig: InstanceElement

  const createMockConfigOptInstance = (value: Values): InstanceElement =>
    new InstanceElement('configOpt', configOptObjectType, value)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when input contains cpq equal true', () => {
    beforeEach(async () => {
      configOpt = createMockConfigOptInstance({ cpq: true })
      resultConfig = await getConfig(configOpt)
    })
    it('should return adapter config with cpq', async () => {
      expect(resultConfig).toEqual(configWithCPQ)
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains cpq equal false', () => {
    beforeEach(async () => {
      configOpt = createMockConfigOptInstance({ cpq: false })
      resultConfig = await getConfig(configOpt)
    })
    it('should create default instance from type', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input does not contain cpq', () => {
    beforeEach(async () => {
      configOpt = createMockConfigOptInstance({})
      resultConfig = await getConfig(configOpt)
    })
    it('should create default instance from type', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input is not a valid configOptObjectType', () => {
    beforeEach(async () => {
      const differentObjType = new ObjectType({
        elemID: new ElemID('mock'),
      })
      configOpt = new InstanceElement('configOpt', differentObjType, { cpq: true })
      resultConfig = await getConfig(configOpt)
    })
    it('should create default instance from type and log error', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(mockLogError).toHaveBeenCalledWith(`Received an invalid instance for configOpt. Instance: ${safeJsonStringify(configOpt)}`)
    })
  })
})
