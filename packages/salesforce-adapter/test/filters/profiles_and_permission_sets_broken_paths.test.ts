/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, isInstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/profiles_and_permission_sets_broken_paths'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'
import { ArtificialTypes, INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { ProfileSection } from '../../src/types'

describe('Profiles and PermissionSets broken paths filter', () => {
  let filter: FilterWith<'onFetch'>
  let elementsSource: ReadOnlyElementsSource
  let fetchedApexClass: InstanceElement
  let existingApexClass: InstanceElement
  let instance: InstanceElement

  describe('onFetch', () => {
    beforeEach(() => {
      fetchedApexClass = new InstanceElement('FetchedClass', mockTypes.ApexClass, {
        [INSTANCE_FULL_NAME_FIELD]: 'FetchedClass',
      })
      existingApexClass = new InstanceElement('ExistingApexClass', mockTypes.ApexClass, {
        [INSTANCE_FULL_NAME_FIELD]: 'ExistingApexClass',
      })
      instance = new InstanceElement('TestInstance', mockTypes.Profile, {
        [INSTANCE_FULL_NAME_FIELD]: 'TestInstance',
        [ProfileSection.ClassAccesses]: {
          FetchedClass: {
            apexClass: 'FetchedClass',
            enabled: true,
          },
          ExistingApexClass: {
            apexClass: 'ExistingApexClass',
            enabled: true,
          },
          BrokenApexClass: {
            apexClass: 'BrokenApexClass',
            enabled: true,
          },
        },
      })
    })
    describe('when feature is enabled', () => {
      describe('when ProfilesAndPermissionSetsBrokenPaths instance is in the ElementsSource', () => {
        beforeEach(() => {
          const brokenPathsInstance = new InstanceElement(
            ElemID.CONFIG_NAME,
            ArtificialTypes.ProfilesAndPermissionSetsBrokenPaths,
            {
              paths: ['classAccesses.SomeApexClass'],
            },
          )
          elementsSource = buildElementsSourceFromElements([existingApexClass, brokenPathsInstance])
        })
        describe('when fetch is full', () => {
          beforeEach(() => {
            filter = filterCreator({
              config: {
                ...defaultFilterContext,
                elementsSource,
                fetchProfile: buildFetchProfile({
                  fetchParams: {},
                }),
              },
            }) as typeof filter
          })
          it('should override broken paths with the new ones', async () => {
            const fetchElements = [instance, fetchedApexClass, existingApexClass]
            await filter.onFetch(fetchElements)
            const brokenPathsInstance = fetchElements
              .filter(isInstanceElement)
              .find(e => e.getTypeSync() === ArtificialTypes.ProfilesAndPermissionSetsBrokenPaths) as InstanceElement
            expect(brokenPathsInstance).toBeDefined()
            expect(brokenPathsInstance.value).toEqual({ paths: ['classAccesses.BrokenApexClass'] })
          })
        })
        describe('when fetch is partial', () => {
          beforeEach(() => {
            filter = filterCreator({
              config: {
                ...defaultFilterContext,
                elementsSource,
                fetchProfile: buildFetchProfile({
                  fetchParams: {
                    target: ['ApexClass'],
                  },
                }),
              },
            }) as typeof filter
          })
          it('should merge existing broken paths with the new ones', async () => {
            const fetchElements = [instance, fetchedApexClass]
            await filter.onFetch(fetchElements)
            const brokenPathsInstance = fetchElements
              .filter(isInstanceElement)
              .find(e => e.getTypeSync() === ArtificialTypes.ProfilesAndPermissionSetsBrokenPaths) as InstanceElement
            expect(brokenPathsInstance).toBeDefined()
            expect(brokenPathsInstance.value).toEqual({
              paths: ['classAccesses.BrokenApexClass', 'classAccesses.SomeApexClass'],
            })
          })
        })
      })
    })
  })
})
