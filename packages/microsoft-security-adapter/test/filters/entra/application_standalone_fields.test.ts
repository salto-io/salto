/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  toChange,
  getChangeData,
  ModificationChange,
  Change,
  DeployResult,
  isModificationChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeDataSync, buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils, definitions, fetch } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { PAGINATION } from '../../../src/definitions/requests/pagination'
import { Options } from '../../../src/definitions/types'
import { MICROSOFT_SECURITY, entraConstants, PARENT_ID_FIELD_NAME } from '../../../src/constants'
import { UserConfig } from '../../../src/config'
import { entraApplicationStandaloneFieldsFilter } from '../../../src/filters'

const {
  TOP_LEVEL_TYPES: {
    APP_ROLE_TYPE_NAME,
    APPLICATION_TYPE_NAME,
    SERVICE_PRINCIPAL_TYPE_NAME,
    OAUTH2_PERMISSION_SCOPE_TYPE_NAME,
  },
  APP_ROLES_FIELD_NAME,
  API_FIELD_NAME,
  DELEGATED_PERMISSION_IDS_FIELD_NAME,
  OAUTH2_PERMISSION_SCOPES_FIELD_NAME,
  PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME,
} = entraConstants

type ClientInterface = clientUtils.HTTPReadClientInterface & clientUtils.HTTPWriteClientInterface

const mockDeployChanges = jest.fn()
jest.mock('@salto-io/adapter-components', () => ({
  ...jest.requireActual('@salto-io/adapter-components'),
  deployment: {
    ...jest.requireActual('@salto-io/adapter-components').deployment,
    deployChanges: jest.fn().mockImplementation((...args) => mockDeployChanges(...args)),
  },
}))

