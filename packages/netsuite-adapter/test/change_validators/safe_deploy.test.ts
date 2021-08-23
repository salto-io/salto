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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ProgressReporter, toChange } from '@salto-io/adapter-api'
import { NetsuiteQuery } from '../../src/query'
import safeDeployValidator, { FetchByQueryReturnType } from '../../src/change_validators/safe_deploy'
import { customTypes, fileCabinetTypes } from '../../src/types'
import { CUSTOM_LIST, CUSTOM_RECORD_TYPE, FOLDER, PATH, FILE, NETSUITE } from '../../src/constants'
import { IDENTIFIER_FIELD } from '../../src/data_elements/types'

describe('safe deploy change validator', () => {
  describe('custom instances', () => {
    const origInstance = new InstanceElement(
      'instance',
      customTypes[CUSTOM_LIST],
      {
        customvalues: {
          customvalue: [
            {
              scriptid: 'val_1',
              value: 'Value 1',
            },
            {
              scriptid: 'val_2',
              value: 'Value 2',
            },
          ],
        },
      },
    )
    const origInstance1 = new InstanceElement(
      'instance1',
      customTypes[CUSTOM_LIST],
      {
        customvalues: {
          customvalue: [
            {
              scriptid: 'val_1',
              value: 'Value 1',
            },
            {
              scriptid: 'val_2',
              value: 'Value 2',
            },
          ],
        },
      },
    )

    const origInstance2 = new InstanceElement(
      'instance',
      customTypes[CUSTOM_RECORD_TYPE],
      {
        customvalues: {
          customvalue: [
            {
              scriptid: 'val_1',
              value: 'Value 1',
            },
            {
              scriptid: 'val_2',
              value: 'Value 2',
            },
          ],
        },
      },
    )

    let afterInstance: InstanceElement
    beforeEach(() => {
      afterInstance = origInstance.clone()
      afterInstance.value.customvalues.customvalue[0].value = 'Value 1!@!'
    })

    describe('Modification changes', () => {
      describe('When the instance has not changed in the service', () => {
        it('should have no change warning', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [origInstance.clone(), origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })

      describe('When the instance has changed in the service in the same field', () => {
        it('should have warning', async () => {
          const serviceInstance = origInstance.clone()
          serviceInstance.value.customvalues.customvalue[0].value = 'Changed Value'

          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [serviceInstance.clone(), origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
      })

      describe('When the instance has changed in the service in a different field', () => {
        it('should have warning', async () => {
          const serviceInstance = origInstance.clone()
          serviceInstance.value.customvalues.customvalue[1].value = 'Changed Value'
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [serviceInstance.clone(), origInstance1, origInstance2],
          }))

          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
      })

      describe('When the instance has changed in the service in the same way it changed in the workspace', () => {
        it('should not have warning', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [afterInstance.clone(), origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })

      describe('When cannot match instance in service', () => {
        it('should have warning when instance was deleted in the servie', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [origInstance1, origInstance2],
          }))

          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
      })
    })

    describe('Removal changes', () => {
      it('should have warning when instance has changed in the service', async () => {
        const serviceInstance = origInstance.clone()
        serviceInstance.value.customvalues.customvalue[1].value = 'Changed Value'

        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [serviceInstance.clone(), origInstance1, origInstance2],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ before: origInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(1)
      })

      it('should not have warning when instance has not changed in the service', async () => {
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [origInstance.clone(), origInstance1, origInstance2],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ before: origInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(0)
      })
    })
    describe('Addition Changes', () => {
      it('should not have warning when instance was added in the service but values are the same', async () => {
        const newInstance = origInstance.clone()
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [newInstance.clone()],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ after: newInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(0)
      })
      it('should have warning when instance was added in the service with modified value', async () => {
        const newInstance = origInstance.clone()
        const newInstanceModified = afterInstance.clone()
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [newInstanceModified],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ after: newInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(1)
      })
      it('should not have warning when instance has not been added in the service', async () => {
        const newInstance = origInstance.clone()
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ after: newInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
  describe('data instances', () => {
    const accountType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'Account'),
      fields: { [IDENTIFIER_FIELD]: { refType: BuiltinTypes.STRING } },
      annotations: { source: 'soap' },
    })
    const origInstance = new InstanceElement(
      'origInstance',
      accountType,
      {
        [IDENTIFIER_FIELD]: 'someValue',
        customvalues: {
          customvalue: [
            {
              scriptid: 'val_1',
              value: 'Value 1',
            },
            {
              scriptid: 'val_2',
              value: 'Value 2',
            },
          ],
        },
      },
      undefined,
      { source: 'soap' },
    )
    const origInstance1 = new InstanceElement(
      'origInstance1',
      accountType,
      {
        [IDENTIFIER_FIELD]: 'bloop',
        customvalues: {
          customvalue: [
            {
              scriptid: 'val_1',
              value: 'Value 1',
            },
            {
              scriptid: 'val_2',
              value: 'Value 2',
            },
          ],
        },
      },
      undefined,
      { source: 'soap' },
    )

    const origInstance2 = new InstanceElement(
      'origInstance2',
      accountType,
      {
        [IDENTIFIER_FIELD]: 'bla',
        customvalues: {
          customvalue: [
            {
              scriptid: 'val_1',
              value: 'Value 1',
            },
            {
              scriptid: 'val_2',
              value: 'Value 2',
            },
          ],
        },
      },
      undefined,
      { source: 'soap' },
    )

    let afterInstance: InstanceElement
    beforeEach(() => {
      afterInstance = origInstance.clone()
      afterInstance.value.customvalues.customvalue[0].value = 'Value 1!@!'
    })

    describe('Modification changes', () => {
      describe('When the instance has not changed in the service', () => {
        it('should have no change warning', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [origInstance.clone(), origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })

      describe('When the instance has changed in the service in the same field', () => {
        it('should have warning', async () => {
          const serviceInstance = origInstance.clone()
          serviceInstance.value.customvalues.customvalue[0].value = 'Changed Value'

          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [serviceInstance.clone(), origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
      })

      describe('When the instance has changed in the service in a different field', () => {
        it('should have warning', async () => {
          const serviceInstance = origInstance.clone()
          serviceInstance.value.customvalues.customvalue[1].value = 'Changed Value'
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [serviceInstance.clone(), origInstance1, origInstance2],
          }))

          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
      })

      describe('When the instance has changed in the service in the same way it changed in the workspace', () => {
        it('should not have warning', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [afterInstance.clone(), origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })

      describe('When cannot match instance in service', () => {
        it('should have warning when instance was deleted in the servie', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [origInstance1, origInstance2],
          }))

          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance, after: afterInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
      })
    })

    describe('Removal changes', () => {
      it('should have warning when instance has changed in the service', async () => {
        const serviceInstance = origInstance.clone()
        serviceInstance.value.customvalues.customvalue[1].value = 'Changed Value'

        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [serviceInstance.clone(), origInstance1, origInstance2],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ before: origInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(1)
      })

      it('should not have warning when instance has not changed in the service', async () => {
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [origInstance.clone(), origInstance1, origInstance2],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ before: origInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(0)
      })
    })
    describe('Addition Changes', () => {
      it('should not have warning when instance was added in the service but values are the same', async () => {
        const newInstance = origInstance.clone()
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [newInstance.clone()],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ after: newInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(0)
      })
      it('should have warning when instance was added in the service with modified value', async () => {
        const newInstance = origInstance.clone()
        const newInstanceModified = afterInstance.clone()
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [newInstanceModified],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ after: newInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(1)
      })
      it('should not have warning when instance has not been added in the service', async () => {
        const newInstance = origInstance.clone()
        const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
        Promise<FetchByQueryReturnType> => (Promise.resolve({
          failedToFetchAllAtOnce: false,
          failedFilePaths: [],
          failedTypeToInstances: {},
          elements: [],
        }))
        const changeErrors = await safeDeployValidator(
          [toChange({ after: newInstance })],
          fetchByQuery
        )
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
  describe('fileCabinet instances', () => {
    describe('file', () => {
      let afterInstance: InstanceElement
      let origInstance: InstanceElement
      let origInstance1: InstanceElement
      let origInstance2: InstanceElement
      beforeEach(() => {
        origInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
          bundleable: false,
          description: 'a',
        })
        afterInstance = origInstance.clone()
        afterInstance.value.description = 'b'

        origInstance1 = new InstanceElement('fileInstance1', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
          bundleable: false,
        })
        origInstance2 = new InstanceElement('fileInstance2', fileCabinetTypes[FILE], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
          bundleable: false,
        })
      })

      describe('Modification changes', () => {
        describe('When the instance has not changed in the service', () => {
          it('should have no change warning', async () => {
            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [origInstance, origInstance1, origInstance2],
            }))
            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(0)
          })
        })

        describe('When the instance has changed in the service in the same field', () => {
          it('should have warning', async () => {
            const serviceInstance = origInstance.clone()
            serviceInstance.value.description = 'c'

            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
              Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [serviceInstance, origInstance1, origInstance2],
            }))
            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(1)
          })
        })

        describe('When the instance has changed in the service in the same way it changed in the workspace', () => {
          it('should not have warning', async () => {
            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
              Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [afterInstance, origInstance1, origInstance2],
            }))
            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(0)
          })
        })

        describe('When cannot match instance in service', () => {
          it('should have warning when instance was deleted in the servie', async () => {
            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
              Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [origInstance1, origInstance2],
            }))

            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(1)
          })
        })
      })

      describe('Removal changes', () => {
        it('should have warning when instance has changed in the service', async () => {
          const serviceInstance = origInstance.clone()
          serviceInstance.value.description = 'Changed Value'

          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [serviceInstance, origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })

        it('should not have warning when instance has not changed in the service', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [origInstance, origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })
      describe('Addition Changes', () => {
        it('should not have warning when instance was added in the service but values are the same', async () => {
          const newInstance = origInstance.clone()
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [newInstance.clone()],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ after: newInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
        it('should have warning when instance was added in the service with modified value', async () => {
          const newInstance = origInstance.clone()
          const newInstanceModified = afterInstance.clone()
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [newInstanceModified],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ after: newInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
        it('should not have warning when instance has not been added in the service', async () => {
          const newInstance = origInstance.clone()
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ after: newInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })
    })


    describe('folder', () => {
      let afterInstance: InstanceElement
      let origInstance: InstanceElement
      let origInstance1: InstanceElement
      let origInstance2: InstanceElement
      beforeEach(() => {
        origInstance = new InstanceElement('folderInstance', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
          description: 'a',
        })
        afterInstance = origInstance.clone()
        afterInstance.value.description = 'b'
        origInstance1 = new InstanceElement('folderInstance1', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
        })
        origInstance2 = new InstanceElement('folderInstance2', fileCabinetTypes[FOLDER], {
          [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder',
        })
      })

      describe('Modification changes', () => {
        describe('When the instance has not changed in the service', () => {
          it('should have no change warning', async () => {
            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
            Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [origInstance, origInstance1, origInstance2],
            }))
            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(0)
          })
        })

        describe('When the instance has changed in the service in the same field', () => {
          it('should have warning', async () => {
            const serviceInstance = origInstance.clone()
            serviceInstance.value.description = 'c'

            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
              Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [serviceInstance, origInstance1, origInstance2],
            }))
            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(1)
          })
        })

        describe('When the instance has changed in the service in the same way it changed in the workspace', () => {
          it('should not have warning', async () => {
            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
              Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [afterInstance, origInstance1, origInstance2],
            }))
            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(0)
          })
        })

        describe('When cannot match instance in service', () => {
          it('should have warning when instance was deleted in the servie', async () => {
            const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
              Promise<FetchByQueryReturnType> => (Promise.resolve({
              failedToFetchAllAtOnce: false,
              failedFilePaths: [],
              failedTypeToInstances: {},
              elements: [origInstance1, origInstance2],
            }))

            const changeErrors = await safeDeployValidator(
              [toChange({ before: origInstance, after: afterInstance })],
              fetchByQuery
            )
            expect(changeErrors).toHaveLength(1)
          })
        })
      })

      describe('Removal changes', () => {
        it('should have warning when instance has changed in the service', async () => {
          const serviceInstance = origInstance.clone()
          serviceInstance.value.description = 'Changed Value'

          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [serviceInstance, origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })

        it('should not have warning when instance has not changed in the service', async () => {
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [origInstance, origInstance1, origInstance2],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ before: origInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })
      describe('Addition Changes', () => {
        it('should not have warning when instance was added in the service but values are the same', async () => {
          const newInstance = origInstance.clone()
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [newInstance.clone()],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ after: newInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
        it('should have warning when instance was added in the service with modified value', async () => {
          const newInstance = origInstance.clone()
          const newInstanceModified = afterInstance.clone()
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [newInstanceModified],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ after: newInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(1)
        })
        it('should not have warning when instance has not been added in the service', async () => {
          const newInstance = origInstance.clone()
          const fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter):
          Promise<FetchByQueryReturnType> => (Promise.resolve({
            failedToFetchAllAtOnce: false,
            failedFilePaths: [],
            failedTypeToInstances: {},
            elements: [],
          }))
          const changeErrors = await safeDeployValidator(
            [toChange({ after: newInstance })],
            fetchByQuery
          )
          expect(changeErrors).toHaveLength(0)
        })
      })
    })
  })
})
