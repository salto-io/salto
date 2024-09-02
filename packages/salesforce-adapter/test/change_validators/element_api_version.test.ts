/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { ORGANIZATION_API_VERSION, ORGANIZATION_SETTINGS, SALESFORCE } from '../../src/constants'
import { LATEST_SUPPORTED_API_VERSION_FIELD } from '../../src/filters/organization_settings'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import elementApiVersionValidator from '../../src/change_validators/element_api_version'

describe('Element API version Change Validator', () => {
  let elementsSource: ReadOnlyElementsSource

  const flowWithApiVersion = (apiVersion: number): InstanceElement =>
    createInstanceElement({ fullName: 'flow1', apiVersion }, mockTypes.Flow)

  describe('with latest supported API version in Organization Settings', () => {
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([
        new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({
            elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
          }),
          {
            [LATEST_SUPPORTED_API_VERSION_FIELD]: 50,
          },
        ),
      ])
    })

    it('should return no errors for valid elements', async () => {
      const change = toChange({
        before: flowWithApiVersion(40),
        after: flowWithApiVersion(50),
      })
      const errors = await elementApiVersionValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })

    it('should return an error with unsupported API version', async () => {
      const flow = flowWithApiVersion(51)
      const change = toChange({
        after: flow,
      })
      const errors = await elementApiVersionValidator([change], elementsSource)
      expect(errors).toEqual([
        expect.objectContaining({
          elemID: flow.elemID,
          severity: 'Error',
          detailedMessage: expect.stringContaining('50') && expect.stringContaining('51'),
        }),
      ])
    })
  })

  describe('with missing elements source', () => {
    it('should return no errors', async () => {
      const change = toChange({
        after: flowWithApiVersion(51),
      })
      const errors = await elementApiVersionValidator([change])
      expect(errors).toBeEmpty()
    })
  })

  describe('with empty elements source', () => {
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([])
    })

    it('should return no errors', async () => {
      const change = toChange({
        after: flowWithApiVersion(51),
      })
      const errors = await elementApiVersionValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })
  })

  describe('with Organization Settings with no API version', () => {
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([
        new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({
            elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
          }),
          {},
        ),
      ])
    })

    it('should return no errors', async () => {
      const change = toChange({
        after: flowWithApiVersion(51),
      })
      const errors = await elementApiVersionValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })
  })

  describe('with Organization Settings with invalid API version', () => {
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([
        new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({
            elemID: new ElemID(SALESFORCE, ORGANIZATION_SETTINGS),
          }),
          {
            [LATEST_SUPPORTED_API_VERSION_FIELD]: 'fifty',
          },
        ),
      ])
    })

    it('should return no errors', async () => {
      const change = toChange({
        after: flowWithApiVersion(51),
      })
      const errors = await elementApiVersionValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })
  })

  describe('with Organization API version with latest supported API version', () => {
    beforeEach(() => {
      elementsSource = buildElementsSourceFromElements([
        new InstanceElement(
          ElemID.CONFIG_NAME,
          new ObjectType({
            elemID: new ElemID(SALESFORCE, ORGANIZATION_API_VERSION),
          }),
          {
            [LATEST_SUPPORTED_API_VERSION_FIELD]: 50,
          },
        ),
      ])
    })

    it('should return no errors for valid elements', async () => {
      const change = toChange({
        before: flowWithApiVersion(40),
        after: flowWithApiVersion(50),
      })
      const errors = await elementApiVersionValidator([change], elementsSource)
      expect(errors).toBeEmpty()
    })

    it('should return an error with unsupported API version', async () => {
      const flow = flowWithApiVersion(51)
      const change = toChange({
        after: flow,
      })
      const errors = await elementApiVersionValidator([change], elementsSource)
      expect(errors).toEqual([
        expect.objectContaining({
          elemID: flow.elemID,
          severity: 'Error',
          detailedMessage: expect.stringContaining('50') && expect.stringContaining('51'),
        }),
      ])
    })
  })
})
