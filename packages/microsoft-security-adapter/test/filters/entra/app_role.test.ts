/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
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
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils, definitions, fetch } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import _ from 'lodash'
import { PAGINATION } from '../../../src/definitions/requests/pagination'
import { Options } from '../../../src/definitions/types'
import { ADAPTER_NAME, entraConstants } from '../../../src/constants'
import { appRolesFilter } from '../../../src/filters'
import { UserConfig } from '../../../src/config'

const { APP_ROLE_TYPE_NAME, APPLICATION_TYPE_NAME, SERVICE_PRINCIPAL_TYPE_NAME, APP_ROLES_FIELD_NAME } = entraConstants

type ClientInterface = clientUtils.HTTPReadClientInterface & clientUtils.HTTPWriteClientInterface

const mockDeployChanges = jest.fn()
jest.mock('@salto-io/adapter-components', () => ({
  ...jest.requireActual('@salto-io/adapter-components'),
  deployment: {
    ...jest.requireActual('@salto-io/adapter-components').deployment,
    deployChanges: jest.fn().mockImplementation((...args) => mockDeployChanges(...args)),
  },
}))

describe('app roles filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  let client: MockInterface<ClientInterface>

  const mockConfig = {} as UserConfig

  const appRoleType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, APP_ROLE_TYPE_NAME) })
  const applicationType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, APPLICATION_TYPE_NAME) })
  const servicePrincipalType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SERVICE_PRINCIPAL_TYPE_NAME) })

  let mockDefinitions: definitions.ApiDefinitions<Options>

  beforeEach(async () => {
    jest.clearAllMocks()
    mockDeployChanges.mockResolvedValue({ errors: [], appliedChanges: [] })

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
    filter = appRolesFilter({
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

    it('should remove duplicates and keep the app role with the application parent', async () => {
      const appRoleAWithAppParent = new InstanceElement('appRoleA', appRoleType, { id: 'appRoleA' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
      })
      const appRoleAWithSPParent = new InstanceElement('appRoleA', appRoleType, { id: 'appRoleA' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalInstance.elemID, servicePrincipalInstance),
      })
      const appRoleBWithAppParent = new InstanceElement('appRoleB', appRoleType, { id: 'appRoleB' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
      })
      const appRoleCWithSPParent = new InstanceElement('appRoleC', appRoleType, { id: 'appRoleC' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalInstance.elemID, servicePrincipalInstance),
      })

      const elements = [
        applicationInstance,
        servicePrincipalInstance,
        appRoleAWithAppParent,
        appRoleAWithSPParent,
        appRoleBWithAppParent,
        appRoleCWithSPParent,
      ]

      await filter.onFetch?.(elements)
      const expectedRemainingAppRolesFullName = [
        appRoleAWithAppParent,
        appRoleBWithAppParent,
        appRoleCWithSPParent,
      ].map(elem => elem.elemID.getFullName())
      const remainingAppRolesFullName = elements
        .filter(elem => elem.elemID.typeName === APP_ROLE_TYPE_NAME)
        .map(elem => elem.elemID.getFullName())
      expect(remainingAppRolesFullName).toHaveLength(expectedRemainingAppRolesFullName.length)
      expect(remainingAppRolesFullName).toEqual(expect.arrayContaining(expectedRemainingAppRolesFullName))
    })

    it('should arbitrarily remove all but the first app role if none of them have an application parent', async () => {
      const appRoleA = new InstanceElement('appRoleA', appRoleType, { id: 'appRoleA' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalType.elemID, servicePrincipalInstance),
      })
      const appRoleB = new InstanceElement('appRoleA', appRoleType, { id: 'appRoleA' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(servicePrincipalType.elemID, servicePrincipalInstance),
      })

      const elements = [appRoleA, appRoleB]

      await filter.onFetch?.(elements)
      expect(elements).toHaveLength(1)
      expect(elements[0].elemID.getFullName()).toEqual(appRoleA.elemID.getFullName())
    })
  })

  describe('deploy', () => {
    it('should return SaltoError if the deploy definitions are missing', async () => {
      const res = await (
        appRolesFilter({
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
      ).deploy([], { changes: [], groupID: 'a' })
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

    describe('when there is a change in one of the app roles', () => {
      let applicationInstance: InstanceElement
      let appRoleInstanceA: InstanceElement
      let appRoleInstanceB: InstanceElement
      let appRoleInstanceC: InstanceElement
      let nonAppRoleInstance: InstanceElement
      let nonAppRoleChange: Change<InstanceElement>
      let elementsInElementSource: InstanceElement[]
      let elementsInElementSourceBeforeDeploy: InstanceElement[]

      beforeEach(() => {
        applicationInstance = new InstanceElement('app', applicationType, { id: 'app' })
        appRoleInstanceA = new InstanceElement('appRoleA', appRoleType, { id: 'appRoleA' }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
        })
        appRoleInstanceB = new InstanceElement('appRoleB', appRoleType, { not_id: 'appRoleB' }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
        })
        appRoleInstanceC = new InstanceElement('appRoleC', appRoleType, { id: 'appRoleC' }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
        })
        const randomType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'randomType') })
        nonAppRoleInstance = new InstanceElement('nonAppRole', randomType, { id: 'nonAppRole' })
        nonAppRoleChange = toChange({ after: nonAppRoleInstance })

        elementsInElementSource = [
          applicationInstance,
          appRoleInstanceA,
          appRoleInstanceB,
          appRoleInstanceC,
          nonAppRoleInstance,
        ].map(elem => elem.clone())
        elementsInElementSourceBeforeDeploy = elementsInElementSource.map(elem => elem.clone())

        mockDeployChanges.mockImplementation(async ({ changes }) => ({
          errors: [],
          appliedChanges: changes,
        }))
        filter = appRolesFilter({
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
        const appRoleInstanceWithNoParent = new InstanceElement('appRole', appRoleType, { id: 'appRole' })
        const appRoleChange = toChange({ after: appRoleInstanceWithNoParent })
        const changes = [nonAppRoleChange, appRoleChange]

        const result = await filter.deploy(changes, { changes, groupID: 'a' })

        expect(result.deployResult.errors).toHaveLength(1)
        expect(result.deployResult.errors[0].message).toEqual(
          'Expected app role to have an application or service principal parent',
        )
        expect(result.deployResult.errors[0].severity).toEqual('Error')
        expect(result.deployResult.appliedChanges).toHaveLength(0)
        expect(result.leftoverChanges).toHaveLength(1)
        expect(result.leftoverChanges[0]).toEqual(nonAppRoleChange)
      })

      describe('when there are no changes in the parent', () => {
        let appRoleChangeA: Change<InstanceElement>
        let appRoleChangeB: Change<InstanceElement>
        let result: {
          deployResult: DeployResult
          leftoverChanges: Change[]
        }

        beforeEach(async () => {
          appRoleChangeA = toChange({ after: appRoleInstanceA })
          appRoleChangeB = toChange({ after: appRoleInstanceB })

          const changes = [nonAppRoleChange, appRoleChangeA, appRoleChangeB]

          result = await filter.deploy(changes, { changes, groupID: 'a' })
        })

        it('should create and deploy a parent modification change with all its app roles', async () => {
          const changesParam = mockDeployChanges.mock.calls[0][0].changes
          expect(changesParam).toHaveLength(1)
          expect(changesParam[0].action).toEqual('modify')
          expect(_.get(getChangeData(changesParam[0]), `value.${APP_ROLES_FIELD_NAME}`)).toEqual(
            expect.arrayContaining([appRoleInstanceA.value, appRoleInstanceB.value, appRoleInstanceC.value]),
          )
          expect(
            _.get(
              (changesParam[0] as ModificationChange<InstanceElement>).data.before,
              `value.${APP_ROLES_FIELD_NAME}`,
            ),
          ).toBeUndefined()

          expect(result.deployResult.appliedChanges).toEqual([appRoleChangeA, appRoleChangeB])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(result.leftoverChanges).toHaveLength(1)
          expect(result.leftoverChanges[0]).toEqual(nonAppRoleChange)
        })

        it('should assign an id to the app role if it does not have one', async () => {
          const appliedChangeAppRoleB = result.deployResult.appliedChanges.find(change =>
            getChangeData(change).elemID.isEqual(appRoleInstanceB.elemID),
          )
          expect(appliedChangeAppRoleB).toBeDefined()
          // Expect the id to be a newly generated uuid
          expect(getChangeData(appliedChangeAppRoleB as Change<InstanceElement>).value.id).toMatch(/^[\w-]{36}$/)
        })

        it('should not change the id of the app role if it already has one', async () => {
          const appliedChangeAppRoleA = result.deployResult.appliedChanges.find(change =>
            getChangeData(change).elemID.isEqual(appRoleInstanceA.elemID),
          )
          expect(appliedChangeAppRoleA).toBeDefined()
          // Expect the id to be the same as the original id
          expect(getChangeData(appliedChangeAppRoleA as Change<InstanceElement>).value.id).toEqual('appRoleA')
        })

        it('should not change the instances in the element source', async () => {
          expect(elementsInElementSource).toEqual(expect.arrayContaining(elementsInElementSourceBeforeDeploy))
        })
      })

      describe('when there are changes in the parent', () => {
        it('should update the original parent change to include the updated app roles', async () => {
          const applicationChange = toChange({ after: applicationInstance })
          const appRoleChange = toChange({ after: appRoleInstanceA })
          const changes = [nonAppRoleChange, appRoleChange, applicationChange]

          const result = await filter.deploy(changes, { changes, groupID: 'a' })

          const changesParam = mockDeployChanges.mock.calls[0][0].changes
          expect(changesParam).toHaveLength(1)
          expect(changesParam[0].action).toEqual('add')
          expect(changesParam[0]).toEqual(applicationChange)

          expect(result.deployResult.appliedChanges).toEqual([applicationChange, appRoleChange])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(result.leftoverChanges).toHaveLength(1)
          expect(result.leftoverChanges[0]).toEqual(nonAppRoleChange)
        })

        it('should deploy the original parent change as part of the filter if it is deletion', async () => {
          const applicationChange = toChange({ before: applicationInstance })
          const appRoleChange = toChange({ after: appRoleInstanceA })
          const changes = [nonAppRoleChange, appRoleChange, applicationChange]

          const result = await filter.deploy(changes, { changes, groupID: 'a' })

          const changesParam = mockDeployChanges.mock.calls[0][0].changes
          expect(changesParam).toHaveLength(1)
          expect(changesParam[0].action).toEqual('remove')
          expect(_.get(getChangeData(changesParam[0]), `value.${APP_ROLES_FIELD_NAME}`)).toBeUndefined()
          expect(result.deployResult.appliedChanges).toEqual(expect.arrayContaining([applicationChange, appRoleChange]))
          expect(result.deployResult.errors).toHaveLength(0)
          expect(result.leftoverChanges).toEqual([nonAppRoleChange])
        })

        it('should not deploy the changes as part of the filter if the parent change is not an instance change', async () => {
          const applicationChange = toChange({ after: applicationType })
          const appRoleInstance = new InstanceElement('appRole', appRoleType, { id: 'appRole' }, undefined, {
            [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationType.elemID, applicationType),
          })
          const appRoleChange = toChange({ after: appRoleInstance })
          const changes = [nonAppRoleChange, appRoleChange, applicationChange]

          const result = await filter.deploy(changes, { changes, groupID: 'a' })

          expect(mockDeployChanges).not.toHaveBeenCalled()
          expect(result.deployResult.appliedChanges).toHaveLength(0)
          expect(result.deployResult.errors).toHaveLength(1)
          expect(result.deployResult.errors[0].message).toEqual(
            'Expected app role to have an application or service principal parent',
          )
          expect(result.leftoverChanges).toEqual(expect.arrayContaining([nonAppRoleChange, applicationChange]))
        })
      })
    })
  })
})
