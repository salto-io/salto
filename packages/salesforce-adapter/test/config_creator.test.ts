/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { configType, MetadataInstance } from '../src/types'
import { optionsType, getConfig, SalesforceConfigOptionsType } from '../src/config_creator'
import {
  MUTING_PERMISSION_SET_METADATA_TYPE,
  PERMISSION_SET_GROUP_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from '../src/constants'

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

  const createMockOptionsInstance = (value: SalesforceConfigOptionsType): InstanceElement =>
    new InstanceElement('options', optionsType, value)
  const getClonedDefaultConfig = async (): Promise<InstanceElement> => {
    const conf = (await createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType)).clone()
    conf.value.fetch.metadata.exclude.push(
      ...[
        { metadataType: PROFILE_METADATA_TYPE },
        { metadataType: PERMISSION_SET_METADATA_TYPE },
        { metadataType: MUTING_PERMISSION_SET_METADATA_TYPE },
        { metadataType: PERMISSION_SET_GROUP_METADATA_TYPE },
      ],
    )
    return conf
  }

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
        expect(resultConfig.value.fetch.data).toBeDefined()
        expect(mockLogError).not.toHaveBeenCalled()
      })
    })
  })

  describe('when input contains manageProfiles or managePermissionSets equal true', () => {
    const getExcludedTypesFromConfig = (instance: InstanceElement): string[] =>
      instance.value.fetch.metadata.exclude.map((entry: MetadataInstance) => entry.metadataType)
    describe('without cpq', () => {
      describe('when manageProfiles=true and managePermissionSets=true', () => {
        it('should not exclude Profiles, PermissionSets, PermissionSetGroups and MutingPermissionSets', async () => {
          const configInstance = await getConfig(
            createMockOptionsInstance({ manageProfiles: true, managePermissionSets: true }),
          )
          expect(getExcludedTypesFromConfig(configInstance)).not.toIncludeAnyMembers([
            PROFILE_METADATA_TYPE,
            PERMISSION_SET_METADATA_TYPE,
            MUTING_PERMISSION_SET_METADATA_TYPE,
            PERMISSION_SET_GROUP_METADATA_TYPE,
          ])
          expect(mockLogError).not.toHaveBeenCalled()
        })
      })
      describe('when manageProfiles=true and managePermissionSets=false', () => {
        it('should exclude PermissionSets, PermissionSetGroups and MutingPermissionSets and not exclude Profiles', async () => {
          const configInstance = await getConfig(
            createMockOptionsInstance({ manageProfiles: true, managePermissionSets: false }),
          )
          expect(getExcludedTypesFromConfig(configInstance)).toIncludeAllMembers([
            PERMISSION_SET_METADATA_TYPE,
            MUTING_PERMISSION_SET_METADATA_TYPE,
            PERMISSION_SET_GROUP_METADATA_TYPE,
          ])
          expect(getExcludedTypesFromConfig(configInstance)).not.toInclude(PROFILE_METADATA_TYPE)
          expect(mockLogError).not.toHaveBeenCalled()
        })
      })
    })
    describe('with cpq', () => {
      describe('when manageProfiles=false and managePermissionSets=true', () => {
        it('should not exclude PermissionSets, PermissionSetGroups and MutingPermissionSets and exclude Profiles', async () => {
          const configInstance = await getConfig(
            createMockOptionsInstance({
              manageProfiles: false,
              managePermissionSets: true,
              managedPackages: ['sbaa, SBQQ (CPQ)'],
            }),
          )
          expect(getExcludedTypesFromConfig(configInstance)).not.toIncludeAnyMembers([
            PERMISSION_SET_METADATA_TYPE,
            MUTING_PERMISSION_SET_METADATA_TYPE,
            PERMISSION_SET_GROUP_METADATA_TYPE,
          ])
          expect(getExcludedTypesFromConfig(configInstance)).toInclude(PROFILE_METADATA_TYPE)
          expect(mockLogError).not.toHaveBeenCalled()
        })
      })
      describe('when manageProfiles=false and managePermissionSets=false', () => {
        it('should not exclude Profiles, PermissionSets, PermissionSetGroups and MutingPermissionSets', async () => {
          const configInstance = await getConfig(
            createMockOptionsInstance({
              manageProfiles: false,
              managePermissionSets: false,
              managedPackages: ['sbaa, SBQQ (CPQ)'],
            }),
          )
          expect(getExcludedTypesFromConfig(configInstance)).toIncludeAllMembers([
            PROFILE_METADATA_TYPE,
            PERMISSION_SET_METADATA_TYPE,
            MUTING_PERMISSION_SET_METADATA_TYPE,
            PERMISSION_SET_GROUP_METADATA_TYPE,
          ])
          expect(mockLogError).not.toHaveBeenCalled()
        })
      })
    })
  })

  describe('when input contains cpq equal false', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({ cpq: false })
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type', async () => {
      expect(resultConfig).toMatchObject(await getClonedDefaultConfig())
      expect(mockLogError).not.toHaveBeenCalled()
    })
  })

  describe('when input does not contain cpq', () => {
    beforeEach(async () => {
      options = createMockOptionsInstance({})
      resultConfig = await getConfig(options)
    })
    it('should create default instance from type', async () => {
      expect(resultConfig).toMatchObject(await getClonedDefaultConfig())
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
      expect(resultConfig).toMatchObject(await getClonedDefaultConfig())
      expect(mockLogError).toHaveBeenCalledWith(
        `Received an invalid instance for config options. Received instance with refType ElemId full name: ${options?.refType.elemID.getFullName()}`,
      )
    })
  })
})
