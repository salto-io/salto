/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { InstanceElement, CORE_ANNOTATIONS, ReferenceExpression, BuiltinTypes, isInstanceElement, ObjectType, ElemID } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { createCustomObjectType, createMetadataTypeElement, defaultFilterContext } from '../utils'
import makeFilter, { LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { getObjectDirectoryPath } from '../../src/filters/custom_objects'

describe('Test layout filter', () => {
  describe('Test layout fetch', () => {
    const testApiNames = {
      regualr: 'Test',
      custom: 'Test__c',
      SBQQ_prefixBeforeFix: 'SBQQ__Obj-Obj lala Layout',
      SBQQ_prefixAfterFix: 'SBQQ__Obj-SBQQ__Obj lala Layout',
    }

    const fetch = async (apiName: string,
    // opts: {
    //   fixedName?: boolean
    //   namespace: string | undefined
    // } = { fixedName: true,
    //   namespace: undefined }
    ): Promise<void> => {
      const layoutObject = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE, constants.LAYOUT_TYPE_ID_METADATA_TYPE),
        annotations: { suffix: 'layout', dirName: 'layouts', metadataType: 'Layout' },
        path: ['salesforce', 'Types', 'Layout'],
      })

      const shortName = 'Test Layout'


      const testSObj = createCustomObjectType(
        apiName,
        {
          fields: {
            foo: {
              refType: BuiltinTypes.STRING,
              annotations: { apiName: [apiName, 'foo'].join(constants.API_NAME_SEPARATOR) },
            },
            bar: {
              refType: BuiltinTypes.STRING,
              annotations: { apiName: [apiName, 'bar'].join(constants.API_NAME_SEPARATOR) },
            },
          },
        }
      )
      const testSobjPath = [...await getObjectDirectoryPath(testSObj), pathNaclCase(apiName)]
      testSObj.path = testSobjPath

      // const instName = naclCase(opts.fixedName ? shortName : fullName)

      const webLinkObj = createMetadataTypeElement('WebLink', { path: [constants.SALESFORCE] })

      const webLinkInst = new InstanceElement(
        'link',
        webLinkObj,
        {
          [constants.INSTANCE_FULL_NAME_FIELD]: `${apiName}.link`,
        },
      )

      const elements = [
        testSObj,
        webLinkObj, webLinkInst, layoutObject,
      ]

      const { client } = mockClient()

      const createMocksForClient = (): void => {
        client.listMetadataObjects = jest.fn()
          .mockImplementation(async () => ({
            result: [
              {
                createdById: 'aaaaaaaaa',
                createdByName: 'aaaaaaaaa',
                createdDate: '2020-08-25T11:39:01.000Z',
                fileName: 'layouts/SBQQ__Obj-Obj lala Layout.layout',
                fullName: 'SBQQ__Obj-Obj lala Layout',
                id: 'aaaaaaaaa',
                lastModifiedById: 'aaaaaaaaa',
                lastModifiedByName: 'aaaaaaaaa',
                lastModifiedDate: '2020-08-25T11:40:45.000Z',
                manageableState: 'installed',
                namespacePrefix: 'SBQQ',
                type: 'Layout',
              },
              {
                createdById: 'aaaaaaaaa',
                createdByName: 'aaaaaaaaa',
                createdDate: '2020-08-25T11:39:01.000Z',
                fileName: 'layouts/Test.layout',
                fullName: 'Test',
                id: 'aaaaaaaaa',
                lastModifiedById: 'aaaaaaaaa',
                lastModifiedByName: 'aaaaaaaaa',
                lastModifiedDate: '2020-08-25T11:40:45.000Z',
                manageableState: 'installed',
                type: 'Layout',
              },
              {
                createdById: 'aaaaaaaaa',
                createdByName: 'aaaaaaaaa',
                createdDate: '2020-08-25T11:39:01.000Z',
                fileName: 'layouts/Test__c.layout',
                fullName: 'Test__c',
                id: 'aaaaaaaaa',
                lastModifiedById: 'aaaaaaaaa',
                lastModifiedByName: 'aaaaaaaaa',
                lastModifiedDate: '2020-08-25T11:40:45.000Z',
                manageableState: 'installed',
                type: 'Layout',
              },
            ],
          }))

        client.readMetadata = jest.fn()
          .mockImplementation(async (_typeName: string, names: string[]) => ({
            result: names.map(name => {
              const fullName = `${apiName}-${shortName}`
              // const instName = naclCase(opts.fixedName ? shortName : fullName)
              const testLayoutFileProps = {
                [constants.INSTANCE_FULL_NAME_FIELD]: fullName,
                layoutSections: {
                  layoutColumns: {
                    layoutItems: [{
                      field: 'foo',
                    }, {
                      field: 'bar',
                    }, {
                      customLink: 'link',
                    }, {
                      field: 'moo',
                    }],
                  },
                },
              }

              if (name === testApiNames.SBQQ_prefixBeforeFix) {
                return {}
              } if (name === testApiNames.SBQQ_prefixAfterFix) {
                return { ...testLayoutFileProps, fullName: testApiNames.SBQQ_prefixAfterFix }
              } return testLayoutFileProps
            }),
          }))
      }

      createMocksForClient()

      const filter = makeFilter({ client, config: defaultFilterContext }) as FilterWith<'onFetch'>
      await filter.onFetch(elements)
      const instance = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === constants.LAYOUT_TYPE_ID_METADATA_TYPE)

      expect(instance).toBeDefined()
      expect(instance?.elemID).toEqual(LAYOUT_TYPE_ID.createNestedID('instance', naclCase(shortName)))
      expect(instance?.path).toEqual([...testSobjPath.slice(0, -1), 'Layout', pathNaclCase(instance?.elemID.name)])

      expect(instance?.annotations[CORE_ANNOTATIONS.PARENT]).toContainEqual(
        new ReferenceExpression(testSObj.elemID)
      )
    }

    it('should add relation between layout to related sobject', async () => {
      await fetch(testApiNames.regualr)
    })
    it('should add relation between layout to related custom sobject', async () => {
      await fetch(testApiNames.custom)
    })
    it('should not transform instance name if it is already fixed', async () => {
      await fetch(testApiNames.regualr)
      // { fixedName: true, namespace: undefined }
    })
    it('should fetch layout instances with namespace SBQQ', async () => {
      await fetch(testApiNames.SBQQ_prefixBeforeFix)
      // { fixedName: false, namespace: 'SBQQ'}
    })
  })
})
