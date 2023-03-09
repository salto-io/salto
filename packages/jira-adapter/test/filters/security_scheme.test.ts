/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, getChangeData, InstanceElement, isReferenceExpression, ListType, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../utils'
import securitySchemeFilter, { NO_DEFAULT_VALUE } from '../../src/filters/security_scheme/security_scheme'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA, SECURITY_LEVEL_MEMBER_TYPE, SECURITY_LEVEL_TYPE, SECURITY_SCHEME_TYPE } from '../../src/constants'
import { deployWithJspEndpoints } from '../../src/deployment/jsp_deployment'
import JiraClient from '../../src/client/client'

jest.mock('../../src/deployment/jsp_deployment', () => ({
  ...jest.requireActual<{}>('../../src/deployment/jsp_deployment'),
  deployWithJspEndpoints: jest.fn(),
}))

describe('securitySchemeFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
  let securitySchemeType: ObjectType
  let securityLevelType: ObjectType
  let securityMemberType: ObjectType
  let securitySchemeInstance: InstanceElement
  let securityLevelInstance: InstanceElement
  let config: JiraConfig
  let client: JiraClient

  beforeEach(async () => {
    securityMemberType = new ObjectType({
      elemID: new ElemID(JIRA, SECURITY_LEVEL_MEMBER_TYPE),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        holder: { refType: BuiltinTypes.UNKNOWN },
      },
    })

    securityLevelType = new ObjectType({
      elemID: new ElemID(JIRA, SECURITY_LEVEL_TYPE),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        members: { refType: new ListType(securityMemberType) },
      },
    })

    securitySchemeType = new ObjectType({
      elemID: new ElemID(JIRA, SECURITY_SCHEME_TYPE),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        name: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        levels: { refType: new ListType(securityLevelType) },
        defaultLevel: { refType: securityLevelType },
      },
    })

    securityLevelInstance = new InstanceElement(
      'securityLevel',
      securityLevelType,
      {
        name: 'securityLevelName',
        description: 'securityLevelDesc',
        members: [
          {
            holder: {
              type: 'group',
              parameter: 'atlassian-addons-admin',
            },
          },
          {
            holder: {
              type: 'projectLead',
            },
          },
        ],
      }
    )

    securitySchemeInstance = new InstanceElement(
      'securityScheme',
      securitySchemeType,
      {
        id: '1',
        name: 'securitySchemeName',
        description: 'securitySchemeDesc',
        levels: [
          new ReferenceExpression(securityLevelInstance.elemID, securityLevelInstance),
        ],
        defaultLevel: new ReferenceExpression(
          securityLevelInstance.elemID,
          securityLevelInstance.clone()
        ),
      }
    )

    securityLevelInstance.value.id = '2'

    securityLevelInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(securitySchemeInstance.elemID, securitySchemeInstance),
    ]
  })
  describe('cloud', () => {
    beforeEach(async () => {
      const { client: cli, paginator } = mockClient()
      client = cli

      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      filter = securitySchemeFilter(getFilterParams({
        client,
        paginator,
        config,
      })) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>
    })
    describe('onFetch', () => {
      it('should add deployment annotations', async () => {
        await filter.onFetch([securitySchemeType, securityLevelType, securityMemberType])
        expect(securitySchemeType.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
          [CORE_ANNOTATIONS.DELETABLE]: true,
        })

        expect(securitySchemeType.fields.id.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securitySchemeType.fields.name.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securitySchemeType.fields.description.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securitySchemeType.fields.levels.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securityLevelType.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
          [CORE_ANNOTATIONS.DELETABLE]: true,
        })

        expect(securityLevelType.fields.id.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securityLevelType.fields.name.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securityLevelType.fields.description.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securityLevelType.fields.members.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securityLevelType.fields.memberIds.annotations).toEqual({
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        })

        expect(securityMemberType.fields.id.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })

        expect(securityMemberType.fields.holder.annotations).toEqual({
          [CORE_ANNOTATIONS.CREATABLE]: true,
          [CORE_ANNOTATIONS.UPDATABLE]: true,
        })
      })

      it('should not add deployment annotations when usePrivateAPI config is off', async () => {
        config.client.usePrivateAPI = false

        await filter.onFetch([securitySchemeType, securityLevelType, securityMemberType])

        expect(securitySchemeType.annotations).toEqual({})
        expect(securityLevelType.fields.name.annotations).toEqual({})
      })

      it('should add memberIds to securityLevels', async () => {
        securityLevelInstance.value.members[0].id = '1'
        securityLevelInstance.value.members[1].id = '2'

        await filter.onFetch([securityLevelInstance, securitySchemeType, securityLevelType])

        expect(securityLevelInstance.value.memberIds).toEqual({
          'group-atlassian-addons-admin': '1',
          'projectLead-undefined': '2',
        })

        expect(securityLevelInstance.value.members[0].id).toBeUndefined()
        expect(securityLevelInstance.value.members[1].id).toBeUndefined()
      })

      it('should add empty memberIds when there are not members', async () => {
        delete securityLevelInstance.value.members
        await filter.onFetch([securityLevelInstance, securityLevelType])

        expect(securityLevelInstance.value.memberIds).toEqual({})
      })

      it('should omit invalid members', async () => {
        securityLevelInstance.value.members = [
          {},
          {
            holder: {
              type: 'type',
              parameter: 'param',
            },
          },
        ]
        await filter.onFetch([securityLevelInstance, securityLevelType])

        expect(securityLevelInstance.value.members).toEqual([
          {
            holder: {
              type: 'type',
              parameter: 'param',
            },
          },
        ])
      })

      it('should add defaultLevel to securityScheme', async () => {
        const originalScheme = securitySchemeInstance.clone()
        securitySchemeInstance.value.defaultSecurityLevelId = securitySchemeInstance.value
          .defaultLevel
        delete securitySchemeInstance.value.defaultLevel

        await filter.onFetch([securitySchemeInstance])

        expect(securitySchemeInstance.value.defaultLevel).toEqual(originalScheme.value.defaultLevel)
      })
    })

    describe('deploy', () => {
      let deployWithJspEndpointsMock: jest.MockedFunction<typeof deployWithJspEndpoints>
      beforeEach(() => {
        deployWithJspEndpointsMock = deployWithJspEndpoints as jest.MockedFunction<
          typeof deployWithJspEndpoints
        >

        deployWithJspEndpointsMock.mockClear()

        deployWithJspEndpointsMock.mockImplementation(async ({ changes }) => ({
          appliedChanges: changes,
          errors: [],
        }))
      })

      it('should call deployWithJspEndpoints in the right order on creation', async () => {
        const { deployResult } = await filter.deploy([
          toChange({ after: securitySchemeInstance }),
          toChange({ after: securityLevelInstance }),
        ])

        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges.map(change => change.action)).toEqual(['add', 'add'])

        expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(1, {
          changes: [toChange({ after: securitySchemeInstance })],
          client,
          urls: {
            add: '/secure/admin/AddIssueSecurityScheme.jspa',
            modify: '/secure/admin/EditIssueSecurityScheme.jspa',
            remove: '/secure/admin/DeleteIssueSecurityScheme.jspa',
            query: '/rest/api/3/issuesecurityschemes',
            dataField: 'issueSecuritySchemes',
          },
          serviceValuesTransformer: expect.toBeFunction(),
          fieldsToIgnore: ['levels', 'defaultLevel'],
        })

        expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(2, {
          changes: [toChange({ after: securityLevelInstance })],
          client,
          urls: {
            add: '/secure/admin/EditIssueSecurities!addLevel.jspa',
            modify: '/secure/admin/EditSecurityLevel.jspa',
            remove: '/secure/admin/DeleteIssueSecurityLevel.jspa',
            query: '/rest/api/3/issuesecurityschemes/1',
            dataField: 'levels',
          },
          serviceValuesTransformer: expect.toBeFunction(),
          fieldsToIgnore: ['members'],
        })

        expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(3, {
          changes: [
            toChange({ after: new InstanceElement(
              'group-atlassian-addons-admin',
              securityMemberType,
              {
                name: 'group-atlassian-addons-admin',
                schemeId: '1',
                security: '2',
                type: 'group',
                group: 'atlassian-addons-admin',
              }
            ) }),
            toChange({ after: new InstanceElement(
              'projectLead-undefined',
              securityMemberType,
              {
                name: 'projectLead-undefined',
                schemeId: '1',
                security: '2',
                type: 'lead',
              }
            ) })],
          client,
          urls: {
            add: '/secure/admin/AddIssueSecurity.jspa',
            remove: '/secure/admin/DeleteIssueSecurity.jspa',
            query: '/rest/api/3/issuesecurityschemes/1/members',
            dataField: 'values',
          },
          serviceValuesTransformer: expect.toBeFunction(),
          getNameFunction: expect.toBeFunction(),
        })

        const noDefaultScheme = securitySchemeInstance.clone()
        delete noDefaultScheme.value.defaultLevel

        expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(4, {
          changes: [toChange({ before: noDefaultScheme, after: securitySchemeInstance })],
          client,
          urls: {
            add: '/secure/admin/AddIssueSecurityScheme.jspa',
            modify: '/secure/admin/EditIssueSecurityScheme.jspa',
            remove: '/secure/admin/DeleteIssueSecurityScheme.jspa',
            query: '/rest/api/3/issuesecurityschemes',
            dataField: 'issueSecuritySchemes',
          },
          serviceValuesTransformer: expect.toBeFunction(),
          fieldsToIgnore: ['levels'],
        })
      })

      it('should return the error from deployWithJspEndpoints when deploying the schemes', async () => {
        deployWithJspEndpointsMock.mockResolvedValue({
          appliedChanges: [],
          errors: [new Error('error')],
        })

        const { deployResult } = await filter.deploy([
          toChange({ after: securitySchemeInstance }),
          toChange({ after: securityLevelInstance }),
        ])

        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.appliedChanges).toHaveLength(0)

        expect(deployWithJspEndpointsMock).toHaveBeenCalledTimes(1)
      })

      it('should return the error from deployWithJspEndpoints when deploying the members', async () => {
        deployWithJspEndpointsMock.mockImplementationOnce(async ({ changes }) => ({
          appliedChanges: changes,
          errors: [],
        }))
        deployWithJspEndpointsMock.mockResolvedValueOnce({
          appliedChanges: [],
          errors: [new Error('error')],
        })

        const { deployResult } = await filter.deploy([
          toChange({ after: securityLevelInstance }),
        ])

        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.appliedChanges).toHaveLength(0)

        expect(deployWithJspEndpointsMock).toHaveBeenCalledTimes(2)
      })

      it('should call deployWithJspEndpoints in the right order on modification', async () => {
        securityLevelInstance.value.memberIds = {
          'group-atlassian-addons-admin': '1',
          'other-undefined': '3',
        }
        const { deployResult } = await filter.deploy([
          toChange({ before: securitySchemeInstance, after: securitySchemeInstance }),
          toChange({ before: securityLevelInstance, after: securityLevelInstance }),
        ])

        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges.map(change => change.action)).toEqual(['modify', 'modify'])

        expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(1, {
          changes: [toChange({ before: securityLevelInstance, after: securityLevelInstance })],
          client,
          urls: {
            add: '/secure/admin/EditIssueSecurities!addLevel.jspa',
            modify: '/secure/admin/EditSecurityLevel.jspa',
            remove: '/secure/admin/DeleteIssueSecurityLevel.jspa',
            query: '/rest/api/3/issuesecurityschemes/1',
            dataField: 'levels',
          },
          serviceValuesTransformer: expect.toBeFunction(),
          fieldsToIgnore: ['members'],
        })

        expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(2, {
          changes: [
            toChange({ before: new InstanceElement(
              'other-undefined',
              securityMemberType,
              {
                name: 'other-undefined',
                schemeId: '1',
                id: '3',
              }
            ) }),
            toChange({ after: new InstanceElement(
              'projectLead-undefined',
              securityMemberType,
              {
                name: 'projectLead-undefined',
                schemeId: '1',
                security: '2',
                type: 'lead',
              }
            ) })],
          client,
          urls: {
            add: '/secure/admin/AddIssueSecurity.jspa',
            remove: '/secure/admin/DeleteIssueSecurity.jspa',
            query: '/rest/api/3/issuesecurityschemes/1/members',
            dataField: 'values',
          },
          serviceValuesTransformer: expect.toBeFunction(),
          getNameFunction: expect.toBeFunction(),
        })

        expect(deployWithJspEndpointsMock).toHaveBeenNthCalledWith(3, {
          changes: [toChange({ before: securitySchemeInstance, after: securitySchemeInstance })],
          client,
          urls: {
            add: '/secure/admin/AddIssueSecurityScheme.jspa',
            modify: '/secure/admin/EditIssueSecurityScheme.jspa',
            remove: '/secure/admin/DeleteIssueSecurityScheme.jspa',
            query: '/rest/api/3/issuesecurityschemes',
            dataField: 'issueSecuritySchemes',
          },
          serviceValuesTransformer: expect.toBeFunction(),
          fieldsToIgnore: ['levels'],
        })
      })

      it('should throw if there are no jsp urls for security level', async () => {
        delete config.apiDefinitions.types[SECURITY_LEVEL_TYPE].jspRequests

        await expect(filter.deploy?.([toChange({ after: securityLevelInstance })])).rejects.toThrow()
      })

      it('should return an error if there are no jsp urls for security level members', async () => {
        delete config.apiDefinitions.types[SECURITY_LEVEL_MEMBER_TYPE].jspRequests

        const { deployResult: { errors, appliedChanges } } = await filter.deploy(
          [toChange({ after: securityLevelInstance })]
        )

        expect(errors).toHaveLength(1)
        expect(appliedChanges).toHaveLength(0)
      })

      it('should throw if there are no jsp urls for security scheme', async () => {
        delete config.apiDefinitions.types[SECURITY_SCHEME_TYPE].jspRequests

        await expect(filter.deploy?.([toChange({ after: securitySchemeInstance })])).rejects.toThrow()
      })

      it('should throw if there is no level type definition', async () => {
        delete config.apiDefinitions.types[SECURITY_LEVEL_TYPE]

        await expect(filter.deploy?.([toChange({ after: securityLevelInstance })])).rejects.toThrow()
      })

      it('should throw if there is no level member type definition', async () => {
        delete config.apiDefinitions.types[SECURITY_LEVEL_MEMBER_TYPE]

        const { deployResult: { errors, appliedChanges } } = await filter.deploy(
          [toChange({ after: securityLevelInstance })]
        )

        expect(errors).toHaveLength(1)
        expect(appliedChanges).toHaveLength(0)
      })

      it('should throw if level has invalid member', async () => {
        securityLevelInstance.value.members.push({ holder: { parameter: 'parameter' } })

        const { deployResult: { errors, appliedChanges } } = await filter.deploy(
          [toChange({ after: securityLevelInstance })]
        )

        expect(appliedChanges).toHaveLength(0)
        expect(errors).toHaveLength(1)
      })

      it('should throw if members is not an object type', async () => {
        securityLevelType.fields.members = new Field(
          securityLevelType,
          'members',
          BuiltinTypes.STRING,
        )

        const { deployResult: { errors, appliedChanges } } = await filter.deploy(
          [toChange({ after: securityLevelInstance })]
        )

        expect(errors).toHaveLength(1)
        expect(appliedChanges).toHaveLength(0)
      })

      it('should throw if there is no scheme type definition', async () => {
        delete config.apiDefinitions.types[SECURITY_SCHEME_TYPE]

        await expect(filter.deploy?.([toChange({ after: securitySchemeInstance })])).rejects.toThrow()
      })
    })

    describe('pre deploy', () => {
      it('should set defaultLevel with not defined', async () => {
        const schemeWithoutDefault = securitySchemeInstance.clone()
        delete schemeWithoutDefault.value.defaultLevel
        await filter.preDeploy([
          toChange({ after: securitySchemeInstance }),
          toChange({ after: schemeWithoutDefault }),
        ])

        expect(schemeWithoutDefault.value.defaultLevel).toEqual(NO_DEFAULT_VALUE)
        expect(isReferenceExpression(securitySchemeInstance.value.defaultLevel)).toBeTrue()
      })

      it('should add level id to security levels', async () => {
        await filter.preDeploy([
          toChange({ after: securityLevelInstance }),
        ])

        expect(securityLevelInstance.value.levelId).toBe('2')
      })
    })

    describe('on deploy', () => {
      it('should remove pre deploy added values from security scheme', async () => {
        const schemeWithoutDefault = securitySchemeInstance.clone()
        schemeWithoutDefault.value.defaultLevel = NO_DEFAULT_VALUE
        schemeWithoutDefault.value.schemeId = schemeWithoutDefault.value.id
        securitySchemeInstance.value.schemeId = securitySchemeInstance.value.id
        await filter.onDeploy([
          toChange({ after: securitySchemeInstance }),
          toChange({ after: schemeWithoutDefault }),
        ])

        expect(schemeWithoutDefault.value.defaultLevel).toBeUndefined()
        expect(schemeWithoutDefault.value.schemeId).toBeUndefined()

        expect(securitySchemeInstance.value.defaultLevel).toBeDefined()
        expect(securitySchemeInstance.value.schemeId).toBeUndefined()
      })

      it('should remove pre deploy added values from security levels', async () => {
        securityLevelInstance.value.schemeId = securityLevelInstance.value.id
        securityLevelInstance.value.levelId = securityLevelInstance.value.id
        await filter.onDeploy([
          toChange({ after: securityLevelInstance }),
        ])

        expect(securityLevelInstance.value.schemeId).toBeUndefined()
        expect(securityLevelInstance.value.levelId).toBeUndefined()
      })
    })
  })
  describe('data center', () => {
    let securitySchemeCreateInstance: InstanceElement
    let securityLevelCreateInstance: InstanceElement
    let levelInstanceStandAlone: InstanceElement
    let connection: MockInterface<clientUtils.APIConnection>
    beforeEach(async () => {
      const { client: cli, paginator, connection: conn } = mockClient(true)
      client = cli
      connection = conn
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      filter = securitySchemeFilter(getFilterParams({
        client,
        paginator,
        config,
      })) as filterUtils.FilterWith<'onFetch' | 'deploy' | 'preDeploy' | 'onDeploy'>

      securitySchemeCreateInstance = new InstanceElement(
        'securityScheme',
        securitySchemeType,
        {
          name: 'securitySchemeName',
          description: 'securitySchemeDesc',
        }
      )
      levelInstanceStandAlone = new InstanceElement(
        'levelInstance',
        securityLevelType,
        {
          name: 'level0',
          description: 'desc10',
        },
        undefined,
        {
          _parent: { value: { value: { id: 12 } } },
        },
      )
      securityLevelCreateInstance = new InstanceElement(
        'levelInstance',
        securityLevelType,
        {
          name: 'level10',
          description: 'desc100',
        },
      )
      connection.post.mockResolvedValueOnce({
        status: 200,
        data: {
          id: 1,
        },
      })
    })
    it('should deploy scheme only changes', async () => {
      const { deployResult: { errors, appliedChanges }, leftoverChanges } = await filter.deploy(
        [toChange({ after: securitySchemeCreateInstance })]
      )
      expect(errors.length).toEqual(0)
      expect(appliedChanges.length).toEqual(1)
      expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_SCHEME_TYPE)
      expect(leftoverChanges.length).toEqual(0)
      expect(connection.post).toHaveBeenCalledWith(
        '/rest/salto/1.0/issuesecurityschemes',
        {
          name: 'securitySchemeName',
          description: 'securitySchemeDesc',
        },
        undefined,
      )
    })
    it('should deploy create scheme and level', async () => {
      const { deployResult: { errors, appliedChanges }, leftoverChanges } = await filter.deploy(
        [toChange({ after: securitySchemeCreateInstance }), toChange({ after: securityLevelCreateInstance })]
      )
      expect(errors.length).toEqual(0)
      expect(appliedChanges.length).toEqual(2)
      expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_LEVEL_TYPE)
      expect(getChangeData(appliedChanges[1]).elemID.typeName).toEqual(SECURITY_SCHEME_TYPE)
      expect(leftoverChanges.length).toEqual(0)
      expect(connection.post).toHaveBeenNthCalledWith(
        1,
        '/rest/salto/1.0/issuesecurityschemes',
        {
          name: 'securitySchemeName',
          description: 'securitySchemeDesc',
        },
        undefined,
      )
      expect(connection.post).toHaveBeenNthCalledWith(
        2,
        '/rest/salto/1.0/securitylevel?securitySchemeId=1',
        {
          name: 'level10',
          description: 'desc100',
        },
        undefined,
      )
    })
    it('should deploy modify scheme and level', async () => {
      const { deployResult: { errors, appliedChanges }, leftoverChanges } = await filter.deploy(
        [toChange({ before: securitySchemeCreateInstance, after: securitySchemeInstance }),
          toChange({ before: securitySchemeCreateInstance, after: securityLevelInstance })]
      )
      expect(errors.length).toEqual(0)
      expect(appliedChanges.length).toEqual(2)
      expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_LEVEL_TYPE)
      expect(getChangeData(appliedChanges[1]).elemID.typeName).toEqual(SECURITY_SCHEME_TYPE)
      expect(leftoverChanges.length).toEqual(0)
      expect(connection.put).toHaveBeenNthCalledWith(
        1,
        '/rest/salto/1.0/securitylevel?securitySchemeId=1',
        {
          id: '2',
          name: 'securityLevelName',
          description: 'securityLevelDesc',
          members: [
            {
              holder: {
                type: 'group',
                parameter: 'atlassian-addons-admin',
              },
            },
            {
              holder: {
                type: 'projectLead',
              },
            },
          ],
        },
        undefined,
      )
      expect(connection.put).toHaveBeenNthCalledWith(
        2,
        '/rest/salto/1.0/issuesecurityschemes',
        {
          id: '1',
          name: 'securitySchemeName',
          description: 'securitySchemeDesc',
          defaultLevel: '2',
        },
        undefined,
      )
    })
    it('should deploy level only changes', async () => {
      const { deployResult: { errors, appliedChanges }, leftoverChanges } = await filter.deploy(
        [toChange({ before: securityLevelInstance, after: levelInstanceStandAlone })]
      )
      expect(errors.length).toEqual(0)
      expect(appliedChanges.length).toEqual(1)
      expect(getChangeData(appliedChanges[0]).elemID.typeName).toEqual(SECURITY_LEVEL_TYPE)
      expect(leftoverChanges.length).toEqual(0)
      expect(connection.put).toHaveBeenCalledWith(
        '/rest/salto/1.0/securitylevel?securitySchemeId=12',
        {
          name: 'level0',
          description: 'desc10',
        },
        undefined,
      )
    })
    it('should return error if failed on scheme', async () => {
      connection.post.mockReset()
      connection.post.mockRejectedValueOnce(new Error('Name already exists'))
      const { deployResult: { errors, appliedChanges }, leftoverChanges } = await filter.deploy(
        [toChange({ after: securitySchemeInstance }), toChange({ after: securityLevelInstance })]
      )
      expect(errors.length).toEqual(1)
      expect(errors[0].message).toEqual('Deployment of jira.SecurityScheme.instance.securityScheme failed: Error: Failed to post /rest/api/3/issuesecurityschemes with error: Error: Name already exists')
      expect(appliedChanges.length).toEqual(0)
      expect(leftoverChanges.length).toEqual(0)
    })
    it('Should not throw when delete request fail and the instance is already deleted', async () => {
      connection.delete.mockRejectedValueOnce(new clientUtils.HTTPError('message', {
        status: 404,
        data: {},
      }))
      const { deployResult: { errors, appliedChanges } } = await filter.deploy(
        [toChange({ before: securityLevelInstance })]
      )
      expect(errors).toHaveLength(0)
      expect(appliedChanges).toHaveLength(1)
    })
    it('Should throw when the request fail with 500', async () => {
      connection.delete.mockRejectedValueOnce(new Error('Name already exists'))
      const { deployResult: { errors, appliedChanges } } = await filter.deploy(
        [toChange({ before: securityLevelInstance })]
      )
      expect(errors).toHaveLength(1)
      expect(appliedChanges).toHaveLength(0)
    })
  })
})
