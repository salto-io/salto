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
import { collections } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  toChange, FetchResult, InstanceElement, ReferenceExpression, isReferenceExpression,
  isInstanceElement, DeployResult, Values, isStaticFile, StaticFile,
} from '@salto-io/adapter-api'
import { findElement, naclCase } from '@salto-io/adapter-utils'
import NetsuiteAdapter from '../src/adapter'
import { credsLease, realAdapter } from './adapter'
import { customTypes, fileCabinetTypes, getAllTypes } from '../src/types'
import { adapter as adapterCreator } from '../src/adapter_creator'
import {
  CUSTOM_RECORD_TYPE, EMAIL_TEMPLATE, ENTITY_CUSTOM_FIELD, FETCH_ALL_TYPES_AT_ONCE,
  FILE, FILE_CABINET_PATH_SEPARATOR, FILE_PATHS_REGEX_SKIP_LIST, FOLDER, PATH, ROLE, SCRIPT_ID,
  TRANSACTION_COLUMN_CUSTOM_FIELD, TYPES_TO_SKIP, WORKFLOW,
} from '../src/constants'
import { mockDefaultValues } from './mock_elements'
import { Credentials } from '../src/client/credentials'

const { makeArray } = collections.array

const createInstanceElement = (type: string, valuesOverride: Values): InstanceElement => {
  const isFileCabinetType = Object.keys(fileCabinetTypes).includes(type)

  const instanceName = naclCase(mockDefaultValues[type][isFileCabinetType ? PATH : SCRIPT_ID]
    .replace(new RegExp(`^${FILE_CABINET_PATH_SEPARATOR}`), ''))

  return new InstanceElement(
    instanceName,
    isFileCabinetType ? fileCabinetTypes[type] : customTypes[type],
    {
      ...mockDefaultValues[type],
      ...valuesOverride,
    }
  )
}

describe('Netsuite adapter E2E with real account', () => {
  let adapter: NetsuiteAdapter
  let credentialsLease: CredsLease<Credentials>

  beforeAll(async () => {
    await adapterCreator.install?.()
    credentialsLease = await credsLease()
    const adapterAttr = realAdapter(
      { credentials: credentialsLease.value },
    )
    adapter = adapterAttr.adapter
  })

  afterAll(async () => {
    if (credentialsLease?.return) {
      await credentialsLease.return()
    }
  })

  // Set long timeout as we communicate with Netsuite APIs
  jest.setTimeout(1000000)

  let fetchResult: FetchResult
  let fetchedInstances: InstanceElement[]

  const validateConfigSuggestions = (updatedConfig?: InstanceElement): void => {
    if (updatedConfig === undefined) {
      // As expected
      return
    }
    // Due to a known SDF bug, sometimes we fail to fetch all types at once but succeed when trying
    // to fetch type by type. In this case we wouldn't like to fail the test
    expect(updatedConfig.value?.[FILE_PATHS_REGEX_SKIP_LIST]).toHaveLength(0)
    expect(updatedConfig.value?.[TYPES_TO_SKIP]).toHaveLength(0)
    expect(updatedConfig.value?.[FETCH_ALL_TYPES_AT_ONCE]).toBe(false)
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
    { description: randomString }
  )

  const folderToCreate = createInstanceElement(
    FOLDER,
    { description: randomString }
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

  describe('Create records', () => {
    const changes = [
      entityCustomFieldToCreate,
      customRecordTypeToCreate,
      workflowToCreate,
      emailTemplateToCreate,
      fileToCreate,
      folderToCreate,
    ].map(instanceToCreate => toChange({ after: instanceToCreate }))

    let deployResult: DeployResult
    beforeAll(async () => {
      deployResult = await adapter.deploy({ changeGroup: { groupID: 'SDF', changes } })
    })

    it('should deploy new records', async () => {
      expect(deployResult.errors).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(changes.length)
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

  describe('Fetch after creation', () => {
    beforeAll(async () => {
      fetchResult = await adapter.fetch()
      fetchedInstances = fetchResult.elements.filter(isInstanceElement)
    })

    it('should fetch account successfully', async () => {
      expect(fetchResult.elements.length).toBeGreaterThan(getAllTypes().length)
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
          && permission.permittedrole.elemId
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
          && permission.permkey.elemId
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
        && toStateReference.elemId.isEqual(
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

    it('should fetch the created folder', async () => {
      const fetchedFolder = findElement(
        fetchedInstances,
        folderToCreate.elemID
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
        && sourcefrom.elemId.isEqual(
          entityCustomFieldToCreate.elemID.createNestedID(SCRIPT_ID)
        )).toBe(true)
    })
  })
})
