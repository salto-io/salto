/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { CORE_ANNOTATIONS, Element, ReferenceExpression } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { FilterWith } from './mocks'
import filterCreator from '../../src/filters/add_parent_to_instances_within_folder'
import { defaultFilterContext } from '../utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('addParentToInstancesWithinFolderFilter', () => {
  describe('onFetch', () => {
    let elements: Element[]
    let elementsSource: Element[]
    let emailTemplateInstance: Element
    let emailFolderInstance: Element
    let reportInstance: Element
    let reportFolderInstance: Element
    let documentInstance: Element
    let documentFolderInstance: Element
    let dashboardInstance: Element
    let dashboardFolderInstance: Element

    beforeEach(() => {
      emailFolderInstance = createInstanceElement({ fullName: 'MarketingFolder' }, mockTypes.EmailFolder)
      elementsSource = [emailFolderInstance]
      elements = [
        (emailTemplateInstance = createInstanceElement(
          { fullName: 'MarketingFolder/WelcomeEmail' },
          mockTypes.EmailTemplate,
        )),
        (reportInstance = createInstanceElement({ fullName: 'SalesFolder/QuarterlySales' }, mockTypes.Report)),
        (reportFolderInstance = createInstanceElement({ fullName: 'SalesFolder' }, mockTypes.ReportFolder)),
        (documentInstance = createInstanceElement({ fullName: 'SharedDocs/Policy' }, mockTypes.Document)),
        (documentFolderInstance = createInstanceElement({ fullName: 'SharedDocs' }, mockTypes.DocumentFolder)),
        (dashboardInstance = createInstanceElement(
          { fullName: 'Dashboards/PerformanceDashboard' },
          mockTypes.Dashboard,
        )),
        (dashboardFolderInstance = createInstanceElement({ fullName: 'Dashboards' }, mockTypes.DashboardFolder)),
        ...Object.values(mockTypes),
      ]
    })
    describe('when the instances are within folder', () => {
      describe('when addParentToInstancesWithinFolder is Enabled', () => {
        beforeEach(async () => {
          const filter: FilterWith<'onFetch'> = filterCreator({
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: { target: [], optionalFeatures: { addParentToInstancesWithinFolder: true } },
              }),
              elementsSource: buildElementsSourceFromElements(elementsSource),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should add parent annotation to email template', async () => {
          expect(emailTemplateInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(emailFolderInstance.elemID, emailFolderInstance),
          )
        })
        it('should add parent annotation to report', () => {
          expect(reportInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(reportFolderInstance.elemID, reportFolderInstance),
          )
        })
        it('should add parent annotation to document', () => {
          expect(documentInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(documentFolderInstance.elemID, documentFolderInstance),
          )
        })
        it('should add parent annotation to dashboard', () => {
          expect(dashboardInstance.annotations[CORE_ANNOTATIONS.PARENT][0]).toEqual(
            new ReferenceExpression(dashboardFolderInstance.elemID, dashboardFolderInstance),
          )
        })
      })
      describe('when addParentToInstancesWithinFolder is Disabled', () => {
        beforeEach(async () => {
          const filter: FilterWith<'onFetch'> = filterCreator({
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: { target: [], optionalFeatures: { addParentToInstancesWithinFolder: false } },
              }),
              elementsSource: buildElementsSourceFromElements(elementsSource),
            },
          }) as FilterWith<'onFetch'>
          await filter.onFetch(elements)
        })
        it('should not create parent annotation', () => {
          expect(emailTemplateInstance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
          expect(reportInstance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
          expect(documentInstance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
          expect(dashboardInstance.annotations[CORE_ANNOTATIONS.PARENT]).toBeUndefined()
        })
      })
    })
  })
})
