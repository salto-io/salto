/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { ElemID, FixElementsFunc, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { DEFAULT_CONFIG, UserConfig } from '../../src/config'
import { MICROSOFT_SECURITY, entraConstants, intuneConstants } from '../../src/constants'
import { assignmentFieldsHandler } from '../../src/fix_elements/assignment_fields_handler'

describe('replaceGroupsDomainHandler', () => {
  let config: UserConfig
  let handler: FixElementsFunc

  beforeEach(() => {
    config = _.cloneDeep(DEFAULT_CONFIG)
    handler = assignmentFieldsHandler({ config, elementsSource: buildElementsSourceFromElements([]) })
  })

  describe('Intune types', () => {
    const intuneApplicationType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, intuneConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME),
    })
    const intuneApplicationInstance = new InstanceElement('testIntuneApplication', intuneApplicationType, {
      displayName: 'testIntuneApplication',
      id: 'testIntuneApplication',
    })

    describe('when the instance type name is not specified in the config', () => {
      it('should do nothing', async () => {
        const result = await handler([intuneApplicationInstance])
        expect(result).toEqual({ fixedElements: [], errors: [] })
      })
    })

    describe('when the instance type name is specified in the config', () => {
      beforeEach(() => {
        config.deploy = {
          assignmentFieldsStrategy: {
            [intuneConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME]: {
              assignments: {
                strategy: 'omit',
              },
            },
          },
        }
      })

      describe('when the instance assignments field equals []', () => {
        it('should do nothing', async () => {
          const clonedInstance = intuneApplicationInstance.clone()
          clonedInstance.value.assignments = []
          const result = await handler([clonedInstance])
          expect(result).toEqual({ fixedElements: [], errors: [] })
        })
      })

      describe('when the instance assignments field is not empty', () => {
        it('should replace the field value with an empty array', async () => {
          const clonedInstance = intuneApplicationInstance.clone()
          clonedInstance.value.assignments = [{ id: 'testAssignment' }]
          const expectedInstance = intuneApplicationInstance.clone()
          expectedInstance.value.assignments = []
          const result = await handler([clonedInstance])
          expect(result).toEqual({
            fixedElements: [expectedInstance],
            errors: [
              {
                elemID: intuneApplicationInstance.elemID,
                severity: 'Info',
                message: 'Changes were made to assignment-related fields',
                detailedMessage:
                  'Changes were made to assignment-related fields according to the assignmentFieldsStrategy configuration:\n — Field "assignments" was replaced with []',
              },
            ],
          })
        })
      })
    })
  })

  describe('Entra conditional access policy', () => {
    const entraConditionalAccessPolicyType = new ObjectType({
      elemID: new ElemID(MICROSOFT_SECURITY, entraConstants.TOP_LEVEL_TYPES.CONDITIONAL_ACCESS_POLICY_TYPE_NAME),
    })
    const entraConditionalAccessPolicy = new InstanceElement(
      'testEntraConditionalAccessPolicy',
      entraConditionalAccessPolicyType,
      {
        displayName: 'testEntraConditionalAccessPolicy',
        id: 'testEntraConditionalAccessPolicy',
        conditions: {
          applications: {
            includeApplications: ['testIncludeApplication'],
            excludeApplications: ['testExcludeApplication'],
          },
          clientApplications: {
            includeServicePrincipals: ['testIncludeServicePrincipal'],
            excludeServicePrincipals: ['testExcludeServicePrincipal'],
          },
          users: {
            includeUsers: ['testIncludeUser'],
            excludeUsers: ['testExcludeUser'],
            includeGroups: ['testIncludeGroup'],
            excludeGroups: ['testExcludeGroup'],
            includeRoles: ['testIncludeRole'],
            excludeRoles: ['testExcludeRole'],
          },
          devices: {
            includeDevices: ['testIncludeDevice'],
            excludeDevices: ['testExcludeDevice'],
          },
        },
      },
    )

    describe('when EntraConditionalAccessPolicy is not specified in the config', () => {
      it('should do nothing', async () => {
        const result = await handler([entraConditionalAccessPolicy])
        expect(result).toEqual({ fixedElements: [], errors: [] })
      })
    })

    describe('when EntraConditionalAccessPolicy is specified in the config', () => {
      describe('when the config specifies omit strategy', () => {
        describe('when the specified field is required', () => {
          beforeEach(() => {
            config.deploy = {
              assignmentFieldsStrategy: {
                EntraConditionalAccessPolicy: {
                  includeApplications: { strategy: 'omit' },
                },
              },
            }
          })

          it('should replace the field value with ["None"]', async () => {
            const expectedInstance = entraConditionalAccessPolicy.clone()
            expectedInstance.value.conditions.applications.includeApplications = ['None']

            const result = await handler([entraConditionalAccessPolicy])
            expect(result).toEqual({
              fixedElements: [expectedInstance],
              errors: [
                {
                  elemID: entraConditionalAccessPolicy.elemID,
                  severity: 'Info',
                  message: 'Changes were made to assignment-related fields',
                  detailedMessage:
                    'Changes were made to assignment-related fields according to the assignmentFieldsStrategy configuration:\n — Field "conditions.applications.includeApplications" was replaced with ["None"]',
                },
              ],
            })
          })
        })

        describe('when the specified field is not required', () => {
          beforeEach(() => {
            config.deploy = {
              assignmentFieldsStrategy: {
                EntraConditionalAccessPolicy: {
                  excludeApplications: { strategy: 'omit' },
                },
              },
            }
          })

          describe.each([undefined, []])('when the field value is %o', value => {
            it('should do nothing', async () => {
              const clonedInstance = entraConditionalAccessPolicy.clone()
              clonedInstance.value.conditions.applications.excludeApplications = value
              const result = await handler([clonedInstance])
              expect(result).toEqual({ fixedElements: [], errors: [] })
            })
          })

          describe('when the specified field is not empty', () => {
            it('should omit the field', async () => {
              const expectedInstance = entraConditionalAccessPolicy.clone()
              delete expectedInstance.value.conditions.applications.excludeApplications

              const result = await handler([entraConditionalAccessPolicy])
              expect(result).toEqual({
                fixedElements: [expectedInstance],
                errors: [
                  {
                    elemID: entraConditionalAccessPolicy.elemID,
                    severity: 'Info',
                    message: 'Changes were made to assignment-related fields',
                    detailedMessage:
                      'Changes were made to assignment-related fields according to the assignmentFieldsStrategy configuration:\n — Field "conditions.applications.excludeApplications" was omitted',
                  },
                ],
              })
            })
          })
        })

        describe('when multiple fields are specified', () => {
          beforeEach(() => {
            config.deploy = {
              assignmentFieldsStrategy: {
                EntraConditionalAccessPolicy: {
                  includeApplications: { strategy: 'omit' },
                  excludeApplications: { strategy: 'omit' },
                },
              },
            }
          })

          it('should modify all the specified fields', async () => {
            const expectedInstance = entraConditionalAccessPolicy.clone()
            expectedInstance.value.conditions.applications.includeApplications = ['None']
            delete expectedInstance.value.conditions.applications.excludeApplications

            const result = await handler([entraConditionalAccessPolicy])
            expect(result).toEqual({
              fixedElements: [expectedInstance],
              errors: [
                {
                  elemID: entraConditionalAccessPolicy.elemID,
                  severity: 'Info',
                  message: 'Changes were made to assignment-related fields',
                  detailedMessage:
                    'Changes were made to assignment-related fields according to the assignmentFieldsStrategy configuration:\n — Field "conditions.applications.includeApplications" was replaced with ["None"]\n — Field "conditions.applications.excludeApplications" was omitted',
                },
              ],
            })
          })
        })
      })

      describe('when the config specifies fallback strategy', () => {
        beforeEach(() => {
          config.deploy = {
            assignmentFieldsStrategy: {
              EntraConditionalAccessPolicy: {
                includeUsers: { strategy: 'fallback', fallbackValue: ['TestFallbackUser'] },
              },
            },
          }
        })

        describe('when the field value is equal to the fallback value', () => {
          it('should do nothing', async () => {
            const clonedInstance = entraConditionalAccessPolicy.clone()
            clonedInstance.value.conditions.users.includeUsers = ['TestFallbackUser']
            const result = await handler([clonedInstance])
            expect(result).toEqual({ fixedElements: [], errors: [] })
          })
        })

        describe('when the field value is not equal to the fallback value', () => {
          it('should replace the field value with the fallback value', async () => {
            const expectedInstance = entraConditionalAccessPolicy.clone()
            expectedInstance.value.conditions.users.includeUsers = ['TestFallbackUser']

            const result = await handler([entraConditionalAccessPolicy])
            expect(result).toEqual({
              fixedElements: [expectedInstance],
              errors: [
                {
                  elemID: entraConditionalAccessPolicy.elemID,
                  severity: 'Info',
                  message: 'Changes were made to assignment-related fields',
                  detailedMessage:
                    'Changes were made to assignment-related fields according to the assignmentFieldsStrategy configuration:\n — Field "conditions.users.includeUsers" was replaced with ["TestFallbackUser"]',
                },
              ],
            })
          })
        })
      })
    })
  })
})
