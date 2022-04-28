/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { InstanceElement, CORE_ANNOTATIONS, ReferenceExpression, BuiltinTypes, ObjectType, ElemID, isInstanceElement } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { createCustomObjectType, createMetadataTypeElement, defaultFilterContext } from '../utils'
import makeFilter, { LAYOUT_TYPE_ID } from '../../src/filters/layouts'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { getObjectDirectoryPath } from '../../src/filters/custom_objects'

describe('Test layout filter', () => {
  describe('Test layout fetch', () => {
    let testSObj: ObjectType
    let testSobjPath: string[]
    let instance: InstanceElement | undefined
    let targetFullName: string
    const fetch = async ({
      apiName,
      namespacePrefix,
      layoutNameIncludesPrefix = false,
    }:
      {
        apiName: string
        namespacePrefix?: string
        layoutNameIncludesPrefix?: boolean
        customObject?: boolean

      }): Promise<void> => {
      targetFullName = namespacePrefix ? 'SBQQ__TestApiName-SBQQ__Test Layout' : `${apiName}-Test Layout`
      const { client } = mockClient()
      client.listMetadataObjects = jest.fn()
        .mockReturnValue({
          result: [
            {
              createdById: 'aaaaaaaaa',
              createdByName: 'aaaaaaaaa',
              createdDate: '2020-08-25T11:39:01.000Z',
              fileName: 'layouts/Test.layout',
              fullName: layoutNameIncludesPrefix ? `${apiName}-SBQQ__Test Layout` : `${apiName}-Test Layout`,
              id: 'aaaaaaaaa',
              lastModifiedById: 'aaaaaaaaa',
              lastModifiedByName: 'aaaaaaaaa',
              lastModifiedDate: '2020-08-25T11:40:45.000Z',
              manageableState: 'installed',
              type: 'Layout',
              namespacePrefix,
            },
          ],
        })

      client.readMetadata = jest.fn()
        .mockImplementation(async (_typeName: string, names: string[])
            : Promise<{result: {}[]; errors: string[]}> => {
          const result = names.map(name => {
            const testLayoutMetadataInfo = {
              [constants.INSTANCE_FULL_NAME_FIELD]: name,
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
            return testLayoutMetadataInfo
          })

          return { result, errors: [] }
        })

      testSObj = createCustomObjectType(
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

      testSobjPath = [...await getObjectDirectoryPath(testSObj), pathNaclCase(targetFullName)]
      testSObj.path = testSobjPath
      const testLayoutType = new ObjectType({
        elemID: new ElemID(constants.SALESFORCE,
          constants.LAYOUT_TYPE_ID_METADATA_TYPE),
      })

      const webLinkObj = createMetadataTypeElement('WebLink', { path: [constants.SALESFORCE] })

      const webLinkInst = new InstanceElement(
        'link',
        webLinkObj,
        {
          [constants.INSTANCE_FULL_NAME_FIELD]: `${apiName}.link`,
        },
      )

      const elements = [
        testSObj, testLayoutType, webLinkObj, webLinkInst,
      ]

      const filter = makeFilter({ client, config: defaultFilterContext }) as FilterWith<'onFetch'>
      await filter.onFetch(elements)
      instance = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === constants.LAYOUT_TYPE_ID_METADATA_TYPE)

      expect(instance?.elemID).toEqual(LAYOUT_TYPE_ID.createNestedID('instance', naclCase(targetFullName)))
      expect(instance?.path?.slice(0, -1)).toEqual([...testSobjPath.slice(0, -1), 'Layout'])
      expect(instance?.annotations[CORE_ANNOTATIONS.PARENT]).toContainEqual(
        new ReferenceExpression(testSObj.elemID)
      )
    }

    it('should add relation between layout to related sobject', async () => {
      await fetch({ apiName: 'TestApiName' })
    })
    it('should add relation between layout to related custom sobject', async () => {
      await fetch({ apiName: 'TestApiName__c' })
    })

    describe('installed packages', () => {
      describe('if the API name already includes namespacePrefix', () => {
        describe('if layout name does not include prefix', () => {
          it('should give correct instance name and path', async () => {
            await fetch({ apiName: 'SBQQ__TestApiName', namespacePrefix: 'SBQQ', layoutNameIncludesPrefix: false })
          })
        })
        describe('if layout name already includes prefix', () => {
          it('should give correct instance name and path', async () => {
            await fetch({ apiName: 'SBQQ__TestApiName', namespacePrefix: 'SBQQ', layoutNameIncludesPrefix: true })
          })
        })
      })
      describe('if the API name does not include namespacePrefix', () => {
        describe('if layout name already includes namespacePrefix', () => {
          it('should not add prefix to the instance\'s name', async () => {
            await fetch({ apiName: 'TestApiName', namespacePrefix: 'SBQQ', layoutNameIncludesPrefix: true })
          })
        })
        describe('if layout  name does not include prefix', () => {
          it('should add prefix to the layout\'s name', async () => {
            await fetch({ apiName: 'TestApiName', namespacePrefix: 'SBQQ', layoutNameIncludesPrefix: false })
          })
        })
      })
    })
  })
})

// import _ from 'lodash'
// import { InstanceElement, CORE_ANNOTATIONS, ReferenceExpression, BuiltinTypes, ObjectType, ElemID, isInstanceElement } from '@salto-io/adapter-api'
// import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
// import { createCustomObjectType, createMetadataTypeElement, defaultFilterContext } from '../utils'
// import makeFilter, { LAYOUT_TYPE_ID } from '../../src/filters/layouts'
// import * as constants from '../../src/constants'
// import { FilterWith } from '../../src/filter'
// import mockClient from '../client'
// import { getObjectDirectoryPath } from '../../src/filters/custom_objects'


// describe('Test layout filter', () => {
//   describe('Test layout fetch', () => {
//     const testApiNames = {
//       regualr: 'Test',
//       custom: 'Test__c',
//       SBQQ_prefixBeforeFix: 'SBQQ__Obj-layout',
//       SBQQ_prefixAfterFix: 'SBQQ__Obj-SBQQ__layout',
//     }
//     const shortName = 'Test Layout'
//     const { client } = mockClient()
//     const createMocksForClient = (): void => {
//       client.listMetadataObjects = jest.fn()
//         .mockImplementation(async () => ({
//           result: [
//             {
//               createdById: 'aaaaaaaaa',
//               createdByName: 'aaaaaaaaa',
//               createdDate: '2020-08-25T11:39:01.000Z',
//               fileName: 'layouts/SBQQ__Obj-Obj lala Layout.layout',
//               fullName: 'SBQQ__Obj-layout',
//               id: 'aaaaaaaaa',
//               lastModifiedById: 'aaaaaaaaa',
//               lastModifiedByName: 'aaaaaaaaa',
//               lastModifiedDate: '2020-08-25T11:40:45.000Z',
//               manageableState: 'installed',
//               namespacePrefix: 'SBQQ',
//               type: 'Layout',
//             },
//             {
//               createdById: 'aaaaaaaaa',
//               createdByName: 'aaaaaaaaa',
//               createdDate: '2020-08-25T11:39:01.000Z',
//               fileName: 'layouts/Test.layout',
//               fullName: 'Test',
//               id: 'aaaaaaaaa',
//               lastModifiedById: 'aaaaaaaaa',
//               lastModifiedByName: 'aaaaaaaaa',
//               lastModifiedDate: '2020-08-25T11:40:45.000Z',
//               manageableState: 'installed',
//               type: 'Layout',
//             },
//             {
//               createdById: 'aaaaaaaaa',
//               createdByName: 'aaaaaaaaa',
//               createdDate: '2020-08-25T11:39:01.000Z',
//               fileName: 'layouts/Test__c.layout',
//               fullName: 'Test__c',
//               id: 'aaaaaaaaa',
//               lastModifiedById: 'aaaaaaaaa',
//               lastModifiedByName: 'aaaaaaaaa',
//               lastModifiedDate: '2020-08-25T11:40:45.000Z',
//               manageableState: 'installed',
//               type: 'Layout',
//             },
//           ],
//         }))

//       client.readMetadata = jest.fn()
//         .mockImplementation(async (_typeName: string, names: string[])
//             : Promise<{result: {}[]; errors: string[]}> => {
//           const result = names.map(name => {
//             const fullName = `${name}-${shortName}`
//             const testLayoutMetadataInfo = {
//               [constants.INSTANCE_FULL_NAME_FIELD]: fullName,
//               layoutSections: {
//                 layoutColumns: {
//                   layoutItems: [{
//                     field: 'foo',
//                   }, {
//                     field: 'bar',
//                   }, {
//                     customLink: 'link',
//                   }, {
//                     field: 'moo',
//                   }],
//                 },
//               },
//             }

//             if (name === testApiNames.SBQQ_prefixBeforeFix) {
//               return {}
//             } if (name === testApiNames.SBQQ_prefixAfterFix) {
//               return { ...testLayoutMetadataInfo, fullName: testApiNames.SBQQ_prefixAfterFix }
//             } return testLayoutMetadataInfo
//           }).filter(info => !_.isEmpty(info))

//           return { result, errors: [] }
//         })
//     }

//     const fetch = async (): Promise<void> => {
//       const layoutObjectType = new ObjectType({
//         elemID: new ElemID(constants.SALESFORCE, constants.LAYOUT_TYPE_ID_METADATA_TYPE),
//         annotations: { suffix: 'layout', dirName: 'layouts', metadataType: 'Layout' },
//         path: ['salesforce', 'Types', 'Layout'],
//       })
//       const createTestSObjects = (): ObjectType[] =>
//         Object.values(testApiNames)
//           .filter(apiName => apiName !== testApiNames.SBQQ_prefixBeforeFix)
//           .map(async apiName => {
//             const testSObj = createCustomObjectType(
//               apiName,
//               {
//                 fields: {
//                   foo: {
//                     refType: BuiltinTypes.STRING,
//                     annotations: { apiName: [apiName, 'foo'].join(constants.API_NAME_SEPARATOR) },
//                   },
//                   bar: {
//                     refType: BuiltinTypes.STRING,
//                     annotations: { apiName: [apiName, 'bar'].join(constants.API_NAME_SEPARATOR) },
//                   },
//                 },
//               }
//             )
//             const testSobjPath = [...await getObjectDirectoryPath(testSObj), pathNaclCase(apiName)]
//             testSObj.path = testSobjPath
//             return testSObj
//           })


//       const webLinkObj = createMetadataTypeElement('WebLink', { path: [constants.SALESFORCE] })

//       const webLinkInst = new InstanceElement(
//         'link',
//         webLinkObj,
//         {
//           // [constants.INSTANCE_FULL_NAME_FIELD]: `${apiName}.link`,
//         },
//       )


//       // const elements = [
//       //   ...createTestSObjects(), layoutObjectType, webLinkObj, webLinkInst,
//       // ]

//       // console.log('elements before: %o', elements.filter(isInstanceElement).map(e => e.elemID.name))
//       // createMocksForClient()
//       // const filter = makeFilter({ client, config: defaultFilterContext }) as FilterWith<'onFetch'>
//       // await filter.onFetch(elements)
//       // console.log('elements after: %o', elements.filter(isInstanceElement).map(e => e.elemID.name))
//     }
//     beforeEach(async () => {
//       await fetch()
//     })

//     it('should add relation between layout to related sobject', async () => {
//       // const instance = elements.find(e => e.elemID.name === apiName)
//       const instance = elements[1] as InstanceElement
//       expect(instance.elemID).toEqual(LAYOUT_TYPE_ID.createNestedID('instance', naclCase(shortName)))
//       // expect(instance.path).toEqual([...testSobjPath.slice(0, -1), 'Layout', pathNaclCase(instance.elemID.name)])

//       // expect(instance.annotations[CORE_ANNOTATIONS.PARENT]).toContainEqual(
//       //   new ReferenceExpression(testSObj.elemID)
//       // )
//       // TODO: check in each test individially the returned elements


//       // await fetch('Test')
//     })
//     it('should add relation between layout to related custom sobject', async () => {
//       // await fetch('Test__c')
//     })
//     // it('should not transform instance name if it is already fixed', async () => {
//     //   await fetch('Test', { fixedName: true })
//     // })
//   })
// })
