/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, Change, ListType, toChange } from '@salto-io/adapter-api'
import flexiPageUnusedOrMissingFacets from '../../src/change_validators/flexi_page_unused_or_missing_facets'
import {
  createInstanceElement,
  createMetadataObjectType,
  MetadataInstanceElement,
  MetadataObjectType,
} from '../../src/transformers/transformer'
import {
  COMPONENT_INSTANCE,
  COMPONENT_INSTANCE_FILED_NAMES,
  COMPONENT_INSTANCE_PROPERTY,
  COMPONENT_INSTANCE_PROPERTY_FILED_NAMES,
  FLEXI_PAGE_FIELD_NAMES,
  FLEXI_PAGE_REGION,
  FLEXI_PAGE_REGION_FIELD_NAMES,
  FLEXI_PAGE_TYPE,
  ITEM_INSTANCE,
  PAGE_REGION_TYPE_VALUES,
} from '../../src/constants'

describe('changeValidator', () => {
  let flexiPageChange: Change
  let ComponentInstanceProperty: MetadataObjectType
  let ComponentInstance: MetadataObjectType
  let itemInstance: MetadataObjectType
  let flexiPageRegion: MetadataObjectType
  let flexiPage: MetadataObjectType

  beforeEach(() => {
    ComponentInstanceProperty = createMetadataObjectType({
      annotations: {
        metadataType: COMPONENT_INSTANCE_PROPERTY,
      },
      fields: {
        [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: { refType: BuiltinTypes.STRING },
      },
    })
    ComponentInstance = createMetadataObjectType({
      annotations: {
        metadataType: COMPONENT_INSTANCE,
      },
      fields: {
        [COMPONENT_INSTANCE_FILED_NAMES.COMPONENT_INSTANCE_PROPERTIES]: {
          refType: new ListType(ComponentInstanceProperty),
        },
      },
    })
    itemInstance = createMetadataObjectType({
      annotations: {
        metadataType: ITEM_INSTANCE,
      },
      fields: {
        [COMPONENT_INSTANCE_FILED_NAMES.COMPONENT_INSTANCE_PROPERTIES]: {
          refType: new ListType(ComponentInstanceProperty),
        },
      },
    })
    flexiPageRegion = createMetadataObjectType({
      annotations: {
        metadataType: FLEXI_PAGE_REGION,
      },
      fields: {
        [FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES]: { refType: new ListType(ComponentInstance) },
        [FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES]: { refType: new ListType(itemInstance) },
        [FLEXI_PAGE_REGION_FIELD_NAMES.NAME]: { refType: BuiltinTypes.STRING },
        [FLEXI_PAGE_REGION_FIELD_NAMES.TYPE]: { refType: BuiltinTypes.STRING },
      },
    })
    flexiPage = createMetadataObjectType({
      annotations: {
        metadataType: FLEXI_PAGE_TYPE,
      },
      fields: {
        [FLEXI_PAGE_FIELD_NAMES.FLEXI_PAGE_REGIONS]: { refType: new ListType(flexiPageRegion) },
      },
    })
  })

  describe('when all facets are defined and referenced', () => {
    beforeEach(() => {
      const flexiPageInstance = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              [FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'Facet-Facet2' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES]: [],
              [FLEXI_PAGE_REGION_FIELD_NAMES.NAME]: 'Facet-Facet1',
              [FLEXI_PAGE_REGION_FIELD_NAMES.TYPE]: PAGE_REGION_TYPE_VALUES.FACET,
            },
            {
              [FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES]: [],
              [FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'Facet-Facet1' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.NAME]: 'Facet-Facet2',
              [FLEXI_PAGE_REGION_FIELD_NAMES.TYPE]: PAGE_REGION_TYPE_VALUES.FACET,
            },
          ],
        },
        flexiPage,
      )
      flexiPageChange = toChange({ after: flexiPageInstance })
    })

    it('should not return any errors', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toBeEmpty()
    })
  })

  describe('when there are references to missing facets', () => {
    let flexiPageInstance: MetadataInstanceElement
    beforeEach(() => {
      flexiPageInstance = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              [FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'Facet-Facet2' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES]: [],
              [FLEXI_PAGE_REGION_FIELD_NAMES.NAME]: 'Facet-Facet1',
              [FLEXI_PAGE_REGION_FIELD_NAMES.TYPE]: PAGE_REGION_TYPE_VALUES.FACET,
            },
            {
              [FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'Facet-MissingFacet' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'Facet-Facet1' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.NAME]: 'Facet-Facet2',
              [FLEXI_PAGE_REGION_FIELD_NAMES.TYPE]: PAGE_REGION_TYPE_VALUES.FACET,
            },
          ],
        },
        flexiPage,
      )
      flexiPageChange = toChange({ after: flexiPageInstance })
    })

    it('should return an error for the missing facet reference', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toEqual([
        {
          severity: 'Warning',
          message: 'Reference to missing Facet',
          detailedMessage: `The Facet "${'Facet-MissingFacet'}" does not exist.`,
          elemID: flexiPageInstance.elemID.createNestedID(
            FLEXI_PAGE_FIELD_NAMES.FLEXI_PAGE_REGIONS,
            '1',
            FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES,
            '0',
            COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE,
          ),
        },
      ])
    })
  })

  describe('when there are unused facets', () => {
    let flexiPageInstance: MetadataInstanceElement
    beforeEach(() => {
      flexiPageInstance = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              [FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'NotAFacet' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES]: [],
              [FLEXI_PAGE_REGION_FIELD_NAMES.NAME]: 'Facet-UnusedFacet',
              [FLEXI_PAGE_REGION_FIELD_NAMES.TYPE]: PAGE_REGION_TYPE_VALUES.FACET,
            },
          ],
        },
        flexiPage,
      )
      flexiPageChange = toChange({ after: flexiPageInstance })
    })

    it('should return an error for the unused facet', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toEqual([
        {
          severity: 'Warning',
          message: 'Unused Facet',
          detailedMessage: `The Facet "${'Facet-UnusedFacet'}" isn’t being used in the ${FLEXI_PAGE_TYPE}.`,
          elemID: flexiPageInstance.elemID.createNestedID(FLEXI_PAGE_FIELD_NAMES.FLEXI_PAGE_REGIONS, '0'),
        },
      ])
    })
  })

  describe('when there are multiple errors in one FlexiPage', () => {
    let flexiPageInstance: MetadataInstanceElement
    beforeEach(() => {
      flexiPageInstance = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              [FLEXI_PAGE_REGION_FIELD_NAMES.COMPONENT_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'NotAFacet' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES]: [
                { [COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE]: 'Facet-MissingFacet' },
              ],
              [FLEXI_PAGE_REGION_FIELD_NAMES.NAME]: 'Facet-UnusedFacet',
              [FLEXI_PAGE_REGION_FIELD_NAMES.TYPE]: PAGE_REGION_TYPE_VALUES.FACET,
            },
          ],
        },
        flexiPage,
      )
      flexiPageChange = toChange({ after: flexiPageInstance })
    })

    it('should create errors for both unused facets and missing references', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toEqual([
        {
          severity: 'Warning',
          message: 'Unused Facet',
          detailedMessage: `The Facet "${'Facet-UnusedFacet'}" isn’t being used in the ${FLEXI_PAGE_TYPE}.`,
          elemID: flexiPageInstance.elemID.createNestedID(FLEXI_PAGE_FIELD_NAMES.FLEXI_PAGE_REGIONS, '0'),
        },
        {
          severity: 'Warning',
          message: 'Reference to missing Facet',
          detailedMessage: `The Facet "${'Facet-MissingFacet'}" does not exist.`,
          elemID: flexiPageInstance.elemID.createNestedID(
            FLEXI_PAGE_FIELD_NAMES.FLEXI_PAGE_REGIONS,
            '0',
            FLEXI_PAGE_REGION_FIELD_NAMES.ITEM_INSTANCES,
            '0',
            COMPONENT_INSTANCE_PROPERTY_FILED_NAMES.VALUE,
          ),
        },
      ])
    })
  })
})
