/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import * as adapterUtils from '@salto-io/adapter-utils'
import { configType, MetadataInstance } from '../src/types'
import { optionsType, getConfig, SalesforceConfigOptionsType } from '../src/config_creator'
import {
  MUTING_PERMISSION_SET_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from '../src/constants'

jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  createDefaultInstanceFromType: jest.fn(),
}))

const mockCreateDefaultInstanceFromType = jest.mocked(adapterUtils).createDefaultInstanceFromType

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
  let mockDefaultInstanceFromTypeResult: InstanceElement

  const createMockOptionsInstance = (value: SalesforceConfigOptionsType): InstanceElement =>
    new InstanceElement('options', optionsType, value)

  beforeEach(() => {
    jest.clearAllMocks()
    mockDefaultInstanceFromTypeResult = new InstanceElement('mock name', configType, {
      fetch: {
        metadata: {
          exclude: [],
        },
      },
    })
    mockCreateDefaultInstanceFromType.mockResolvedValue(mockDefaultInstanceFromTypeResult)
  })

  describe('when input contains cpq equal true', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ cpq: true })
      resultConfig = await getConfig(options)
    })
    it('should return adapter config with cpq', async () => {
      expect(resultConfig.value.fetch.data).toBeDefined()
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input contains managed packages', () => {
    describe('when managed packages include CPQ', () => {
      it('should return adapter config with cpq', async () => {
        options = createMockOptionsInstance({
          managedPackages: ['sbaa, SBQQ (CPQ)'],
        })
        expect((await getConfig(options)).value.fetch.data).toBeDefined()
        expect(mockLogError).not.toHaveBeenCalled()
      })
    })
  })

  describe('when input has manageProfilesAndPermissionSets', () => {
    const getExcludedTypesFromConfig = (instance: InstanceElement): string[] =>
      instance.value.fetch.metadata.exclude.map((entry: MetadataInstance) => entry.metadataType)
    describe('without CPQ', () => {
      it('should exclude Profiles and PermissionSets when value is false', async () => {
        const configInstance = await getConfig(createMockOptionsInstance({ manageProfilesAndPermissionSets: false }))
        expect(getExcludedTypesFromConfig(configInstance)).toIncludeMultiple([
          PROFILE_METADATA_TYPE,
          PERMISSION_SET_METADATA_TYPE,
          MUTING_PERMISSION_SET_METADATA_TYPE,
        ])
      })
      it('should include Profiles and PermissionSets when value is true', async () => {
        const configInstance = await getConfig(createMockOptionsInstance({ manageProfilesAndPermissionSets: true }))
        expect(getExcludedTypesFromConfig(configInstance)).not.toIncludeAnyMembers([
          PROFILE_METADATA_TYPE,
          PERMISSION_SET_METADATA_TYPE,
          MUTING_PERMISSION_SET_METADATA_TYPE,
        ])
      })
    })
    describe('with CPQ', () => {
      it('should exclude Profiles and PermissionSets when value is false', async () => {
        const configInstance = await getConfig(
          createMockOptionsInstance({ manageProfilesAndPermissionSets: false, managedPackages: ['sbaa, SBQQ (CPQ)'] }),
        )
        expect(getExcludedTypesFromConfig(configInstance)).toIncludeMultiple([
          PROFILE_METADATA_TYPE,
          PERMISSION_SET_METADATA_TYPE,
          MUTING_PERMISSION_SET_METADATA_TYPE,
        ])
      })
      it('should include Profiles and PermissionSets when value is true', async () => {
        const configInstance = await getConfig(
          createMockOptionsInstance({ manageProfilesAndPermissionSets: true, managedPackages: ['sbaa, SBQQ (CPQ)'] }),
        )
        expect(getExcludedTypesFromConfig(configInstance)).not.toIncludeAnyMembers([
          PROFILE_METADATA_TYPE,
          PERMISSION_SET_METADATA_TYPE,
          MUTING_PERMISSION_SET_METADATA_TYPE,
        ])
      })
    })
  })

  describe('when input contains cpq equal false', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ cpq: false })
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input does not contain cpq', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({})
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input is not a valid optionsType', () => {
    beforeEach(async () => {
      const differentObjType = new ObjectType({
        elemID: new ElemID('mock'),
      })
      options = new InstanceElement('options', differentObjType, { cpq: true })
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type and log error', async () => {
      expect(mockCreateDefaultInstanceFromType).toHaveBeenCalledWith(ElemID.CONFIG_NAME, configType)
      expect(resultConfig).toEqual(mockDefaultInstanceFromTypeResult)
      expect(mockLogError).toHaveBeenCalledWith(
        `Received an invalid instance for config options. Received instance with refType ElemId full name: ${options?.refType.elemID.getFullName()}`,
      )
    })
  })
})