describe(entraApplicationStandaloneFieldsFilter.name, () => {
  type FilterType = filterUtils.FilterWith<'deploy'>

  let filter: FilterType
  let client: MockInterface<ClientInterface>
  let mockDefinitions: definitions.ApiDefinitions<Options>

  const mockConfig = {} as UserConfig
  const appRoleType = new ObjectType({ elemID: new ElemID(MICROSOFT_SECURITY, APP_ROLE_TYPE_NAME) })
  const oauth2PermissionScopeType = new ObjectType({
    elemID: new ElemID(MICROSOFT_SECURITY, OAUTH2_PERMISSION_SCOPE_TYPE_NAME),
  })
  const applicationType = new ObjectType({ elemID: new ElemID(MICROSOFT_SECURITY, APPLICATION_TYPE_NAME) })
  const servicePrincipalType = new ObjectType({ elemID: new ElemID(MICROSOFT_SECURITY, SERVICE_PRINCIPAL_TYPE_NAME) })

  beforeEach(async () => {
    jest.clearAllMocks()

    const mockAddRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'post',
        },
      } as definitions.deploy.DeployRequestEndpointDefinition,
    }
    const mockModifyRequest = {
      request: {
        endpoint: {
          path: '/something',
          method: 'patch',
        },
      } as definitions.deploy.DeployRequestEndpointDefinition,
    }

    client = {
      get: mockFunction<ClientInterface['get']>(),
      put: mockFunction<ClientInterface['put']>(),
      patch: mockFunction<ClientInterface['patch']>(),
      post: mockFunction<ClientInterface['post']>(),
      delete: mockFunction<ClientInterface['delete']>(),
      head: mockFunction<ClientInterface['head']>(),
      options: mockFunction<ClientInterface['options']>(),
      getPageSize: mockFunction<ClientInterface['getPageSize']>(),
    }
    mockDefinitions = {
      clients: {
        default: 'main',
        options: {
          main: {
            httpClient: client,
            endpoints: {
              default: {
                get: {
                  readonly: true,
                },
              },
              customizations: {},
            },
          },
        },
      },
      pagination: PAGINATION,
      deploy: {
        instances: {
          customizations: {
            [APPLICATION_TYPE_NAME]: {
              requestsByAction: {
                customizations: {
                  add: [mockAddRequest],
                  modify: [mockModifyRequest],
                },
              },
            },
            [SERVICE_PRINCIPAL_TYPE_NAME]: {
              requestsByAction: {
                customizations: {
                  add: [mockAddRequest],
                  modify: [mockModifyRequest],
                },
              },
            },
          },
        },
      },
    }
    filter = entraApplicationStandaloneFieldsFilter({
      definitions: mockDefinitions,
      elementSource: buildElementsSourceFromElements([]),
      config: mockConfig,
      fetchQuery: fetch.query.createElementQuery({
        include: [{ type: 'something' }],
        exclude: [],
      }),
      sharedContext: {},
    }) as FilterType
  })

  describe('on fetch', () => {
    const applicationInstance = new InstanceElement('app', applicationType, { id: 'app' })
    const servicePrincipalInstance = new InstanceElement('sp', servicePrincipalType, { id: 'sp' })

    describe('when the standalone fields have parent application', () => {
      it('should remove duplicates and keep the standalone instances with the application parent', async () => {
        const appRoleInstance = new InstanceElement('testAppRole', appRoleType, { id: 'testAppRole' })
        const appRoleWithAppParent = appRoleInstance.clone()
        appRoleWithAppParent.annotations = {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
        }
        const appRoleWithSPParent = appRoleInstance.clone()
        appRoleWithSPParent.annotations = {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalInstance.elemID, servicePrincipalInstance),
        }
        const oauth2PermissionScopeInstance = new InstanceElement('testScope', oauth2PermissionScopeType, {
          id: 'testScope',
        })
        const oauth2PermissionScopeWithAppParent = oauth2PermissionScopeInstance.clone()
        oauth2PermissionScopeWithAppParent.annotations = {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
        }
        const oauth2PermissionScopeWithSPParent = oauth2PermissionScopeInstance.clone()
        oauth2PermissionScopeWithSPParent.annotations = {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalInstance.elemID, servicePrincipalInstance),
        }

        const elements = [
          applicationInstance,
          servicePrincipalInstance,
          appRoleWithAppParent,
          appRoleWithSPParent,
          oauth2PermissionScopeWithAppParent,
          oauth2PermissionScopeWithSPParent,
        ]

        await filter.onFetch?.(elements)
        const expectedRemainingStandaloneFieldsFullNames = [
          appRoleWithAppParent.elemID.getFullName(),
          oauth2PermissionScopeWithAppParent.elemID.getFullName(),
        ]
        const remainingStandaloneFieldsFullName = elements
          .filter(
            elem =>
              elem.elemID.typeName === APP_ROLE_TYPE_NAME || elem.elemID.typeName === OAUTH2_PERMISSION_SCOPE_TYPE_NAME,
          )
          .map(elem => elem.elemID.getFullName())
        expect(remainingStandaloneFieldsFullName).toEqual(
          expect.arrayContaining(expectedRemainingStandaloneFieldsFullNames),
        )
      })
    })

    describe('when the standalone fields do not have parent application', () => {
      it('should arbitrarily remove all but the first standalone field if none of them have an application parent', async () => {
        const appRoleA = new InstanceElement('testAppRole', appRoleType, { id: 'testAppRole' }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalType.elemID, servicePrincipalInstance),
        })
        const appRoleB = new InstanceElement('testAppRole', appRoleType, { id: 'testAppRole' }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalType.elemID, servicePrincipalInstance),
        })
        const oauth2PermissionScopeA = new InstanceElement(
          'testScope',
          oauth2PermissionScopeType,
          { id: 'testScope' },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalType.elemID, servicePrincipalInstance),
          },
        )
        const oauth2PermissionScopeB = new InstanceElement(
          'testScope',
          oauth2PermissionScopeType,
          { id: 'testScope' },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalType.elemID, servicePrincipalInstance),
          },
        )

        const elements = [appRoleA, appRoleB, oauth2PermissionScopeA, oauth2PermissionScopeB]

        await filter.onFetch?.(elements)
        expect(elements.map(elem => elem.elemID.getFullName())).toEqual([
          appRoleA.elemID.getFullName(),
          oauth2PermissionScopeA.elemID.getFullName(),
        ])
      })
    })
  })

  describe('deploy', () => {
    it('should return SaltoError if the deploy definitions are missing', async () => {
      const res = await (
        entraApplicationStandaloneFieldsFilter({
          definitions: {
            ...mockDefinitions,
            deploy: undefined,
          },
          elementSource: buildElementsSourceFromElements([]),
          config: mockConfig,
          fetchQuery: fetch.query.createElementQuery({
            include: [{ type: 'something' }],
            exclude: [],
          }),
          sharedContext: {},
        }) as FilterType
      ).deploy([], { changes: [], groupID: 'test' })
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual('Deploy not supported')
      expect(res.deployResult.errors[0].severity).toEqual('Error')
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('Should return SaltoError if the changeGroup is not provided', async () => {
      const res = await filter.deploy([])
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.errors[0].message).toEqual('Deploy not supported')
      expect(res.deployResult.errors[0].severity).toEqual('Error')
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    describe('valid input', () => {
      let applicationInstance: InstanceElement
      let servicePrincipalInstance: InstanceElement
      let appRoleInstanceA: InstanceElement
      let appRoleInstanceB: InstanceElement
      let appRoleInstanceWithoutId: InstanceElement
      let oauth2PermissionScopeInstanceA: InstanceElement
      let oauth2PermissionScopeInstanceB: InstanceElement
      let otherInstance: InstanceElement
      let otherChange: Change<InstanceElement>
      let elementsInElementSource: InstanceElement[]
      let elementsInElementSourceBeforeDeploy: InstanceElement[]

      beforeEach(() => {
        applicationInstance = new InstanceElement('app', applicationType, { id: 'app' })
        servicePrincipalInstance = new InstanceElement('sp', servicePrincipalType, { id: 'sp' })
        appRoleInstanceA = new InstanceElement('appRoleA', appRoleType, { id: 'appRoleA' })
        appRoleInstanceB = new InstanceElement('appRoleB', appRoleType, { id: 'appRoleB' })
        appRoleInstanceWithoutId = new InstanceElement('appRoleC', appRoleType, { not_id: 'appRoleC' })
        oauth2PermissionScopeInstanceA = new InstanceElement('scopeA', oauth2PermissionScopeType, { id: 'scopeA' })
        oauth2PermissionScopeInstanceB = new InstanceElement('scopeB', oauth2PermissionScopeType, { id: 'scopeB' })
        const randomType = new ObjectType({ elemID: new ElemID(MICROSOFT_SECURITY, 'randomType') })
        otherInstance = new InstanceElement('irrelevant', randomType, { id: 'irrelevant' })
        otherChange = toChange({ after: otherInstance })
      })

      describe('when there are changes in the standalone instances', () => {
        describe('when the standalone instances do not have a parent', () => {
          beforeEach(() => {
            elementsInElementSource = [
              applicationInstance,
              servicePrincipalInstance,
              appRoleInstanceA,
              appRoleInstanceB,
              appRoleInstanceWithoutId,
              oauth2PermissionScopeInstanceA,
              oauth2PermissionScopeInstanceB,
              otherInstance,
            ].map(elem => elem.clone())
            elementsInElementSourceBeforeDeploy = elementsInElementSource.map(elem => elem.clone())

            mockDeployChanges.mockImplementation(async ({ changes: receivedChanges }) => ({
              errors: [],
              appliedChanges: receivedChanges.map((change: Change<InstanceElement>) =>
                applyFunctionToChangeDataSync(change, inst => inst.clone()),
              ),
            }))

            filter = entraApplicationStandaloneFieldsFilter({
              definitions: mockDefinitions,
              elementSource: buildElementsSourceFromElements(elementsInElementSource),
              config: mockConfig,
              fetchQuery: fetch.query.createElementQuery({
                include: [{ type: 'something' }],
                exclude: [],
              }),
              sharedContext: {},
            }) as FilterType
          })

          it('Should return SaltoElementError if one of the instance changes does not have a parent', async () => {
            const appRoleChange = toChange({ after: appRoleInstanceA })
            const oauth2PermissionScopeChange = toChange({ after: oauth2PermissionScopeInstanceA })
            const changes = [otherChange, appRoleChange, oauth2PermissionScopeChange]

            const result = await filter.deploy(changes, { changes, groupID: 'test' })

            expect(result.deployResult.errors).toEqual(
              expect.arrayContaining([
                {
                  elemID: getChangeData(appRoleChange).elemID,
                  message: 'Expected EntraAppRole to have an application or service principal parent',
                  detailedMessage: 'Expected EntraAppRole to have an application or service principal parent',
                  severity: 'Error',
                },
                {
                  elemID: getChangeData(oauth2PermissionScopeChange).elemID,
                  message: 'Expected EntraOauth2PermissionScope to have an application or service principal parent',
                  detailedMessage:
                    'Expected EntraOauth2PermissionScope to have an application or service principal parent',
                  severity: 'Error',
                },
              ]),
            )
            expect(result.deployResult.appliedChanges).toHaveLength(0)
            expect(result.leftoverChanges).toHaveLength(1)
            expect(result.leftoverChanges[0]).toEqual(otherChange)
          })
        })

        describe.each([APPLICATION_TYPE_NAME, SERVICE_PRINCIPAL_TYPE_NAME])(
          'when the standalone instances have an %s parent',
          parentTypeName => {
            let parent: InstanceElement
            let appRoleChange: Change<InstanceElement>
            let appRoleChangeWithoutId: Change<InstanceElement>
            let oauth2PermissionScopeChange: Change<InstanceElement>

            beforeEach(() => {
              parent = parentTypeName === APPLICATION_TYPE_NAME ? applicationInstance : servicePrincipalInstance
              appRoleInstanceA.annotations = {
                [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parent.elemID, parent),
              }
              appRoleInstanceB.annotations = {
                [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parent.elemID, parent),
              }
              appRoleInstanceWithoutId.annotations = {
                [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parent.elemID, parent),
              }
              oauth2PermissionScopeInstanceA.annotations = {
                [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parent.elemID, parent),
              }
              oauth2PermissionScopeInstanceB.annotations = {
                [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parent.elemID, parent),
              }
              appRoleChange = toChange({ after: appRoleInstanceA })
              appRoleChangeWithoutId = toChange({ after: appRoleInstanceWithoutId })
              oauth2PermissionScopeChange = toChange({ after: oauth2PermissionScopeInstanceA })

              elementsInElementSource = [
                applicationInstance,
                servicePrincipalInstance,
                appRoleInstanceA,
                appRoleInstanceB,
                appRoleInstanceWithoutId,
                oauth2PermissionScopeInstanceA,
                oauth2PermissionScopeInstanceB,
                otherInstance,
              ].map(elem => elem.clone())
              elementsInElementSourceBeforeDeploy = elementsInElementSource.map(elem => elem.clone())

              mockDeployChanges.mockImplementation(async ({ changes: receivedChanges }) => ({
                errors: [],
                appliedChanges: receivedChanges.map((change: Change<InstanceElement>) =>
                  applyFunctionToChangeDataSync(change, inst => inst.clone()),
                ),
              }))

              filter = entraApplicationStandaloneFieldsFilter({
                definitions: mockDefinitions,
                elementSource: buildElementsSourceFromElements(elementsInElementSource),
                config: mockConfig,
                fetchQuery: fetch.query.createElementQuery({
                  include: [{ type: 'something' }],
                  exclude: [],
                }),
                sharedContext: {},
              }) as FilterType
            })

            describe('when there are no changes in the parent', () => {
              let result: {
                deployResult: DeployResult
                leftoverChanges: Change[]
              }

              beforeEach(async () => {
                const changes = [otherChange, appRoleChange, appRoleChangeWithoutId, oauth2PermissionScopeChange]
                result = await filter.deploy(changes, { changes, groupID: 'test' })
              })

              it('should create and deploy a parent modification change with all its standalone fields', async () => {
                const changesParam = mockDeployChanges.mock.calls[0][0].changes
                expect(changesParam).toHaveLength(1)
                const parentChange = changesParam[0] as ModificationChange<InstanceElement>
                expect(isModificationChange(parentChange)).toBeTruthy()
                const parentChangeData = getChangeData(parentChange)
                expect(_.get(parentChangeData.value, APP_ROLES_FIELD_NAME)).toEqual(
                  expect.arrayContaining([
                    { id: 'appRoleA' },
                    { id: 'appRoleB' },
                    { id: expect.stringMatching(/^[\w-]{36}$/), not_id: 'appRoleC' },
                  ]),
                )
                expect(_.get(parentChange.data.before.value, APP_ROLES_FIELD_NAME)).toBeUndefined()

                const scopeFieldPath =
                  parentTypeName === APPLICATION_TYPE_NAME
                    ? [API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME]
                    : [OAUTH2_PERMISSION_SCOPES_FIELD_NAME]
                expect(_.get(parentChangeData.value, scopeFieldPath)).toEqual(
                  expect.arrayContaining([{ id: 'scopeA' }, { id: 'scopeB' }]),
                )
                expect(_.get(parentChange.data.before.value, scopeFieldPath)).toBeUndefined()

                expect(result.deployResult.appliedChanges).toEqual([
                  appRoleChange,
                  appRoleChangeWithoutId,
                  oauth2PermissionScopeChange,
                ])
                expect(result.deployResult.errors).toHaveLength(0)
                expect(result.leftoverChanges).toHaveLength(1)
                expect(result.leftoverChanges[0]).toEqual(otherChange)
              })

              it('should not change the instances in the element source', async () => {
                expect(elementsInElementSource).toEqual(expect.arrayContaining(elementsInElementSourceBeforeDeploy))
              })
            })

            describe('when there are changes in the parent', () => {
              describe('when the parent change is an addition change', () => {
                let parentChange: Change<InstanceElement>
                let result: {
                  deployResult: DeployResult
                  leftoverChanges: Change[]
                }

                beforeEach(async () => {
                  parentChange = toChange({ after: parent })
                  const clonedParentChange = applyFunctionToChangeDataSync(parentChange, inst => inst.clone())
                  const changes = [
                    otherChange,
                    clonedParentChange,
                    appRoleChange,
                    appRoleChangeWithoutId,
                    oauth2PermissionScopeChange,
                  ]
                  result = await filter.deploy(changes, { changes, groupID: 'test' })
                })

                it('should update the original parent change to include the updated standalone fields', async () => {
                  const changesParam = mockDeployChanges.mock.calls[0][0].changes
                  expect(changesParam).toHaveLength(1)
                  expect(changesParam[0].action).toEqual('add')
                  const parentChangeData: InstanceElement = getChangeData(changesParam[0])
                  expect(_.get(parentChangeData.value, APP_ROLES_FIELD_NAME)).toEqual(
                    expect.arrayContaining([
                      { id: 'appRoleA' },
                      { id: 'appRoleB' },
                      { id: expect.stringMatching(/^[\w-]{36}$/), not_id: 'appRoleC' },
                    ]),
                  )

                  const scopeFieldPath =
                    parentTypeName === APPLICATION_TYPE_NAME
                      ? [API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME]
                      : [OAUTH2_PERMISSION_SCOPES_FIELD_NAME]
                  expect(_.get(parentChangeData.value, scopeFieldPath)).toEqual(
                    expect.arrayContaining([{ id: 'scopeA' }, { id: 'scopeB' }]),
                  )

                  expect(result.deployResult.appliedChanges).toEqual(
                    expect.arrayContaining([
                      parentChange,
                      appRoleChange,
                      appRoleChangeWithoutId,
                      oauth2PermissionScopeChange,
                    ]),
                  )
                  expect(result.deployResult.errors).toHaveLength(0)
                  expect(result.leftoverChanges).toHaveLength(1)
                  expect(result.leftoverChanges[0]).toEqual(otherChange)
                })
              })

              describe('when the parent change is a deletion change', () => {
                let parentChange: Change<InstanceElement>
                let result: {
                  deployResult: DeployResult
                  leftoverChanges: Change[]
                }

                beforeEach(async () => {
                  parentChange = toChange({ before: parent })
                  const changes = [otherChange, parentChange, appRoleChange, oauth2PermissionScopeChange]
                  result = await filter.deploy(changes, { changes, groupID: 'test' })
                })

                it('should deploy the original parent change as part of the filter', async () => {
                  const changesParam = mockDeployChanges.mock.calls[0][0].changes
                  expect(changesParam).toHaveLength(1)
                  expect(changesParam[0].action).toEqual('remove')
                  expect(_.get(getChangeData(changesParam[0]), `value.${APP_ROLES_FIELD_NAME}`)).toBeUndefined()
                  expect(result.deployResult.appliedChanges).toEqual(
                    expect.arrayContaining([parentChange, appRoleChange]),
                  )
                  expect(result.deployResult.errors).toHaveLength(0)
                  expect(result.leftoverChanges).toEqual([otherChange])
                })
              })

              describe('when the parent change is not an instance change', () => {
                let parentChange: Change<ObjectType>
                let result: {
                  deployResult: DeployResult
                  leftoverChanges: Change[]
                }

                beforeEach(async () => {
                  const parentType = parentTypeName === APPLICATION_TYPE_NAME ? applicationType : servicePrincipalType
                  getChangeData(appRoleChange).annotations = {
                    [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parentType.elemID, parentType),
                  }
                  getChangeData(oauth2PermissionScopeChange).annotations = {
                    [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(parentType.elemID, parentType),
                  }
                  parentChange = toChange({ after: parentType })
                  const changes = [otherChange, parentChange, appRoleChange, oauth2PermissionScopeChange]
                  result = await filter.deploy(changes, { changes, groupID: 'test' })
                })

                it('should not deploy the changes as part of the filter if the parent change is not an instance change', async () => {
                  expect(mockDeployChanges).not.toHaveBeenCalled()
                  expect(result.deployResult.appliedChanges).toHaveLength(0)
                  expect(result.deployResult.errors).toEqual(
                    expect.arrayContaining([
                      {
                        elemID: getChangeData(appRoleChange).elemID,
                        message: 'Expected EntraAppRole to have an application or service principal parent',
                        detailedMessage: 'Expected EntraAppRole to have an application or service principal parent',
                        severity: 'Error',
                      },
                      {
                        elemID: getChangeData(oauth2PermissionScopeChange).elemID,
                        message:
                          'Expected EntraOauth2PermissionScope to have an application or service principal parent',
                        detailedMessage:
                          'Expected EntraOauth2PermissionScope to have an application or service principal parent',
                        severity: 'Error',
                      },
                    ]),
                  )
                  expect(result.leftoverChanges).toEqual(expect.arrayContaining([otherChange, parentChange]))
                })
              })
            })
          },
        )

        describe('when the application parent object contains references to the standalone instances', () => {
          let oauth2PermissionScopeChange: Change<InstanceElement>
          let changes: Change<InstanceElement>[]

          beforeEach(() => {
            applicationInstance.value.api = {
              [PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME]: [
                {
                  appId: 'someApp',
                  [DELEGATED_PERMISSION_IDS_FIELD_NAME]: [
                    new ReferenceExpression(oauth2PermissionScopeInstanceA.elemID, oauth2PermissionScopeInstanceA),
                  ],
                },
              ],
            }
            appRoleInstanceA.annotations = {
              [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
            }
            oauth2PermissionScopeInstanceA.annotations = {
              [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
            }
            oauth2PermissionScopeChange = toChange({ after: oauth2PermissionScopeInstanceA })
            changes = [otherChange, oauth2PermissionScopeChange]

            mockDeployChanges.mockImplementation(async ({ changes: receivedChanges }) => ({
              errors: [],
              appliedChanges: receivedChanges.map((change: Change<InstanceElement>) =>
                applyFunctionToChangeDataSync(change, inst => inst.clone()),
              ),
            }))

            filter = entraApplicationStandaloneFieldsFilter({
              definitions: mockDefinitions,
              elementSource: buildElementsSourceFromElements(elementsInElementSource),
              config: mockConfig,
              fetchQuery: fetch.query.createElementQuery({
                include: [{ type: 'something' }],
                exclude: [],
              }),
              sharedContext: {},
            }) as FilterType
          })

          describe('when the reference value has an id field', () => {
            it('should deploy without updating the reference value with the parent id', async () => {
              const result = await filter.deploy(changes, { changes, groupID: 'test' })
              expect(mockDeployChanges).toHaveBeenCalled()
              expect(result.deployResult.appliedChanges).toEqual([oauth2PermissionScopeChange])
              expect(result.deployResult.errors).toHaveLength(0)
              expect(result.leftoverChanges).toEqual([otherChange])
            })
          })

          describe('when the reference value does not have an id field', () => {
            describe('when the referenced instance exists in the changes', () => {
              beforeEach(() => {
                oauth2PermissionScopeInstanceA.value = { not_id: 'scopeA' }
              })

              it('should update the reference value with the generated uuid', async () => {
                const result = await filter.deploy(changes, { changes, groupID: 'test' })

                expect(mockDeployChanges).toHaveBeenCalled()
                const changesParam = mockDeployChanges.mock.calls[0][0].changes
                expect(changesParam).toHaveLength(1)
                expect(isModificationChange(changesParam[0])).toBeTruthy()
                const changeData = getChangeData(changesParam[0] as ModificationChange<InstanceElement>)
                const scopeRef = _.get(changeData.value, [
                  API_FIELD_NAME,
                  PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME,
                  0,
                  DELEGATED_PERMISSION_IDS_FIELD_NAME,
                  0,
                ])
                expect(scopeRef.value.value.id).toEqual(expect.stringMatching(/^[\w-]{36}$/))

                expect(result.deployResult.appliedChanges).toEqual([oauth2PermissionScopeChange])
                expect(result.deployResult.errors).toHaveLength(0)
                expect(result.leftoverChanges).toEqual([otherChange])
              })
            })

            describe('when the referenced instance does not exist in the element source', () => {
              beforeEach(() => {
                const newOauth2PermissionScopeInstance = new InstanceElement('newScope', oauth2PermissionScopeType, {
                  not_id: 'newScope',
                })
                applicationInstance.value.api = {
                  [PRE_AUTHORIZED_APPLICATIONS_FIELD_NAME]: [
                    {
                      appId: 'someApp',
                      [DELEGATED_PERMISSION_IDS_FIELD_NAME]: [
                        new ReferenceExpression(
                          newOauth2PermissionScopeInstance.elemID,
                          newOauth2PermissionScopeInstance,
                        ),
                      ],
                    },
                  ],
                }
              })

              it('should deploy without updating the reference value with the instance id', async () => {
                const result = await filter.deploy(changes, { changes, groupID: 'test' })

                expect(mockDeployChanges).toHaveBeenCalled()
                expect(result.deployResult.appliedChanges).toEqual([oauth2PermissionScopeChange])
                expect(result.deployResult.errors).toHaveLength(0)
                expect(result.leftoverChanges).toEqual([otherChange])
              })
            })
          })
        })
      })

      describe('when there are no changes in the standalone instances', () => {
        let changes: Change<InstanceElement>[]
        let result: {
          deployResult: DeployResult
          leftoverChanges: Change[]
        }

        beforeEach(async () => {
          const applicationChange = toChange({ after: applicationInstance })
          const servicePrincipalChange = toChange({ after: servicePrincipalInstance })
          changes = [otherChange, applicationChange, servicePrincipalChange]
          result = await filter.deploy(changes, { changes, groupID: 'test' })
        })

        it('should not deploy any changes', async () => {
          expect(mockDeployChanges).not.toHaveBeenCalled()
          expect(result.deployResult.appliedChanges).toHaveLength(0)
          expect(result.deployResult.errors).toHaveLength(0)
          expect(result.leftoverChanges).toEqual(changes)
        })
      })
    })
  })

  describe('on deploy', () => {
    describe('when there is a change in one of the standalone instances', () => {
      let applicationInstance: InstanceElement
      let servicePrincipalInstance: InstanceElement
      let appRoleInstanceWithoutParentId: InstanceElement
      let oauth2PermissionScopeInstanceWithoutParentId: InstanceElement

      beforeEach(() => {
        applicationInstance = new InstanceElement('app', applicationType, { id: 'app' })
        servicePrincipalInstance = new InstanceElement('sp', servicePrincipalType, { id: 'sp' })
        appRoleInstanceWithoutParentId = new InstanceElement('appRole', appRoleType, { id: 'appRole' })
        oauth2PermissionScopeInstanceWithoutParentId = new InstanceElement('scope', oauth2PermissionScopeType, {
          id: 'scope',
        })
      })

      describe('when the instances do not have a parent id field', () => {
        describe('when the instances do not have a parent reference', () => {
          it('should not throw an error', async () => {
            const changes = [
              toChange({ after: appRoleInstanceWithoutParentId }),
              toChange({ after: oauth2PermissionScopeInstanceWithoutParentId }),
            ]
            await filter.onDeploy?.(changes)
            expect(appRoleInstanceWithoutParentId.value).toEqual({ id: 'appRole' })
            expect(oauth2PermissionScopeInstanceWithoutParentId.value).toEqual({ id: 'scope' })
          })
        })

        describe('when the instances have a parent reference', () => {
          beforeEach(() => {
            appRoleInstanceWithoutParentId.annotations = {
              [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
            }
            oauth2PermissionScopeInstanceWithoutParentId.annotations = {
              [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(
                servicePrincipalInstance.elemID,
                servicePrincipalInstance,
              ),
            }
          })

          describe('when the parent id exist on the parent reference value', () => {
            it('should update the standalone instances with the parent id from the parent reference value', async () => {
              const changes = [
                toChange({ after: appRoleInstanceWithoutParentId }),
                toChange({ after: oauth2PermissionScopeInstanceWithoutParentId }),
              ]
              await filter.onDeploy?.(changes)
              expect(appRoleInstanceWithoutParentId.value).toEqual({ id: 'appRole', [PARENT_ID_FIELD_NAME]: 'app' })
              expect(oauth2PermissionScopeInstanceWithoutParentId.value).toEqual({
                id: 'scope',
                [PARENT_ID_FIELD_NAME]: 'sp',
              })
            })
          })

          describe('when the parent id does not exist on the parent reference value', () => {
            beforeEach(() => {
              applicationInstance.value = { not_id: 'app' }
              servicePrincipalInstance.value = { not_id: 'sp' }
            })

            describe('when there is a parent change in the changes', () => {
              it('should update the standalone instances with the parent id from the parent change', async () => {
                const newApplicationInstance = applicationInstance.clone()
                const newServicePrincipalInstance = servicePrincipalInstance.clone()
                newApplicationInstance.value = { id: 'newApp' }
                newServicePrincipalInstance.value = { id: 'newSp' }

                const changes = [
                  toChange({ after: appRoleInstanceWithoutParentId }),
                  toChange({ after: oauth2PermissionScopeInstanceWithoutParentId }),
                  toChange({ after: newApplicationInstance }),
                  toChange({ after: newServicePrincipalInstance }),
                ]
                await filter.onDeploy?.(changes)
                expect(appRoleInstanceWithoutParentId.value).toEqual({
                  id: 'appRole',
                  [PARENT_ID_FIELD_NAME]: 'newApp',
                })
                expect(oauth2PermissionScopeInstanceWithoutParentId.value).toEqual({
                  id: 'scope',
                  [PARENT_ID_FIELD_NAME]: 'newSp',
                })
              })
            })

            describe('when there is no parent change in the changes', () => {
              it('should not update the standalone instances', async () => {
                const changes = [
                  toChange({ after: appRoleInstanceWithoutParentId }),
                  toChange({ after: oauth2PermissionScopeInstanceWithoutParentId }),
                ]
                await filter.onDeploy?.(changes)
                expect(appRoleInstanceWithoutParentId.value).toEqual({ id: 'appRole' })
                expect(oauth2PermissionScopeInstanceWithoutParentId.value).toEqual({ id: 'scope' })
              })
            })
          })
        })
      })
    })
  })
})
