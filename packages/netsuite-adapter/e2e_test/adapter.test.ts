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
import { collections, values } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  toChange, FetchResult, InstanceElement, ReferenceExpression, isReferenceExpression,
  isInstanceElement, DeployResult, Values, isStaticFile, StaticFile, FetchOptions, Change,
  ChangeId, ChangeGroupId, ElemID, ObjectType, BuiltinTypes, ChangeError,
} from '@salto-io/adapter-api'
import { findElement, naclCase } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import each from 'jest-each'
import NetsuiteAdapter from '../src/adapter'
import { credsLease, realAdapter } from './adapter'
import { customTypes, fileCabinetTypes, getMetadataTypes } from '../src/types'
import { adapter as adapterCreator } from '../src/adapter_creator'
import {
  CUSTOM_RECORD_TYPE, EMAIL_TEMPLATE, ENTITY_CUSTOM_FIELD, FETCH_ALL_TYPES_AT_ONCE,
  FILE, FILE_CABINET_PATH_SEPARATOR, FOLDER, NETSUITE, PATH, ROLE, SCRIPT_ID,
  SKIP_LIST,
  TRANSACTION_COLUMN_CUSTOM_FIELD, WARN_STALE_DATA, WORKFLOW,
} from '../src/constants'
import { mockDefaultValues } from './mock_elements'
import { Credentials } from '../src/client/credentials'

const { makeArray } = collections.array
const { awu } = collections.asynciterable

const createInstanceElement = (type: string, valuesOverride: Values): InstanceElement => {
  const isFileCabinetType = Object.keys(fileCabinetTypes).includes(type)

  const instValues = {
    ...mockDefaultValues[type],
    ...valuesOverride,
  }

  const instanceName = naclCase(instValues[isFileCabinetType ? PATH : SCRIPT_ID]
    .replace(new RegExp(`^${FILE_CABINET_PATH_SEPARATOR}`), ''))

  return new InstanceElement(
    instanceName,
    isFileCabinetType ? fileCabinetTypes[type] : customTypes[type],
    instValues
  )
}

