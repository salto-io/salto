/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ElemID,
  Field,
  InstanceElement,
  ListType,
  ObjectType,
  toChange,
  BuiltinTypes,
  MapType,
} from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { createInstanceElement, Types } from '../../src/transformers/transformer'
import multipleDefaultsValidator from '../../src/change_validators/default_rules'
import { createField } from '../utils'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, PERMISSION_SET_METADATA_TYPE, SALESFORCE } from '../../src/constants'

describe('default rules change validator', () => {
  const runChangeValidatorOnUpdate = (
    before: Field | InstanceElement,
    after: Field | InstanceElement,
  ): Promise<ReadonlyArray<ChangeError>> => multipleDefaultsValidator([toChange({ before, after })])
  describe('in custom fields', () => {
    let obj: ObjectType
    beforeEach(() => {
      obj = new ObjectType({
        elemID: new ElemID('salesforce', 'obj'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_OBJECT,
          [API_NAME]: 'obj',
        },
      })
    })

    const createAfterField = (beforeField: Field): Field => {
      const afterField = beforeField.clone()
      afterField.annotations.valueSet[1].default = true
      return afterField
    }

    describe('picklist', () => {
      it('should have Error for a picklist field', async () => {
        const beforeField = createField(obj, Types.primitiveDataTypes.Picklist, 'PicklistField', {
          valueSet: [
            {
              fullName: 'Gold',
              default: true,
              label: 'Gold',
            },
            {
              fullName: 'Silver',
              default: false,
              label: 'Silver',
            },
          ],
        })
        const afterField = createAfterField(beforeField)
        const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.elemID).toEqual(beforeField.elemID)
        expect(changeError.severity).toEqual('Error')
      })
      it('should not have error for <= 1 default values in picklist', async () => {
        const beforeField = createField(obj, Types.primitiveDataTypes.Picklist, 'PicklistField', {
          valueSet: [
            {
              fullName: 'Gold',
              default: false,
              label: 'Gold',
            },
            {
              fullName: 'Silver',
              default: false,
              label: 'Silver',
            },
          ],
        })
        const afterField = createAfterField(beforeField)
        const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('multi-select picklist', () => {
      it('should have Error for a MultiselectPicklist field', async () => {
        const beforeField = createField(obj, Types.primitiveDataTypes.MultiselectPicklist, 'PicklistField', {
          valueSet: [
            {
              fullName: 'Gold',
              default: true,
              label: 'Gold',
            },
            {
              fullName: 'Silver',
              default: false,
              label: 'Silver',
            },
          ],
        })
        const afterField = createAfterField(beforeField)
        const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.elemID).toEqual(beforeField.elemID)
        expect(changeError.severity).toEqual('Error')
      })
      it('should not have error for <= 1 default values in picklist', async () => {
        const beforeField = createField(obj, Types.primitiveDataTypes.MultiselectPicklist, 'PicklistField', {
          valueSet: [
            {
              fullName: 'Gold',
              default: false,
              label: 'Gold',
            },
            {
              fullName: 'Silver',
              default: false,
              label: 'Silver',
            },
          ],
        })
        const afterField = createAfterField(beforeField)
        const changeErrors = await runChangeValidatorOnUpdate(beforeField, afterField)
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
  describe('In metadata instances', () => {
    describe('GlobalValueSet', () => {
      let type: ObjectType
      beforeEach(() => {
        type = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'GlobalValueSet'),
          fields: {
            customValue: {
              refType: new ListType(
                new ObjectType({
                  elemID: new ElemID(SALESFORCE, 'CustomValue'),
                  fields: {
                    fullName: { refType: BuiltinTypes.STRING },
                    default: { refType: BuiltinTypes.BOOLEAN },
                    label: { refType: BuiltinTypes.STRING },
                  },
                  annotations: {
                    [METADATA_TYPE]: 'CustomValue',
                  },
                }),
              ),
            },
          },
        })
      })

      const createAfterInstance = (beforeInstance: InstanceElement): InstanceElement => {
        const afterInstance = beforeInstance.clone()
        afterInstance.value.customValue[1].default = true
        return afterInstance
      }

      it('should have Error for a GlobalValueSet instance', async () => {
        const beforeInstance = createInstanceElement(
          {
            fullName: 'globalValueSetInstance',
            customValue: [
              {
                fullName: 'lolo',
                default: true,
                label: 'lolo',
              },
              {
                fullName: 'lala',
                default: false,
                label: 'lala',
              },
            ],
          },
          type,
        )
        const afterInstance = createAfterInstance(beforeInstance)
        const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.elemID).toEqual(afterInstance.elemID)
        expect(changeError.severity).toEqual('Error')
      })
      it('should not have error for <= 1 default values GlobalValueSet', async () => {
        const beforeInstance = createInstanceElement(
          {
            fullName: 'globalValueSetInstance',
            customValue: [
              {
                fullName: 'lolo',
                default: false,
                label: 'lolo',
              },
              {
                fullName: 'lala',
                default: false,
                label: 'lala',
              },
            ],
          },
          type,
        )
        const afterInstance = createAfterInstance(beforeInstance)
        const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
        expect(changeErrors).toHaveLength(0)
      })
      it('should handle fields that don`t appear in the type (SALTO-4882)', async () => {
        const beforeInstance = createInstanceElement(
          {
            fullName: 'globalValueSetInstance',
            customValue: [
              {
                fullName: 'lolo',
                default: true,
                label: 'lolo',
              },
              {
                fullName: 'lala',
                default: false,
                label: 'lala',
              },
            ],
            standardValue: [
              {
                fullName: 'lolo',
                default: true,
                label: 'lolo',
              },
              {
                fullName: 'lala',
                default: false,
                label: 'lala',
              },
            ],
          },
          type,
        )
        const afterInstance = createAfterInstance(beforeInstance)
        const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.elemID).toEqual(afterInstance.elemID)
        expect(changeError.severity).toEqual('Error')
      })
    })

    describe('Profile', () => {
      let type: ObjectType
      beforeEach(() => {
        type = new ObjectType({
          elemID: new ElemID(SALESFORCE, 'Profile'),
          fields: {
            applicationVisibilities: {
              refType: new MapType(
                new ObjectType({
                  elemID: new ElemID(SALESFORCE, 'ProfileApplicationVisibility'),
                  fields: { default: { refType: BuiltinTypes.BOOLEAN } },
                  annotations: {
                    [METADATA_TYPE]: 'ProfileApplicationVisibility',
                  },
                }),
              ),
            },
            recordTypeVisibilities: {
              refType: new MapType(
                new MapType(
                  new ObjectType({
                    elemID: new ElemID(SALESFORCE, 'ProfileRecordTypeVisibility'),
                    fields: { default: { refType: BuiltinTypes.BOOLEAN } },
                    annotations: {
                      [METADATA_TYPE]: 'ProfileRecordTypeVisibility',
                    },
                  }),
                ),
              ),
            },
          },
          annotations: {
            [METADATA_TYPE]: 'Profile',
          },
        })
      })

      describe('ProfileApplicationVisibility', () => {
        const createAfterInstance = (beforeInstance: InstanceElement): InstanceElement => {
          const afterInstance = beforeInstance.clone()
          afterInstance.value.applicationVisibilities.app.default = true
          return afterInstance
        }

        it('should have Error for ProfileApplicationVisibility', async () => {
          const beforeInstance = createInstanceElement(
            {
              fullName: 'ProfileInstance',
              applicationVisibilities: {
                app: {
                  default: false,
                },
                anotherApp: {
                  default: true,
                },
              },
            },
            type,
          )

          const afterInstance = createAfterInstance(beforeInstance)
          const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
          expect(changeErrors).toHaveLength(1)
          const [changeError] = changeErrors
          expect(changeError.elemID).toEqual(afterInstance.elemID)
          expect(changeError.severity).toEqual('Error')
        })

        it('should not have error for <= 1 default values in ProfileApplicationVisibility', async () => {
          const beforeInstance = createInstanceElement(
            {
              fullName: 'ProfileInstance',
              applicationVisibilities: {
                app: {
                  default: false,
                },
                anotherApp: {
                  default: false,
                },
              },
            },
            type,
          )

          const afterInstance = createAfterInstance(beforeInstance)
          const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
          expect(changeErrors).toHaveLength(0)
        })
      })

      describe('ProfileRecordTypeVisibility', () => {
        const createAfterInstance = (
          beforeInstance: InstanceElement,
          changedDefaultValue: boolean = true,
        ): InstanceElement => {
          const afterInstance = beforeInstance.clone()
          afterInstance.value.recordTypeVisibilities.test1.testRecordType1.default = changedDefaultValue
          return afterInstance
        }
        describe('when there is more than one default', () => {
          it('should have error for ProfileRecordTypeVisibility', async () => {
            const beforeInstance = createInstanceElement(
              {
                fullName: 'ProfileInstance',
                recordTypeVisibilities: {
                  test1: {
                    testRecordType1: {
                      default: false,
                    },
                    testRecordType2: {
                      default: true,
                    },
                  },
                  test2: {
                    testRecordType3: {
                      default: false,
                    },
                  },
                },
              },
              type,
            )

            const afterInstance = createAfterInstance(beforeInstance)
            const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
            expect(changeErrors).toHaveLength(1)
            const [changeError] = changeErrors
            expect(changeError.elemID).toEqual(afterInstance.elemID)
            expect(changeError.severity).toEqual('Error')
          })
        })
        describe('when there is one default', () => {
          describe('when the default is visible', () => {
            it('should have no errors', async () => {
              const beforeInstance = createInstanceElement(
                {
                  fullName: 'ProfileInstance',
                  recordTypeVisibilities: {
                    test1: {
                      testRecordType1: {
                        default: false,
                        visible: true,
                      },
                      testRecordType2: {
                        default: false,
                        visible: true,
                      },
                    },
                    test2: {
                      testRecordType3: {
                        default: false,
                        visible: false,
                      },
                    },
                  },
                },
                type,
              )
              const afterInstance = createAfterInstance(beforeInstance, true)
              const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
              expect(changeErrors).toHaveLength(0)
            })
          })
          describe('when the default is not visible', () => {
            it('should have an error', async () => {
              const beforeInstance = createInstanceElement(
                {
                  fullName: 'ProfileInstance',
                  recordTypeVisibilities: {
                    test1: {
                      testRecordType1: {
                        default: false,
                        visible: false,
                        recordType: 'test1.testRecordType1',
                      },
                      testRecordType2: {
                        default: false,
                        visible: false,
                        recordType: 'test1.testRecordType2',
                      },
                    },
                    test2: {
                      testRecordType3: {
                        default: false,
                        visible: false,
                        recordType: 'test2.testRecordType3',
                      },
                    },
                  },
                },
                type,
              )
              const afterInstance = createAfterInstance(beforeInstance, true)
              const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
              expect(changeErrors).toHaveLength(1)
              const [changeError] = changeErrors
              expect(changeError.elemID).toEqual(
                afterInstance.elemID.createNestedID('recordTypeVisibilities', 'test1', 'testRecordType1', 'visible'),
              )
              expect(changeError.severity).toEqual('Error')
            })
          })
          describe('when one profile has multiple records with errors', () => {
            it('should have multiple errors', async () => {
              const beforeInstance = createInstanceElement(
                {
                  fullName: 'ProfileInstance',
                  recordTypeVisibilities: {
                    test1: {
                      testRecordType1: {
                        default: false,
                        visible: false,
                        recordType: 'test1.testRecordType1',
                      },
                      testRecordType2: {
                        default: false,
                        visible: false,
                        recordType: 'test1.testRecordType2',
                      },
                    },
                    test2: {
                      testRecordType3: {
                        default: true,
                        visible: false,
                        recordType: 'test2.testRecordType3',
                      },
                    },
                  },
                },
                type,
              )
              const afterInstance = createAfterInstance(beforeInstance, true)
              const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
              expect(changeErrors).toHaveLength(2)
              expect(changeErrors[0].elemID).toEqual(
                afterInstance.elemID.createNestedID('recordTypeVisibilities', 'test1', 'testRecordType1', 'visible'),
              )
              expect(changeErrors[0].severity).toEqual('Error')
              expect(changeErrors[1].elemID).toEqual(
                afterInstance.elemID.createNestedID('recordTypeVisibilities', 'test2', 'testRecordType3', 'visible'),
              )
              expect(changeErrors[1].severity).toEqual('Error')
            })
          })
        })
        describe('when there are no defaults', () => {
          describe('when there is visible entry', () => {
            it('should have an error', async () => {
              const beforeInstance = createInstanceElement(
                {
                  fullName: 'ProfileInstance',
                  recordTypeVisibilities: {
                    test1: {
                      testRecordType1: {
                        default: true,
                        visible: true,
                        recordType: 'test1.testRecordType1',
                      },
                      testRecordType2: {
                        default: false,
                        visible: false,
                        recordType: 'test1.testRecordType2',
                      },
                    },
                    test2: {
                      testRecordType3: {
                        default: false,
                        visible: false,
                        recordType: 'test2.testRecordType3',
                      },
                    },
                  },
                },
                type,
              )
              const afterInstance = createAfterInstance(beforeInstance, false)
              const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
              expect(changeErrors).toHaveLength(1)
              const [changeError] = changeErrors
              expect(changeError.elemID).toEqual(afterInstance.elemID.createNestedID('recordTypeVisibilities', 'test1'))
              expect(changeError.severity).toEqual('Error')
            })
          })
          describe('when there is no visible entry', () => {
            it('should have no errors', async () => {
              const beforeInstance = createInstanceElement(
                {
                  fullName: 'ProfileInstance',
                  recordTypeVisibilities: {
                    test1: {
                      testRecordType1: {
                        default: true,
                        visible: false,
                      },
                      testRecordType2: {
                        default: false,
                        visible: false,
                      },
                    },
                    test2: {
                      testRecordType3: {
                        default: false,
                        visible: false,
                      },
                    },
                  },
                },
                type,
              )
              const afterInstance = createAfterInstance(beforeInstance, false)
              const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
              expect(changeErrors).toHaveLength(0)
            })
          })
        })
      })

      describe('several errors in one instance', () => {
        const createAfterInstance = (beforeInstance: InstanceElement): InstanceElement => {
          const afterInstance = beforeInstance.clone()
          afterInstance.value.recordTypeVisibilities.test1.testRecordType1.default = true
          afterInstance.value.applicationVisibilities.app.default = true
          return afterInstance
        }
        it('should have 2 errors', async () => {
          const beforeInstance = createInstanceElement(
            {
              fullName: 'ProfileInstance',
              recordTypeVisibilities: {
                test1: {
                  testRecordType1: {
                    default: false,
                  },
                  testRecordType2: {
                    default: true,
                  },
                },
              },
              applicationVisibilities: {
                app: {
                  default: false,
                },
                anotherApp: {
                  default: true,
                },
              },
            },
            type,
          )

          const afterInstance = createAfterInstance(beforeInstance)
          const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
          const changeErrorsIds = changeErrors.map(error => safeJsonStringify(error.elemID))
          expect(changeErrors).toHaveLength(2)

          // doesn't work without the JsonStringify
          expect(changeErrorsIds).toContain(safeJsonStringify(afterInstance.elemID))
          expect(changeErrorsIds).toContain(safeJsonStringify(afterInstance.elemID))
          changeErrors.forEach(error => {
            expect(error.severity).toEqual('Error')
          })
        })
      })
    })
    describe('PermissionSet', () => {
      describe('has no defaults', () => {
        let beforeInstance: InstanceElement
        let afterInstance: InstanceElement
        beforeEach(() => {
          const type = new ObjectType({
            elemID: new ElemID(SALESFORCE, PERMISSION_SET_METADATA_TYPE),
            fields: {
              recordTypeVisibilities: {
                refType: new MapType(
                  new MapType(
                    new ObjectType({
                      elemID: new ElemID(SALESFORCE, 'PermissionSetRecordTypeVisibility'),
                      fields: { default: { refType: BuiltinTypes.BOOLEAN } },
                      annotations: {
                        [METADATA_TYPE]: 'PermissionSetRecordTypeVisibility',
                      },
                    }),
                  ),
                ),
              },
            },
            annotations: {
              [METADATA_TYPE]: PERMISSION_SET_METADATA_TYPE,
            },
          })
          beforeInstance = createInstanceElement(
            {
              fullName: 'PermissionSetInstance',
              recordTypeVisibilities: {
                test1: {
                  testRecordType1: {
                    visible: false,
                  },
                  testRecordType2: {
                    visible: false,
                  },
                },
                test2: {
                  testRecordType3: {
                    visible: true,
                  },
                },
              },
            },
            type,
          )
          afterInstance = beforeInstance.clone()
          afterInstance.value.recordTypeVisibilities.test1.testRecordType1.visible = true
        })
        it('should not create errors', async () => {
          const changeErrors = await runChangeValidatorOnUpdate(beforeInstance, afterInstance)
          expect(changeErrors).toBeEmpty()
        })
      })
    })
  })
})
