/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, isInstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/settings_types'
import {
  INSTANCE_FULL_NAME_FIELD,
  METADATA_TYPE,
  RECORDS_PATH,
  SALESFORCE,
  SETTINGS_DIR_NAME,
} from '../../src/constants'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { createMetadataTypeElement, defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'

const createSettingsType = (name: string): ObjectType =>
  createMetadataTypeElement(name, {
    annotations: {
      dirName: SETTINGS_DIR_NAME,
    },
  })

const createSettingsInstance = (name: string): InstanceElement =>
  new InstanceElement(
    name,
    mockTypes.Settings,
    {
      [INSTANCE_FULL_NAME_FIELD]: name,
    },
    [SALESFORCE, RECORDS_PATH, SETTINGS_DIR_NAME, name],
  )

describe('Test Settings Types', () => {
  const filter = filterCreator({
    config: {
      ...defaultFilterContext,
      fetchProfile: buildFetchProfile({
        fetchParams: {
          optionalFeatures: {
            retrieveSettings: true,
          },
        },
      }),
    },
  }) as FilterWith<'onFetch'>

  describe('on fetch', () => {
    let elements: Element[]

    describe('when all settings instances have matching types', () => {
      let types: ObjectType[]
      let beforeInstances: InstanceElement[]

      beforeEach(async () => {
        types = [createSettingsType('AccountSettings'), createSettingsType('CompanySettings')]
        beforeInstances = [createSettingsInstance('Account'), createSettingsInstance('Company')]
        elements = (types as Element[]).concat(beforeInstances)
        await filter.onFetch(elements)
      })

      it('should include all settings types', () => {
        expect(elements).toIncludeAllMembers(types)
      })

      it('should map all settings instances to the matching type', () => {
        expect(elements.filter(isInstanceElement).map(instance => instance.getTypeSync())).toEqual(types)
      })
    })

    describe('when settings types are missing', () => {
      beforeEach(async () => {
        elements = [createSettingsInstance('Account'), createSettingsInstance('Company')]
        await filter.onFetch(elements)
      })

      it('should drop the settings instances', () => {
        expect(elements).toBeEmpty()
      })
    })

    describe('when settings type is missing an api name', () => {
      let settingsType: ObjectType

      beforeEach(async () => {
        settingsType = createSettingsType('AccountSettings')
        delete settingsType.annotations[METADATA_TYPE]
        elements = [settingsType, createSettingsInstance('Account')]
        await filter.onFetch(elements)
      })

      it('should drop the settings instance', () => {
        expect(elements).toEqual([settingsType])
      })
    })
  })
})