describe('Netsuite adapter E2E with real account', () => {
  let adapter: NetsuiteAdapter
  let credentialsLease: CredsLease<Required<Credentials>>

  beforeAll(async () => {
    await adapterCreator.install?.()
    credentialsLease = await credsLease()
  })

  afterAll(async () => {
    if (credentialsLease?.return) {
      await credentialsLease.return()
    }
  })

  // Set long timeout as we communicate with Netsuite APIs
  jest.setTimeout(1000000)

  each([
    ['without SuiteApp', false],
    ['with SuiteApp', true],
  ]).describe('%s', (_text, withSuiteApp) => {
    let fetchResult: FetchResult
    let fetchedInstances: InstanceElement[]

    const validateConfigSuggestions = (updatedConfig?: InstanceElement): void => {
      if (updatedConfig === undefined) {
        // As expected
        return
      }
      // Due to a known SDF bug, sometimes we fail to fetch all types at once but succeed
      // when trying to fetch type by type. In this case we wouldn't like to fail the test
      expect(updatedConfig.value?.[SKIP_LIST]?.typesToSkip).toBeUndefined()

      if (withSuiteApp) {
      // When using SuiteApp some private files under the folders /SuiteBundles and /SuiteApps
      // might be added to the skipList
        expect(updatedConfig.value?.[SKIP_LIST]?.filePaths
          ?.filter((path: string) => (!path.startsWith('/SuiteBundles') && !path.startsWith('/SuiteApps'))) ?? []).toHaveLength(0)
      } else {
        expect(updatedConfig.value?.[SKIP_LIST]?.filePaths).toBeUndefined()
      }
      expect(updatedConfig.value?.[FETCH_ALL_TYPES_AT_ONCE] ?? false).toBe(false)
    }

    const randomString = `created by oss e2e - ${String(Date.now()).substring(6)}`

    const entityCustomFieldToCreate = createInstanceElement(
      ENTITY_CUSTOM_FIELD,
      {
        label: randomString,
        description: 'Some string with special chars !"&​’',
      }
    )

    const customRecordTypeToCreate = createInstanceElement(
      CUSTOM_RECORD_TYPE,
      { recordname: randomString }
    )

    const workflowToCreate = createInstanceElement(
      WORKFLOW,
      { name: randomString }
    )
    workflowToCreate.value.workflowstates.workflowstate[0].workflowtransitions.workflowtransition[0]
      .tostate = new ReferenceExpression(
        workflowToCreate.elemID.createNestedID('workflowstates', 'workflowstate', '1', SCRIPT_ID),
        workflowToCreate.value.workflowstates.workflowstate[1][SCRIPT_ID],
        workflowToCreate
      )

    const emailTemplateToCreate = createInstanceElement(
      EMAIL_TEMPLATE,
      { name: randomString }
    )

    const fileToCreate = createInstanceElement(
      FILE,
      {
        description: randomString,
        ...(withSuiteApp ? { [PATH]: '/Images/InnerFolder/e2eTest.js' } : {}),
      }
    )

    const folderToModify = createInstanceElement(
      FOLDER,
      {
        description: randomString,
        ...(withSuiteApp ? { [PATH]: '/Images/InnerFolder' } : {}),
      }
    )

    const roleToCreateThatDependsOnCustomRecord = createInstanceElement(
      ROLE,
      {
        name: randomString,
        permissions: {
          permission: [
            ...mockDefaultValues[ROLE].permissions.permission,
            {
              permkey: new ReferenceExpression(
                customRecordTypeToCreate.elemID.createNestedID(SCRIPT_ID),
                customRecordTypeToCreate.value[SCRIPT_ID],
                customRecordTypeToCreate
              ),
              permlevel: 'EDIT',
            },
          ],
        },
      }
    )

    const transactionColumnToCreateThatDependsOnField = createInstanceElement(
      TRANSACTION_COLUMN_CUSTOM_FIELD,
      {
        label: randomString,
        sourcefrom: new ReferenceExpression(
          entityCustomFieldToCreate.elemID.createNestedID(SCRIPT_ID),
          entityCustomFieldToCreate.value[SCRIPT_ID],
          entityCustomFieldToCreate
        ),
      }
    )

    const subsidiaryAddressType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'address'),
      fields: {
        country: { refType: BuiltinTypes.STRING },
        addressee: { refType: BuiltinTypes.STRING },
        state: { refType: BuiltinTypes.STRING },
        addrText: { refType: BuiltinTypes.STRING },
        override: { refType: BuiltinTypes.BOOLEAN },
      },
    })

    const subsidiaryType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'subsidiary'),
      fields: {
        internalId: {
          refType: BuiltinTypes.STRING,
          annotations: {
            isAttribute: true,
          },
        },
        name: { refType: BuiltinTypes.SERVICE_ID },
        state: { refType: BuiltinTypes.STRING },
        mainAddress: { refType: subsidiaryAddressType },
      },
      annotations: { source: 'soap' },
    })

    const subsidiaryInstance = new InstanceElement(
      naclCase(`Parent Company_${randomString}`),
      subsidiaryType,
      {
        name: randomString,
        state: 'AZ',
        mainAddress: {
          country: '_uSMinorOutlyingIslands',
          addressee: 'testSub',
          state: 'AZ',
          addrText: 'testSub<br>AZ <br>US Minor Outlying Islands',
          override: false,
        },
      }
    )
    afterAll(async () => {
      const revertChanges: Map<ChangeId, Change<InstanceElement>> = new Map([
        ...withSuiteApp ? [subsidiaryInstance] : [],
      ].map((instanceToDelete, index) => [
        index.toString(),
        toChange({ before: instanceToDelete }),
      ]))

      if (revertChanges.size === 0) {
        return
      }

      const idToGroup = (await adapter?.deployModifiers
        ?.getChangeGroupIds?.(revertChanges)) as Map<ChangeId, ChangeGroupId>
      const changesGroups = _(revertChanges)
        .entries()
        .groupBy(([id, _change]) => idToGroup.get(id))
        .mapValues(
          group => group.map(([_id, change]) => change as unknown as Change<InstanceElement>)
        )
        .entries()
        .value()

      for (const [id, group] of changesGroups) {
        // eslint-disable-next-line no-await-in-loop
        await adapter.deploy({
          changeGroup: { groupID: id, changes: group },
        })
      }
    })

    describe('Create records', () => {
      const changes: Map<ChangeId, Change<InstanceElement>> = new Map([
        entityCustomFieldToCreate,
        customRecordTypeToCreate,
        workflowToCreate,
        emailTemplateToCreate,
        fileToCreate,
        ...withSuiteApp ? [subsidiaryInstance] : [],
      ].map((instanceToCreate, index) => [index.toString(), toChange({ after: instanceToCreate })]))

      const folderToModifyBefore = folderToModify.clone()
      // Modified the description here just so the before won't be the same as the after
      // The after should be with the `randomString` value
      folderToModifyBefore.value.description = ''
      changes.set(
        changes.size.toString(),
        toChange({ before: folderToModifyBefore, after: folderToModify })
      )

      let deployResult: DeployResult
      beforeAll(async () => {
        const adapterAttr = realAdapter(
          { credentials: credentialsLease.value, withSuiteApp },
        )
        adapter = adapterAttr.adapter

        const idToGroup = (await adapter?.deployModifiers
          ?.getChangeGroupIds?.(changes)) as Map<ChangeId, ChangeGroupId>
        const changesGroups = _(changes)
          .entries()
          .groupBy(([id, _change]) => idToGroup.get(id))
          .mapValues(
            group => group.map(([_id, change]) => change as unknown as Change<InstanceElement>)
          )
          .entries()
          .value()

        deployResult = { appliedChanges: [], errors: [] }
        for (const [id, group] of changesGroups) {
          // eslint-disable-next-line no-await-in-loop
          const { appliedChanges, errors } = await adapter.deploy({
            changeGroup: { groupID: id, changes: group },
          })

          deployResult = {
            appliedChanges: [...deployResult.appliedChanges, ...appliedChanges],
            errors: [...deployResult.errors, ...errors],
          }
        }
      })

      it('should deploy new records', async () => {
        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges).toHaveLength(changes.size)
      })
    })

    describe('Create records that depend on existing ones', () => {
      const changes = [
        roleToCreateThatDependsOnCustomRecord,
        transactionColumnToCreateThatDependsOnField,
      ].map(instanceToCreate => toChange({ after: instanceToCreate }))

      let deployResult: DeployResult
      beforeAll(async () => {
        deployResult = await adapter.deploy({ changeGroup: { groupID: 'SDF', changes } })
      })

      it('should deploy new records that depend on existing ones', async () => {
        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges).toHaveLength(changes.length)
      })
    })

    describe('safe deploy change validator', () => {
      describe('with warnOnStaleWorkspaceData=true flag', () => {
        let beforeInstance: InstanceElement
        let afterInstance: InstanceElement
        let serviceInstance: InstanceElement
        beforeAll(async () => {
          const adapterAttr = realAdapter(
            { credentials: credentialsLease.value, withSuiteApp },
            { deploy: { [WARN_STALE_DATA]: true } },
          )
          adapter = adapterAttr.adapter
          beforeInstance = entityCustomFieldToCreate.clone()
          afterInstance = beforeInstance.clone()
          serviceInstance = beforeInstance.clone()

          beforeInstance.value.label = 'before label'
          afterInstance.value.label = 'after label'
          serviceInstance.value.label = 'service label'

          const additionChanges = [toChange({ after: serviceInstance })]
          const additionResult = await adapter.deploy({ changeGroup: { groupID: 'SDF', changes: additionChanges } })
          // check that that test setup is successfull
          expect(additionResult.errors.length).toBe(0)
          expect(additionResult.appliedChanges.length).toBe(1)
        })

        it('should have warning when applying change validator', async () => {
          const modificationChanges = [toChange({ before: beforeInstance, after: afterInstance })]
          const changeErrors: ReadonlyArray<ChangeError> = await awu([
            adapter.deployModifiers?.changeValidator,
          ])
            .filter(values.isDefined)
            .flatMap(validator => validator(modificationChanges))
            .toArray()

          expect(changeErrors.length).toBe(1)
          const changeError = changeErrors.find(e => e.message === 'Continuing the deploy proccess will override changes made in the service to this element.')
          expect(changeError).toBeDefined()
        })

        afterAll(async () => {
          const removalChange = [toChange({ before: serviceInstance })]
          const additionResult = await adapter.deploy({ changeGroup: { groupID: 'SDF', changes: removalChange } })
          // check that that test cleanup is successfull
          expect(additionResult.errors.length).toBe(0)
          expect(additionResult.appliedChanges.length).toBe(1)
        })
      })

      describe('with warnOnStaleWorkspaceData=false flag', () => {
        let beforeInstance: InstanceElement
        let afterInstance: InstanceElement
        let serviceInstance: InstanceElement
        beforeAll(async () => {
          const adapterAttr = realAdapter(
            { credentials: credentialsLease.value, withSuiteApp },
            { deploy: { warnOnStaleWorkspaceData: false } },
          )
          adapter = adapterAttr.adapter
          beforeInstance = entityCustomFieldToCreate.clone()
          afterInstance = beforeInstance.clone()
          serviceInstance = beforeInstance.clone()

          beforeInstance.value.label = 'before label'
          afterInstance.value.label = 'after label'
          serviceInstance.value.label = 'service label'

          const additionChanges = [toChange({ after: serviceInstance })]
          const additionResult = await adapter.deploy({ changeGroup: { groupID: 'SDF', changes: additionChanges } })
          // check that that test setup is successfull
          expect(additionResult.errors.length).toBe(0)
          expect(additionResult.appliedChanges.length).toBe(1)
        })

        it('should have no warning when applying change validator', async () => {
          const modificationChanges = [toChange({ before: beforeInstance, after: afterInstance })]
          const changeErrors: ReadonlyArray<ChangeError> = await awu([
            adapter.deployModifiers?.changeValidator,
          ])
            .filter(values.isDefined)
            .flatMap(validator => validator(modificationChanges))
            .toArray()
          expect(changeErrors.length).toBe(0)
        })

        afterAll(async () => {
          const removalChange = [toChange({ before: serviceInstance })]
          const additionResult = await adapter.deploy({ changeGroup: { groupID: 'SDF', changes: removalChange } })
          // check that that test cleanup is successfull
          expect(additionResult.errors.length).toBe(0)
          expect(additionResult.appliedChanges.length).toBe(1)
        })
      })
    })

    describe('Fetch after creation', () => {
      beforeAll(async () => {
        const adapterAttr = realAdapter(
          { credentials: credentialsLease.value, withSuiteApp },
        )
        adapter = adapterAttr.adapter

        const mockFetchOpts: MockInterface<FetchOptions> = {
          progressReporter: { reportProgress: jest.fn() },
        }
        fetchResult = await adapter.fetch(mockFetchOpts)
        fetchedInstances = fetchResult.elements.filter(isInstanceElement)
      })

      it('should fetch account successfully', async () => {
        expect(fetchResult.elements.length).toBeGreaterThan(getMetadataTypes().length)
        validateConfigSuggestions(fetchResult.updatedConfig?.config)
      })

      it('should fetch the created entityCustomField and its special chars', async () => {
        const fetchedEntityCustomField = findElement(
          fetchedInstances,
          entityCustomFieldToCreate.elemID
        ) as InstanceElement
        expect(fetchedEntityCustomField.value.label).toEqual(randomString)
        expect(fetchedEntityCustomField.value.description)
          .toEqual(entityCustomFieldToCreate.value.description)
      })

      it('should fetch the created customRecordType', async () => {
        const fetchedCustomRecordType = findElement(
          fetchedInstances,
          customRecordTypeToCreate.elemID
        ) as InstanceElement
        expect(fetchedCustomRecordType.value.recordname).toEqual(randomString)
        const permissions = makeArray(fetchedCustomRecordType.value.permissions?.permission)
        const createdRolePermission = permissions
          .find(permission => isReferenceExpression(permission.permittedrole)
          && permission.permittedrole.elemID
            .isEqual(roleToCreateThatDependsOnCustomRecord.elemID.createNestedID(SCRIPT_ID)))
        expect(createdRolePermission).toBeDefined()
      })

      it('should fetch the created role', async () => {
        const fetchedRole = findElement(
          fetchedInstances,
          roleToCreateThatDependsOnCustomRecord.elemID
        ) as InstanceElement
        expect(fetchedRole.value.name).toEqual(randomString)
        const permissions = makeArray(fetchedRole.value.permissions?.permission)
        const customRecordTypePermission = permissions
          .find(permission => isReferenceExpression(permission.permkey)
          && permission.permkey.elemID
            .isEqual(customRecordTypeToCreate.elemID.createNestedID(SCRIPT_ID)))
        expect(customRecordTypePermission).toBeDefined()
      })

      it('should fetch the created workflow', async () => {
        const fetchedWorkflow = findElement(
          fetchedInstances,
          workflowToCreate.elemID
        ) as InstanceElement
        expect(fetchedWorkflow.value.name).toEqual(randomString)
        const toStateReference = fetchedWorkflow.value.workflowstates?.workflowstate?.[0]
          ?.workflowtransitions?.workflowtransition?.[0]?.tostate
        expect(toStateReference).toBeDefined()
        expect(isReferenceExpression(toStateReference)
        && toStateReference.elemID.isEqual(
          fetchedWorkflow.elemID.createNestedID('workflowstates', 'workflowstate', '1', SCRIPT_ID)
        )).toBe(true)
      })

      it('should fetch the created email template', async () => {
        const fetchedEmailTemplate = findElement(
          fetchedInstances,
          emailTemplateToCreate.elemID
        ) as InstanceElement
        expect(fetchedEmailTemplate.value.name).toEqual(randomString)
        const { content } = fetchedEmailTemplate.value
        expect(isStaticFile(content)).toBeTruthy()
        const contentStaticFile = content as StaticFile
        expect(contentStaticFile.content).toBeDefined()
        expect((contentStaticFile.content as Buffer).toString())
          .toEqual(emailTemplateToCreate.value.content)
      })

      it('should fetch the created file', async () => {
        const fetchedFile = findElement(
          fetchedInstances,
          fileToCreate.elemID
        ) as InstanceElement
        expect(fetchedFile.value.description).toEqual(randomString)
        const { content } = fetchedFile.value
        expect(isStaticFile(content)).toBeTruthy()
        const contentStaticFile = content as StaticFile
        expect(contentStaticFile.content).toBeDefined()
        expect((contentStaticFile.content as Buffer).toString())
          .toEqual(fileToCreate.value.content)
      })

      it('should fetch the modified folder', async () => {
        const fetchedFolder = findElement(
          fetchedInstances,
          folderToModify.elemID
        ) as InstanceElement
        expect(fetchedFolder.value.description).toEqual(randomString)
      })

      it('should fetch the created transactionColumn', async () => {
        const fetchedTransactionColumn = findElement(
          fetchedInstances,
          transactionColumnToCreateThatDependsOnField.elemID
        ) as InstanceElement
        expect(fetchedTransactionColumn.value.label).toEqual(randomString)
        const { sourcefrom } = fetchedTransactionColumn.value
        expect(isReferenceExpression(sourcefrom)
        && sourcefrom.elemID.isEqual(
          entityCustomFieldToCreate.elemID.createNestedID(SCRIPT_ID)
        )).toBe(true)
      })

      it('should fetch the created subsidiary', async () => {
        if (withSuiteApp) {
          const fetchSubsidiary = findElement(
            fetchedInstances,
            subsidiaryInstance.elemID
          ) as InstanceElement
          subsidiaryInstance.value.internalId = fetchSubsidiary.value.internalId
          expect(fetchSubsidiary.value.name).toEqual(randomString)
          expect(fetchSubsidiary.value.internalId).toBeDefined()
        }
      })
    })
  })
})
