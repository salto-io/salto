/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/fetch_targets'
import { FilterWith } from './mocks'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { createMetadataObjectType, Types } from '../../src/transformers/transformer'
import {
  APEX_CLASS_METADATA_TYPE,
  ArtificialTypes,
  CUSTOM_OBJECT,
  FIELD_ANNOTATIONS,
  SALESFORCE,
  SUBTYPES_PATH,
  TYPES_PATH,
} from '../../src/constants'
import { mockTypes } from '../mock_elements'

describe('fetch targets filter', () => {
  let filter: FilterWith<'onFetch'>
  describe('onFetch', () => {
    const CUSTOM_OBJECT_NAME = 'CustomObject__c'
    const CUSTOM_OBJECT_WITH_LOOKUP_NAME = 'CustomObjectWithLookup__c'
    let elements: Element[]
    beforeEach(() => {
      const customObjectType = createCustomObjectType(CUSTOM_OBJECT_NAME, {})
      const customObjectTypeWithLookup = createCustomObjectType(CUSTOM_OBJECT_WITH_LOOKUP_NAME, {
        fields: {
          LookupField__c: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [CUSTOM_OBJECT_NAME],
            },
          },
          // Make sure we store unique refTo lookups in the singleton
          AnotherLookupField__c: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [CUSTOM_OBJECT_NAME],
            },
          },
          MultipleRefToLookupField__c: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [FIELD_ANNOTATIONS.REFERENCE_TO]: ['Account', 'Contact'],
            },
          },
        },
      })
      // Make sure subtypes are not included in the fetch targets
      const mockSubtype = createMetadataObjectType({
        annotations: { metadataType: 'mockSubtype' },
        path: [SALESFORCE, TYPES_PATH, SUBTYPES_PATH, 'mockSubtype'],
      })
      elements = [customObjectType, customObjectTypeWithLookup, mockTypes.ApexClass, mockSubtype]
    })
    describe('when feature is enabled', () => {
      describe('when fetch is full', () => {
        beforeEach(() => {
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({ fetchParams: { optionalFeatures: { extendFetchTargets: true } } }),
            },
          }) as typeof filter
        })

        it('should create a fetch targets instance with correct values', async () => {
          await filter.onFetch(elements)
          const fetchTargetsInstance = elements
            .filter(isInstanceElement)
            .find(e => e.getTypeSync() === ArtificialTypes.FetchTargets) as InstanceElement
          expect(fetchTargetsInstance).toBeDefined()
          expect(fetchTargetsInstance.value).toEqual({
            metadataTypes: [CUSTOM_OBJECT, APEX_CLASS_METADATA_TYPE],
            customObjects: [CUSTOM_OBJECT_NAME, CUSTOM_OBJECT_WITH_LOOKUP_NAME],
            customObjectsLookups: {
              [CUSTOM_OBJECT_WITH_LOOKUP_NAME]: [CUSTOM_OBJECT_NAME, 'Account', 'Contact'],
            },
          })
        })
      })

      describe('when fetch is partial', () => {
        beforeEach(() => {
          filter = filterCreator({
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: { target: [], optionalFeatures: { extendFetchTargets: true } },
              }),
            },
          }) as typeof filter
        })

        it('should not create a fetch targets instance', async () => {
          await filter.onFetch(elements)
          const fetchTargetsInstance = elements
            .filter(isInstanceElement)
            .find(e => e.getTypeSync() === ArtificialTypes.FetchTargets)
          expect(fetchTargetsInstance).toBeUndefined()
        })
      })
    })
    describe('when feature is disabled', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({ fetchParams: { optionalFeatures: { extendFetchTargets: false } } }),
          },
        }) as typeof filter
      })
      it('should not create a fetch targets instance', async () => {
        await filter.onFetch(elements)
        const fetchTargetsInstance = elements
          .filter(isInstanceElement)
          .find(e => e.getTypeSync() === ArtificialTypes.FetchTargets)
        expect(fetchTargetsInstance).toBeUndefined()
      })
    })
  })
})
