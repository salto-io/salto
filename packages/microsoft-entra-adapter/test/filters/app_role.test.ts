/*
* Copyright 2024 Salto Labs Ltd.
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
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { filterUtils, client as clientUtils, definitions, fetch } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import _ from 'lodash'
import { PAGINATION } from '../../src/definitions/requests/pagination'
import { Options } from '../../src/definitions/types'
import {
  ADAPTER_NAME,
  APPLICATION_TYPE_NAME,
  APP_ROLES_FIELD_NAME,
  APP_ROLE_TYPE_NAME,
  SERVICE_PRINCIPAL_TYPE_NAME,
} from '../../src/constants'
import { appRolesFilter } from '../../src/filters'
import { UserConfig } from '../../src/config'

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
      let nonAppRoleInstance: InstanceElement
      let nonAppRoleChange: Change<InstanceElement>

      beforeEach(() => {
        applicationInstance = new InstanceElement('app', applicationType, { id: 'app' })
        appRoleInstanceA = new InstanceElement('appRoleA', appRoleType, { id: 'appRoleA' }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
        })
        appRoleInstanceB = new InstanceElement('appRoleB', appRoleType, { not_id: 'appRoleB' }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(applicationInstance.elemID, applicationInstance),
        })
        const randomType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'randomType') })
        nonAppRoleInstance = new InstanceElement('nonAppRole', randomType, { id: 'nonAppRole' })
        nonAppRoleChange = toChange({ after: nonAppRoleInstance })
      })

      beforeEach(() => {
        mockDeployChanges.mockResolvedValueOnce({
          errors: [],
          appliedChanges: [toChange({ after: applicationInstance })],
        })
        filter = appRolesFilter({
          definitions: mockDefinitions,
          elementSource: buildElementsSourceFromElements([
            applicationInstance,
            appRoleInstanceA,
            appRoleInstanceB,
            nonAppRoleInstance,
          ]),
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
        it('should create and deploy a parent modification change with all its app roles', async () => {
          const appRoleChange = toChange({ after: appRoleInstanceA })
          const changes = [nonAppRoleChange, appRoleChange]

          const result = await filter.deploy(changes, { changes, groupID: 'a' })

          const changesParam = mockDeployChanges.mock.calls[0][0].changes
          expect(changesParam).toHaveLength(1)
          expect(changesParam[0].action).toEqual('modify')
          expect(_.get(getChangeData(changesParam[0]), `value.${APP_ROLES_FIELD_NAME}`)).toEqual(
            expect.arrayContaining([appRoleInstanceA.value, appRoleInstanceB.value]),
          )
          expect(
            _.get(
              (changesParam[0] as ModificationChange<InstanceElement>).data.before,
              `value.${APP_ROLES_FIELD_NAME}`,
            ),
          ).toBeUndefined()

          expect(result.deployResult.appliedChanges).toEqual([appRoleChange])
          expect(result.deployResult.errors).toHaveLength(0)
          expect(result.leftoverChanges).toHaveLength(1)
          expect(result.leftoverChanges[0]).toEqual(nonAppRoleChange)
        })

        it('should assign an id to the app role if it does not have one', async () => {
          const appRoleChange = toChange({ after: appRoleInstanceB })
          const changes = [nonAppRoleChange, appRoleChange]

          const result = await filter.deploy(changes, { changes, groupID: 'a' })

          const changesParam = mockDeployChanges.mock.calls[0][0].changes
          expect(changesParam).toHaveLength(1)
          expect(changesParam[0].action).toEqual('modify')
          expect(_.get(getChangeData(changesParam[0]), `value.${APP_ROLES_FIELD_NAME}`)).toEqual(
            expect.arrayContaining([appRoleInstanceA.value, appRoleInstanceB.value]),
          )
          expect(
            _.get(
              (changesParam[0] as ModificationChange<InstanceElement>).data.before,
              `value.${APP_ROLES_FIELD_NAME}`,
            ),
          ).toBeUndefined()

          expect(result.deployResult.appliedChanges).toEqual([appRoleChange])
          // Expect the id to be a UUID
          expect(getChangeData(appRoleChange).value.id).toMatch(/^[\w-]{36}$/)
          expect(result.deployResult.errors).toHaveLength(0)
          expect(result.leftoverChanges).toHaveLength(1)
          expect(result.leftoverChanges[0]).toEqual(nonAppRoleChange)
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
