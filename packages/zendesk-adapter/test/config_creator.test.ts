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
import { configType } from '../src/config'
import { optionsType, getConfig } from '../src/config_creator'

const mockDefaultInstanceFromTypeResult = new InstanceElement('mock name', configType, {})
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

describe('config_creator', () => {
  let options: InstanceElement | undefined
  let resultConfig: InstanceElement

  const createMockOptionsInstance = (value: Values): InstanceElement =>
    new InstanceElement('options', optionsType, value)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when input contains enableGuide equal true', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ enableGuide: true })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with guide', async () => {
      expect(resultConfig.value?.fetch?.enableGuide).toBeTruthy()
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains enableGuide equal false', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ enableGuide: false })
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(resultConfig.value?.fetch?.enableGuide).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input does not contain enableGuide', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({})
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(resultConfig.value?.fetch?.enableGuide).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input is not a valid optionsType', () => {
    beforeEach(async () => {
      const differentObjType = new ObjectType({
        elemID: new ElemID('mock'),
      })
      options = new InstanceElement('options', differentObjType, { enableGuide: true })
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type and log error', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(resultConfig.value?.fetch?.enableGuide).toBeUndefined()
      expect(mockLogError).toHaveBeenCalledWith(`Received an invalid instance for config options. Received instance with refType ElemId full name: ${options?.refType.elemID.getFullName()}`)
    })
  })
})
