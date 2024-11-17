/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, isInstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/settings_types'
import { INSTANCE_FULL_NAME_FIELD, RECORDS_PATH, SALESFORCE, SETTINGS_DIR_NAME } from '../../src/constants'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { createMetadataTypeElement, defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'

describe('Test Settings Types', () => {
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

  describe('on fetch', () => {
    let filter: FilterWith<'onFetch'>
    let elements: Element[]

    beforeEach(() => {
      filter = filterCreator({
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
    })

    describe('when all settings instances have matching types', () => {
      let types: Element[]
      let beforeInstances: InstanceElement[]

      beforeEach(async () => {
        types = [createSettingsType('AccountSettings'), createSettingsType('CompanySettings')]
        beforeInstances = [createSettingsInstance('Account'), createSettingsInstance('Company')]
        elements = types.concat(beforeInstances)
        await filter.onFetch(elements)
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

    describe('when optional feature is disabled', () => {
      let types: Element[]
      let beforeInstances: InstanceElement[]

      beforeEach(async () => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                optionalFeatures: {
                  retrieveSettings: false,
                },
              },
            }),
          },
        }) as FilterWith<'onFetch'>
        types = [createSettingsType('AccountSettings'), createSettingsType('CompanySettings')]
        beforeInstances = [createSettingsInstance('Account'), createSettingsInstance('Company')]
        elements = types.concat(beforeInstances)
        await filter.onFetch(elements)
      })

      it('should leave all element unchanged', () => {
        expect(elements).toEqual(types.concat(beforeInstances))
      })
    })
  })
})
