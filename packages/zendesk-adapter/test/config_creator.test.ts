/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { configType } from '../src/config'
import { optionsType, getConfig, DEFAULT_GUIDE_THEME_CONFIG } from '../src/config_creator'

const mockDefaultInstanceFromTypeResult = new InstanceElement('mock name', configType, {})
const mockCreateDefaultInstanceFromType = jest.fn().mockResolvedValue(mockDefaultInstanceFromTypeResult)

jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  createDefaultInstanceFromType: jest.fn().mockImplementation((...args) => mockCreateDefaultInstanceFromType(...args)),
}))

const mockLogError = jest.fn()
jest.mock('@salto-io/logging', () => ({
  ...jest.requireActual<{}>('@salto-io/logging'),
  logger: jest.fn().mockReturnValue({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn((...args) => mockLogError(...args)),
  }),
}))

describe('config_creator', () => {
  let options: InstanceElement | undefined
  let resultConfig: InstanceElement

  const createMockOptionsInstance = (value: Values): InstanceElement =>
    new InstanceElement('options', optionsType(), value)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when input contains enableGuide equal true', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ enableGuide: true })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with guide', async () => {
      expect(resultConfig.value?.fetch?.guide).toEqual({
        brands: ['.*'],
      })
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
      expect(resultConfig.value?.fetch?.guide).toBeUndefined()
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
      expect(resultConfig.value?.fetch?.guide).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains enableGuideThemes equal true', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ enableGuideThemes: true })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with guide themes', async () => {
      expect(resultConfig.value?.fetch?.guide).toEqual({ brands: ['.*'], ...DEFAULT_GUIDE_THEME_CONFIG })
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains enableGuideThemes equal false', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ enableGuideThemes: false })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with guide themes', async () => {
      expect(resultConfig.value?.fetch?.guide).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains enableGuide and enableGuideThemes equal true', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ enableGuide: true, enableGuideThemes: true })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with guide and guide themes', async () => {
      expect(resultConfig.value?.fetch?.guide).toEqual({
        ...DEFAULT_GUIDE_THEME_CONFIG,
        brands: ['.*'],
      })
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains guideOptions equal GUIDE_WITH_THEMES', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ guideOptions: 'Guide with Themes' })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with guide themes', async () => {
      expect(resultConfig.value?.fetch?.guide).toEqual({ brands: ['.*'], ...DEFAULT_GUIDE_THEME_CONFIG })
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains guideOptions equal NO_GUIDE', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ guideOptions: 'No guide' })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with guide themes', async () => {
      expect(resultConfig.value?.fetch?.guide).toBeUndefined()
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains guideOptions equal GUIDE_WITHOUT_THEMES', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ guideOptions: 'Guide without Themes' })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config without guide themes', async () => {
      expect(resultConfig.value?.fetch?.guide).toEqual({ brands: ['.*'] })
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
      expect(resultConfig.value?.fetch?.guide).toBeUndefined()
      expect(mockLogError).toHaveBeenCalledWith(
        `Received an invalid instance for config options. Received instance with refType ElemId full name: ${options?.refType.elemID.getFullName()}`,
      )
    })
  })
})
