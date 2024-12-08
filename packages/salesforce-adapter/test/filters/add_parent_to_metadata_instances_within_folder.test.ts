/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Element } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/add_parent_to_metadata_instances_within_folder'
import { defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('addParentToMetadataInstancesWithinFolder filter', () => {
  let elements: Element[]

  const types = [
    {
      type: mockTypes.EmailTemplate,
      annotations: { isAnnotated: true },
      values: { fullName: 'root/second/third/mockedEmailTemplateFolder/mockedEmailTemplate' },
    },
    {
      type: mockTypes.EmailFolder,
      values: { fullName: 'mockedEmailTemplateFolder' },
    },
    {
      type: mockTypes.Report,
      values: { fullName: 'root/second/third/mockedReportFolder/mockedReport' },
    },
    {
      type: mockTypes.ReportFolder,
      values: { fullName: 'mockedReportFolder' },
    },
    {
      type: mockTypes.Document,
      values: { fullName: 'root/second/third/mockedDocumentFolder/mockedDocument' },
    },
    {
      type: mockTypes.DocumentFolder,
      values: { fullName: 'mockedDocumentFolder' },
    },
    {
      type: mockTypes.Dashboard,
      values: { fullName: 'root/second/third/mockedDashboardFolder/mockedDashboard' },
    },
    {
      type: mockTypes.DashboardFolder,
      values: { fullName: 'mockedDashboardFolder' },
    },
  ]

  let filter: FilterWith<'onFetch'>

  beforeEach(() => {
    elements = []
    types.forEach(({ values, type }) => elements.push(createInstanceElement(values, type)))
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({ fetchParams: { target: [] } }),
        elementsSource: buildElementsSourceFromElements(elements),
      },
    }) as typeof filter
    filter.onFetch(elements)
  })
  it('should create parent annotation field with reference to folder instance', () => {
    expect(elements[0].annotations.parent).toBeDefined()
  })
})
