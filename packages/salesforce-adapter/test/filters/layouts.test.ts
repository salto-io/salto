/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, CORE_ANNOTATIONS, ReferenceExpression, BuiltinTypes } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType, createMetadataTypeElement, defaultFilterContext } from '../utils'
import makeFilter, { LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import * as constants from '../../src/constants'
import { getObjectDirectoryPath } from '../../src/filters/custom_objects_to_object_type'
import { FilterWith } from './mocks'

describe('Test layout filter', () => {
  describe('Test layout fetch', () => {
    const fetch = async (apiName: string, opts = { fixedName: true }): Promise<void> => {
      const testSObj = createCustomObjectType(apiName, {
        fields: {
          foo: {
            refType: BuiltinTypes.STRING,
            annotations: {
              apiName: [apiName, 'foo'].join(constants.API_NAME_SEPARATOR),
            },
          },
          bar: {
            refType: BuiltinTypes.STRING,
            annotations: {
              apiName: [apiName, 'bar'].join(constants.API_NAME_SEPARATOR),
            },
          },
        },
      })
      const testSObjPath = [...(await getObjectDirectoryPath(testSObj)), pathNaclCase(apiName)]
      testSObj.path = testSObjPath

      const shortName = 'Test Layout'
      const fullName = `${apiName}-${shortName}`
      const instName = naclCase(opts.fixedName ? shortName : fullName)
      const testLayout = new InstanceElement(
        instName,
        mockTypes.Layout,
        {
          [constants.INSTANCE_FULL_NAME_FIELD]: fullName,
          layoutSections: {
            layoutColumns: {
              layoutItems: [
                {
                  field: 'foo',
                },
                {
                  field: 'bar',
                },
                {
                  customLink: 'link',
                },
                {
                  field: 'moo',
                },
              ],
            },
          },
        },
        [constants.RECORDS_PATH, 'Layout', instName],
      )

      const webLinkObj = createMetadataTypeElement('WebLink', {
        path: [constants.SALESFORCE],
      })

      const webLinkInst = new InstanceElement('link', webLinkObj, {
        [constants.INSTANCE_FULL_NAME_FIELD]: `${apiName}.link`,
      })

      const elements = [testSObj, testLayout, webLinkObj, webLinkInst]

      const filter = makeFilter({
        config: defaultFilterContext,
      }) as FilterWith<'onFetch'>
      await filter.onFetch(elements)

      const instance = elements[1] as InstanceElement
      expect(instance.elemID).toEqual(LAYOUT_TYPE_ID.createNestedID('instance', instName))
      expect(instance.path).toEqual([
        ...testSObjPath.slice(0, -1),
        'Layout',
        opts.fixedName ? pathNaclCase(instance.elemID.name) : shortName.replace(' ', '_'),
      ])

      expect(instance.annotations[CORE_ANNOTATIONS.PARENT]).toContainEqual(
        new ReferenceExpression(testSObj.elemID, testSObj),
      )
    }

    it('should add relation between layout to related sobject', async () => {
      await fetch('Test')
    })
    it('should add relation between layout to related custom sobject', async () => {
      await fetch('Test__c')
    })
    it('should add relation between layout to related custom Metadata sobject', async () => {
      await fetch('Test__mdt', { fixedName: false })
    })
    it('should not transform instance name if it is already fixed', async () => {
      await fetch('Test', { fixedName: true })
    })
  })
})
