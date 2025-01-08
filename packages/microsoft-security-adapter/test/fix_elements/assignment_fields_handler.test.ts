/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { ElemID, FixElementsFunc, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { DEFAULT_CONFIG, UserConfig } from '../../src/config'
import { ADAPTER_NAME, entraConstants, intuneConstants } from '../../src/constants'
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
      elemID: new ElemID(ADAPTER_NAME, intuneConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME),
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
            Intune: {
              [intuneConstants.TOP_LEVEL_TYPES.APPLICATION_TYPE_NAME]: {
                strategy: 'omit',
              },
            },
          },
        }
      })
      describe.each([undefined, []])('when the instance assignments field equals %s', assignments => {
        it('should do nothing', async () => {
          const clonedInstance = intuneApplicationInstance.clone()
          clonedInstance.value.assignments = assignments
          const result = await handler([clonedInstance])
          expect(result).toEqual({ fixedElements: [], errors: [] })
        })
      })

      describe('when the instance assignments field is not empty', () => {
        it('should omit the assignments field', async () => {
          const clonedInstance = intuneApplicationInstance.clone()
          clonedInstance.value.assignments = [{ id: 'testAssignment' }]
          const result = await handler([clonedInstance])
          expect(result).toEqual({
            fixedElements: [intuneApplicationInstance],
            errors: [
              {
                elemID: intuneApplicationInstance.elemID,
                severity: 'Info',
                message: 'The "assignments" field will be omitted',
                detailedMessage:
                  'The "assignments" field will be omitted in the deployment, according to the assignmentFieldsStrategy configuration',
              },
            ],
          })
        })
      })
    })
  })

  describe('Entra conditional access policy', () => {
    const entraConditionalAccessPolicyType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, entraConstants.CONDITIONAL_ACCESS_POLICY_TYPE_NAME),
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
                  message: 'The "conditions.applications.includeApplications" field will be replaced',
                  detailedMessage:
                    'The "conditions.applications.includeApplications" field will be replaced with ["None"] in the deployment, according to the assignmentFieldsStrategy configuration',
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
                  message: 'The "conditions.applications.excludeApplications" field will be omitted',
                  detailedMessage:
                    'The "conditions.applications.excludeApplications" field will be omitted in the deployment, according to the assignmentFieldsStrategy configuration',
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
                  message: 'The "conditions.users.includeUsers" field will be replaced',
                  detailedMessage:
                    'The "conditions.users.includeUsers" field will be replaced with ["TestFallbackUser"] in the deployment, according to the assignmentFieldsStrategy configuration',
                },
              ],
            })
          })
        })
      })
    })
  })
})
