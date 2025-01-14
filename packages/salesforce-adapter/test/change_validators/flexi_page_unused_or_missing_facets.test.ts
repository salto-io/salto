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
import { FLEXI_PAGE_TYPE } from '../../src/constants'

describe('changeValidator', () => {
  let flexiPageChange: Change
  let ComponentInstanceProperty: MetadataObjectType
  let ComponentInstance: MetadataObjectType
  let ItemInstance: MetadataObjectType
  let FlexiPageRegion: MetadataObjectType
  let FlexiPage: MetadataObjectType

  beforeEach(() => {
    ComponentInstanceProperty = createMetadataObjectType({
      annotations: {
        metadataType: 'ComponentInstanceProperty',
      },
      fields: {
        value: { refType: BuiltinTypes.STRING },
      },
    })
    ComponentInstance = createMetadataObjectType({
      annotations: {
        metadataType: 'ComponentInstance',
      },
      fields: {
        componentInstanceProperties: { refType: new ListType(ComponentInstanceProperty) },
      },
    })
    ItemInstance = createMetadataObjectType({
      annotations: {
        metadataType: 'ItemInstance',
      },
      fields: {
        componentInstanceProperties: { refType: new ListType(ComponentInstanceProperty) },
      },
    })
    FlexiPageRegion = createMetadataObjectType({
      annotations: {
        metadataType: 'FlexiPageRegion',
      },
      fields: {
        componenetInstances: { refType: new ListType(ComponentInstance) },
        itemInstances: { refType: new ListType(ItemInstance) },
        name: { refType: BuiltinTypes.STRING },
        type: { refType: BuiltinTypes.STRING },
      },
    })
    FlexiPage = createMetadataObjectType({
      annotations: {
        metadataType: FLEXI_PAGE_TYPE,
      },
      fields: {
        flexiPageRegions: { refType: new ListType(FlexiPageRegion) },
      },
    })
  })

  describe('when all facets are defined and referenced', () => {
    beforeEach(() => {
      const flexiPage = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              componenetInstances: [{ value: 'Facet-Facet2' }],
              itemInstances: [],
              name: 'Facet-Facet1',
              type: 'Facet',
            },
            {
              componenetInstances: [],
              itemInstances: [{ value: 'Facet-Facet1' }],
              name: 'Facet-Facet2',
              type: 'Facet',
            },
          ],
        },
        FlexiPage,
      )
      flexiPageChange = toChange({ after: flexiPage })
    })

    it('should not return any errors', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toBeEmpty()
    })
  })

  describe('when there are references to missing facets', () => {
    let flexiPage: MetadataInstanceElement
    beforeEach(() => {
      flexiPage = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              componenetInstances: [{ value: 'Facet-Facet2' }],
              itemInstances: [],
              name: 'Facet-Facet1',
              type: 'Facet',
            },
            {
              componenetInstances: [{ value: 'Facet-MissingFacet' }],
              itemInstances: [{ value: 'Facet-Facet1' }],
              name: 'Facet-Facet2',
              type: 'Facet',
            },
          ],
        },
        FlexiPage,
      )
      flexiPageChange = toChange({ after: flexiPage })
    })

    it('should return an error for the missing facet reference', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toEqual([
        {
          severity: 'Warning',
          message: 'Reference to missing Facet',
          detailedMessage: `The Facet "${'Facet-MissingFacet'}" does not exist.`,
          elemID: flexiPage.elemID.createNestedID('flexiPageRegions', '1', 'componenetInstances', '0', 'value'),
        },
      ])
    })
  })

  describe('when there are unused facets', () => {
    let flexiPage: MetadataInstanceElement
    beforeEach(() => {
      flexiPage = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              componenetInstances: [{ value: 'NotAFacet' }],
              itemInstances: [],
              name: 'Facet-UnusedFacet',
              type: 'Facet',
            },
          ],
        },
        FlexiPage,
      )
      flexiPageChange = toChange({ after: flexiPage })
    })

    it('should return an error for the unused facet', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toEqual([
        {
          severity: 'Warning',
          message: 'Unused Facet',
          detailedMessage: `The Facet "${'Facet-UnusedFacet'}" isn’t being used in the Flow.`,
          elemID: flexiPage.elemID.createNestedID('flexiPageRegions', '0'),
        },
      ])
    })
  })

  describe('when there are multiple errors in one FlexiPage', () => {
    let flexiPage: MetadataInstanceElement
    beforeEach(() => {
      flexiPage = createInstanceElement(
        {
          fullName: 'TestFlexiPage',
          flexiPageRegions: [
            {
              componenetInstances: [{ value: 'NotAFacet' }],
              itemInstances: [{ value: 'Facet-MissingFacet' }],
              name: 'Facet-UnusedFacet',
              type: 'Facet',
            },
          ],
        },
        FlexiPage,
      )
      flexiPageChange = toChange({ after: flexiPage })
    })

    it('should create errors for both unused facets and missing references', async () => {
      const errors = await flexiPageUnusedOrMissingFacets([flexiPageChange])
      expect(errors).toEqual([
        {
          severity: 'Warning',
          message: 'Unused Facet',
          detailedMessage: `The Facet "${'Facet-UnusedFacet'}" isn’t being used in the Flow.`,
          elemID: flexiPage.elemID.createNestedID('flexiPageRegions', '0'),
        },
        {
          severity: 'Warning',
          message: 'Reference to missing Facet',
          detailedMessage: `The Facet "${'Facet-MissingFacet'}" does not exist.`,
          elemID: flexiPage.elemID.createNestedID('flexiPageRegions', '0', 'itemInstances', '0', 'value'),
        },
      ])
    })
  })
})
