/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import process from 'process'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import {
  toChange,
  FetchResult,
  InstanceElement,
  ReferenceExpression,
  isReferenceExpression,
  Element,
  DeployResult,
  Values,
  isStaticFile,
  StaticFile,
  FetchOptions,
  Change,
  ChangeId,
  ChangeGroupId,
  ElemID,
  ChangeError,
  getChangeData,
  ObjectType,
  BuiltinTypes,
  isInstanceElement,
  CORE_ANNOTATIONS,
  Field,
  isObjectType,
  ProgressReporter,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, findElement, naclCase } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import each from 'jest-each'
import { emptyQueryParams, fullFetchConfig, fullQueryParams } from '../src/config/config_creator'
import NetsuiteAdapter from '../src/adapter'
import { configType } from '../src/config/types'
import { credsLease, realAdapter } from './adapter'
import {
  getElementValueOrAnnotations,
  getMetadataTypes,
  isCustomRecordType,
  isSDFConfigTypeName,
  metadataTypesToList,
  netsuiteSupportedTypes,
} from '../src/types'
import { adapter as adapterCreator } from '../src/adapter_creator'
import {
  CUSTOM_RECORD_TYPE,
  EMAIL_TEMPLATE,
  ENTITY_CUSTOM_FIELD,
  FILE,
  FILE_CABINET_PATH_SEPARATOR,
  FOLDER,
  PATH,
  ROLE,
  SCRIPT_ID,
  CONFIG_FEATURES,
  TRANSACTION_COLUMN_CUSTOM_FIELD,
  WORKFLOW,
  NETSUITE,
  APPLICATION_ID,
  IS_SUB_INSTANCE,
  BUNDLE,
} from '../src/constants'
import { SDF_CREATE_OR_UPDATE_GROUP_ID } from '../src/group_changes'
import { mockDefaultValues } from './mock_elements'
import { Credentials } from '../src/client/credentials'
import { isStandardTypeName } from '../src/autogen/types'
import { createCustomRecordTypes } from '../src/custom_records/custom_record_type'
import { savedsearchType } from '../src/type_parsers/saved_search_parsing/parsed_saved_search'
import { reportdefinitionType } from '../src/type_parsers/report_definition_parsing/parsed_report_definition'
import { financiallayoutType } from '../src/type_parsers/financial_layout_parsing/parsed_financial_layout'
import { ProjectInfo, createAdditionalFiles, createSdfExecutor } from './sdf_executor'
import { parsedDatasetType } from '../src/type_parsers/analytics_parsers/parsed_dataset'
import { parsedWorkbookType } from '../src/type_parsers/analytics_parsers/parsed_workbook'
import { bundleType as bundle } from '../src/types/bundle_type'
import { addApplicationIdToType } from '../src/transformer'
import { UNKNOWN_TYPE_REFERENCES_ELEM_ID } from '../src/filters/data_account_specific_values'

const log = logger(module)
const { awu } = collections.asynciterable

const logging = (message: string): void => {
  log.info(message)
  if (process.env.CONSOLE) {
    // eslint-disable-next-line no-console
    console.log(message)
  }
}

const nullProgressReporter: ProgressReporter = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  reportProgress: () => {},
}

describe('Netsuite adapter E2E with real account', () => {
  let adapter: NetsuiteAdapter
  let credentialsLease: CredsLease<Required<Credentials>>
  const { standardTypes, additionalTypes, innerAdditionalTypes } = getMetadataTypes()
  const metadataTypes = metadataTypesToList({ standardTypes, additionalTypes, innerAdditionalTypes })

  const createInstanceElement = (typeName: string, valuesOverride: Values, annotations?: Values): InstanceElement => {
    const instValues = {
      ...mockDefaultValues[typeName],
      ...valuesOverride,
    }

    const instanceName = isSDFConfigTypeName(typeName)
      ? ElemID.CONFIG_NAME
      : naclCase(
          instValues[isStandardTypeName(typeName) ? SCRIPT_ID : PATH].replace(
            new RegExp(`^${FILE_CABINET_PATH_SEPARATOR}`),
            '',
          ),
        )

    const type = isStandardTypeName(typeName) ? standardTypes[typeName].type : additionalTypes[typeName]
    const bundleType = bundle().type
    addApplicationIdToType(bundleType)
    type.fields[APPLICATION_ID] = new Field(type, APPLICATION_ID, BuiltinTypes.STRING)
    type.fields[BUNDLE] = new Field(type, BUNDLE, bundleType)
    return new InstanceElement(instanceName, type, instValues, undefined, annotations)
  }

  // the hardcoded types have "isinactive"/"inactive" fields and there's a filter
  // that replace them with "isInactive", so we should do that too here in order
  // to compare a fetched instance and a hardcoded instance
  const alignInactiveFields = (instance: InstanceElement): InstanceElement => {
    const cloned = instance.clone()
    const type = cloned.getTypeSync().clone()
    type.fields.isInactive = new Field(type, 'isInactive', BuiltinTypes.BOOLEAN, { originalName: 'isinactive' })
    delete type.fields.isinactive
    delete type.fields.inactive
    cloned.refType = createRefToElmWithValue(type)

    cloned.value.isInactive = cloned.value.isInactive ?? cloned.value.isinactive ?? cloned.value.inactive
    delete cloned.value.isinactive
    delete cloned.value.inactive
    return cloned
  }

  beforeAll(async () => {
    log.resetLogCount()
    await adapterCreator.install?.()
    credentialsLease = await credsLease()
    logging(`using account ${credentialsLease.value.accountId}`)
  })

  afterAll(async () => {
    if (credentialsLease?.return) {
      await credentialsLease.return()
    }
    log.info('Netsuite adapter E2E: Log counts = %o', log.getLogCount())
  })

  // Set long timeout as we communicate with Netsuite APIs
  jest.setTimeout(1000000)

  each([
    ['without SuiteApp', false],
    ['with SuiteApp', true],
  ]).describe('%s', (_text, withSuiteApp) => {
    let fetchResult: FetchResult
    let fetchedElements: Element[]

    const logMessage = (message: string): void => {
      logging(`${withSuiteApp ? '(suiteapp) ' : ' '}${message}`)
    }

    const validateConfigSuggestions = (updatedConfig?: InstanceElement): void => {
      if (updatedConfig === undefined) {
        // As expected
        return
      }
      // Due to a known SDF bug, sometimes we fail to fetch all types at once but succeed
      // when trying to fetch type by type. In this case we wouldn't like to fail the test
      expect(updatedConfig.value?.skipList?.typesToSkip).toBeUndefined()

      if (withSuiteApp) {
        // When using SuiteApp some private files under the folders /SuiteBundles and /SuiteApps
        // might be added to the skipList
        expect(
          updatedConfig.value?.skipList?.filePaths?.filter(
            (path: string) => !path.startsWith('/SuiteBundles') && !path.startsWith('/SuiteApps'),
          ) ?? [],
        ).toHaveLength(0)
      } else {
        expect(updatedConfig.value?.skipList?.filePaths).toBeUndefined()
      }
      expect(updatedConfig.value?.fetchAllTypesAtOnce ?? false).toBe(false)
    }

    const randomNumber = String(Date.now()).substring(6)
    const randomString = `created by oss e2e - ${randomNumber}`

    additionalTypes[FOLDER].annotate({ [CORE_ANNOTATIONS.ALIAS]: 'Folder' })
    additionalTypes[FILE].annotate({ [CORE_ANNOTATIONS.ALIAS]: 'File' })

    const entityCustomFieldToCreate = createInstanceElement(ENTITY_CUSTOM_FIELD, {
      label: randomString,
      description: 'Some string with special chars !"&​’',
    })

    const { fields, annotations } = mockDefaultValues[CUSTOM_RECORD_TYPE]
    const customRecordTypeToCreate = new ObjectType({
      elemID: new ElemID(NETSUITE, annotations[SCRIPT_ID]),
      fields,
      annotations: {
        ...annotations,
        recordname: randomString,
      },
    })

    const workflowToCreate = createInstanceElement(WORKFLOW, { name: randomString })
    workflowToCreate.value.workflowstates.workflowstate[0].workflowtransitions.workflowtransition[0].tostate =
      new ReferenceExpression(
        workflowToCreate.elemID.createNestedID('workflowstates', 'workflowstate', '1', SCRIPT_ID),
        workflowToCreate.value.workflowstates.workflowstate[1][SCRIPT_ID],
        workflowToCreate,
      )

    const invalidWorkflowScriptID = 'customworkflow_slt_e2e_test_invalid'
    const invalidWorkflowInstance = createInstanceElement(WORKFLOW, {
      scriptid: invalidWorkflowScriptID,
      name: randomString,
      workflowcustomfields: {},
      workflowstates: {
        workflowstate: [
          {
            scriptid: 'workflowstate_state1_invalid',
            workflowtransitions: {
              workflowtransition: [
                {
                  scriptid: 'workflowtransition_transition1_invalid',
                  tostate: '-1',
                },
              ],
            },
          },
        ],
      },
    })

    const emailTemplateToCreate = createInstanceElement(EMAIL_TEMPLATE, { name: randomString })

    const fileToCreate = createInstanceElement(FILE, {
      description: randomString,
      ...(withSuiteApp ? { [PATH]: '/Images/e2eTest.js' } : {}),
    })

    const folderToModify = createInstanceElement(FOLDER, {
      description: randomString,
      ...(withSuiteApp ? { [PATH]: '/Images' } : {}),
    })

    fileToCreate.annotate({
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(folderToModify.elemID, undefined, folderToModify)],
    })

    const roleToCreateThatDependsOnCustomRecord = createInstanceElement(ROLE, {
      name: randomString,
      permissions: {
        permission: [
          ...mockDefaultValues[ROLE].permissions.permission,
          {
            permkey: new ReferenceExpression(
              customRecordTypeToCreate.elemID.createNestedID('attr', SCRIPT_ID),
              customRecordTypeToCreate.annotations[SCRIPT_ID],
              customRecordTypeToCreate,
            ),
            permlevel: 'EDIT',
          },
        ],
      },
    })

    const transactionColumnToCreateThatDependsOnField = createInstanceElement(TRANSACTION_COLUMN_CUSTOM_FIELD, {
      label: randomString,
      sourcefrom: new ReferenceExpression(
        entityCustomFieldToCreate.elemID.createNestedID(SCRIPT_ID),
        entityCustomFieldToCreate.value[SCRIPT_ID],
        entityCustomFieldToCreate,
      ),
    })

    const featuresInstance = createInstanceElement(CONFIG_FEATURES, {})

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

    const subsidiaryInstance = new InstanceElement(naclCase(`Parent Company_${randomString}`), subsidiaryType, {
      name: randomString,
      state: 'AZ',
      mainAddress: {
        country: '_uSMinorOutlyingIslands',
        addressee: 'testSub',
        state: 'AZ',
        addrText: 'testSub<br>AZ <br>US Minor Outlying Islands',
        override: false,
      },
    })

    const accountType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'account'),
      fields: {
        internalId: {
          refType: BuiltinTypes.STRING,
          annotations: {
            isAttribute: true,
          },
        },
        acctName: { refType: BuiltinTypes.STRING },
        acctType: { refType: BuiltinTypes.STRING },
      },
      annotations: { source: 'soap' },
    })

    const accountInstance = new InstanceElement(naclCase(randomString), accountType, {
      acctName: randomString,
      acctType: '_fixedAsset',
    })

    const parentCustomRecordScriptId = `parent_record_slt_e2e_test_${randomNumber}`
    const parentCustomRecordInstance = new InstanceElement(parentCustomRecordScriptId, customRecordTypeToCreate, {
      name: randomString,
      scriptid: parentCustomRecordScriptId,
    })

    const customRecordScriptId = `record_slt_e2e_test_${randomNumber}`
    const customRecordInstance = new InstanceElement(customRecordScriptId, customRecordTypeToCreate, {
      scriptid: customRecordScriptId,
      isInactive: false,
      parent: new ReferenceExpression(parentCustomRecordInstance.elemID, parentCustomRecordInstance),
      name: randomString,
      custom_custrecord_field1: 'test',
      custom_custrecord_field2: 10,
      custom_custrecord_account: new ReferenceExpression(accountInstance.elemID, accountInstance),
    })

    const elementsToCreate = [
      entityCustomFieldToCreate,
      customRecordTypeToCreate,
      workflowToCreate,
      emailTemplateToCreate,
      fileToCreate,
      invalidWorkflowInstance,
      ...(withSuiteApp ? [subsidiaryInstance, accountInstance, parentCustomRecordInstance, customRecordInstance] : []),
    ]

    const elementsMap = _.keyBy(elementsToCreate, instance => instance.elemID.getFullName())
    const updateInternalIds = (changes: ReadonlyArray<Change>): void => {
      changes.map(getChangeData).forEach(element => {
        const { internalId } = getElementValueOrAnnotations(element)
        if (internalId && element.elemID.getFullName() in elementsMap) {
          const elementToUpdate = elementsMap[element.elemID.getFullName()]
          getElementValueOrAnnotations(elementToUpdate).internalId = internalId
        }
      })
    }

    const deployChanges = async (
      nsAdapter: NetsuiteAdapter,
      changes: Map<ChangeId, Change>,
    ): Promise<DeployResult[]> => {
      const idToGroup = (await nsAdapter?.deployModifiers?.getChangeGroupIds?.(changes))?.changeGroupIdMap as Map<
        ChangeId,
        ChangeGroupId
      >
      const changesGroups = _(changes)
        .entries()
        .groupBy(([id, _change]) => idToGroup.get(id))
        .mapValues(group => group.map(([_id, change]) => change as unknown as Change))
        .entries()
        .value()

      return awu(changesGroups)
        .map(async ([id, group]) => {
          logMessage(`running deploy for group ${id} with ${group.length} changes`)
          const result = await nsAdapter.deploy({
            changeGroup: { groupID: id, changes: group },
            progressReporter: nullProgressReporter,
          })
          updateInternalIds(result.appliedChanges)
          return result
        })
        .toArray()
    }

    describe('Create records', () => {
      const changes = new Map(
        elementsToCreate.map((instanceToCreate, index) => [index.toString(), toChange({ after: instanceToCreate })]),
      )

      const folderToModifyBefore = folderToModify.clone()
      // Modified the description here just so the before won't be the same as the after
      // The after should be with the `randomString` value
      folderToModifyBefore.value.description = ''
      changes.set(changes.size.toString(), toChange({ before: folderToModifyBefore, after: folderToModify }))

      // Toggle the feature status using 'withSuiteApp'
      const beforeFeaturesInstance = featuresInstance.clone()
      const afterFeaturesInstance = featuresInstance.clone()
      beforeFeaturesInstance.value.DEPARTMENTS = !withSuiteApp
      afterFeaturesInstance.value.DEPARTMENTS = withSuiteApp
      changes.set(changes.size.toString(), toChange({ before: beforeFeaturesInstance, after: afterFeaturesInstance }))

      let deployResult: DeployResult
      beforeAll(async () => {
        if (withSuiteApp) {
          logMessage('running fetch to get folder internalId')
        }
        const { elements } = withSuiteApp
          ? // in order to deploy folder modification (/Images) and file addition (/Images/e2eTest.js)
            // we need to get the folder internalId
            await realAdapter(
              { credentials: credentialsLease.value, withSuiteApp },
              {
                fetch: {
                  include: { types: [], fileCabinet: ['/Images/'], customRecords: [] },
                  exclude: emptyQueryParams(),
                },
              },
            ).adapter.fetch({
              progressReporter: { reportProgress: jest.fn() },
            })
          : { elements: [] }

        const fetchedFolder = elements
          .filter(isInstanceElement)
          .find(element => element.elemID.isEqual(folderToModify.elemID))
        if (fetchedFolder && fetchedFolder.value.internalId !== undefined) {
          folderToModify.value.internalId = fetchedFolder.value.internalId
        }

        const adapterAttr = realAdapter({ credentials: credentialsLease.value, withSuiteApp, elements })
        adapter = adapterAttr.adapter

        const results = await deployChanges(adapter, changes)

        deployResult = {
          appliedChanges: results.flatMap(result => result.appliedChanges),
          errors: results.flatMap(result => result.errors),
        }
      })

      it('should deploy new records', async () => {
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.appliedChanges).toHaveLength(changes.size - 1)
      })
      it('should not deploy invalid record', async () => {
        expect(
          Array.from(changes.values())
            .map(getChangeData)
            .find(change => change.elemID.name === invalidWorkflowScriptID),
        ).toBeDefined()
        expect(
          deployResult.appliedChanges.map(getChangeData).find(change => change.elemID.name === invalidWorkflowScriptID),
        ).toBeUndefined()
        expect(deployResult.errors[0].message).toContain(
          `An error occurred during custom object validation. (${invalidWorkflowScriptID})`,
        )
      })
    })

    describe('Create records that depend on existing ones', () => {
      const changes = [roleToCreateThatDependsOnCustomRecord, transactionColumnToCreateThatDependsOnField].map(
        instanceToCreate => toChange({ after: instanceToCreate }),
      )

      let deployResult: DeployResult
      beforeAll(async () => {
        logMessage(`running deploy for group SDF with ${changes.length} changes`)
        deployResult = await adapter.deploy({
          changeGroup: { groupID: SDF_CREATE_OR_UPDATE_GROUP_ID, changes },
          progressReporter: nullProgressReporter,
        })
      })

      it('should deploy new records that depend on existing ones', async () => {
        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges).toHaveLength(changes.length)
      })
    })

    describe('safe deploy change validator', () => {
      describe('on standard type instances', () => {
        let beforeInstance: InstanceElement
        let afterInstance: InstanceElement
        beforeAll(() => {
          beforeInstance = entityCustomFieldToCreate.clone()
          afterInstance = beforeInstance.clone()

          beforeInstance.value.label = 'before label'
          afterInstance.value.label = 'after label'
        })

        describe('with warnOnStaleWorkspaceData=true flag', () => {
          beforeAll(async () => {
            const adapterAttr = realAdapter(
              { credentials: credentialsLease.value, withSuiteApp },
              {
                fetch: fullFetchConfig(),
                deploy: { warnOnStaleWorkspaceData: true },
              },
            )
            adapter = adapterAttr.adapter
          })

          it('should have warning when applying change validator', async () => {
            const modificationChanges = [toChange({ before: beforeInstance, after: afterInstance })]
            logMessage('running safe deploy validation on standard instance')
            const changeErrors: ReadonlyArray<ChangeError> = await awu([adapter.deployModifiers?.changeValidator])
              .filter(values.isDefined)
              .flatMap(validator => validator(modificationChanges))
              .toArray()

            expect(changeErrors.length).toBe(1)
            const changeError = changeErrors.find(
              e => e.message === 'The changes you are about to deploy are based on an outdated version',
            )
            expect(changeError).toBeDefined()
          })
        })

        describe('with warnOnStaleWorkspaceData=false flag', () => {
          beforeAll(async () => {
            const adapterAttr = realAdapter(
              { credentials: credentialsLease.value, withSuiteApp },
              {
                fetch: fullFetchConfig(),
                deploy: { warnOnStaleWorkspaceData: false },
              },
            )
            adapter = adapterAttr.adapter
          })

          it('should have no warning when applying change validator', async () => {
            const modificationChanges = [toChange({ before: beforeInstance, after: afterInstance })]
            const changeErrors: ReadonlyArray<ChangeError> = await awu([adapter.deployModifiers?.changeValidator])
              .filter(values.isDefined)
              .flatMap(validator => validator(modificationChanges))
              .toArray()
            expect(changeErrors.length).toBe(0)
          })
        })
      })
      describe('on static resources', () => {
        let beforeInstance: InstanceElement
        let afterInstance: InstanceElement
        beforeAll(() => {
          beforeInstance = fileToCreate.clone()
          afterInstance = beforeInstance.clone()

          beforeInstance.value.content = new StaticFile({ filepath: 'somePath', content: Buffer.from('before') })
          afterInstance.value.content = new StaticFile({ filepath: 'somePath', content: Buffer.from('after') })
        })

        describe('with warnOnStaleWorkspaceData=true flag', () => {
          beforeAll(async () => {
            const adapterAttr = realAdapter(
              { credentials: credentialsLease.value, withSuiteApp },
              {
                fetch: fullFetchConfig(),
                deploy: { warnOnStaleWorkspaceData: true },
              },
            )
            adapter = adapterAttr.adapter
          })

          it('should have warning when applying change validator', async () => {
            const modificationChanges = [toChange({ before: beforeInstance, after: afterInstance })]
            logMessage('running safe deploy validation on static resource')
            const changeErrors: ReadonlyArray<ChangeError> = await awu([adapter.deployModifiers?.changeValidator])
              .filter(values.isDefined)
              .flatMap(validator => validator(modificationChanges))
              .toArray()

            expect(changeErrors.length).toBe(1)
            const changeError = changeErrors.find(
              e => e.message === 'The changes you are about to deploy are based on an outdated version',
            )
            expect(changeError).toBeDefined()
          })
        })

        describe('with warnOnStaleWorkspaceData=false flag', () => {
          beforeAll(async () => {
            const adapterAttr = realAdapter(
              { credentials: credentialsLease.value, withSuiteApp },
              {
                fetch: fullFetchConfig(),
                deploy: { warnOnStaleWorkspaceData: false },
              },
            )
            adapter = adapterAttr.adapter
          })

          it('should have no warning when applying change validator', async () => {
            const modificationChanges = [toChange({ before: beforeInstance, after: afterInstance })]
            const changeErrors: ReadonlyArray<ChangeError> = await awu([adapter.deployModifiers?.changeValidator])
              .filter(values.isDefined)
              .flatMap(validator => validator(modificationChanges))
              .toArray()
            expect(changeErrors.length).toBe(0)
          })
        })
      })
    })

    describe('Fetch after creation', () => {
      beforeAll(async () => {
        const adapterAttr = realAdapter(
          { credentials: credentialsLease.value, withSuiteApp },
          {
            fetch: {
              include: fullQueryParams(),
              exclude: emptyQueryParams(),
              addAlias: true,
            },
          },
        )
        adapter = adapterAttr.adapter

        const mockFetchOpts: MockInterface<FetchOptions> = {
          progressReporter: { reportProgress: jest.fn() },
        }
        logMessage('running fetch')
        fetchResult = await adapter.fetch(mockFetchOpts)
        fetchedElements = fetchResult.elements
      })

      it('should fetch account successfully', async () => {
        expect(fetchResult.elements.length).toBeGreaterThan(metadataTypes.length)
        validateConfigSuggestions(fetchResult.updatedConfig?.config[0])
      })

      it('should add alias to elements', async () => {
        const relevantElements = fetchResult.elements.filter(
          element =>
            isInstanceElement(element) ||
            (isObjectType(element) &&
              (isCustomRecordType(element) || netsuiteSupportedTypes.includes(element.elemID.name))),
        )

        const elementsWithoutAlias = relevantElements
          .filter(element => element.annotations[CORE_ANNOTATIONS.ALIAS] === undefined)
          // some sub-instances don't have alias
          .filter(element => getElementValueOrAnnotations(element)[IS_SUB_INSTANCE] !== true)

        expect(elementsWithoutAlias.every(elem => elem.annotations[CORE_ANNOTATIONS.HIDDEN])).toBeTruthy()
      })

      it('should fetch the created entityCustomField and its special chars', async () => {
        const fetchedEntityCustomField = findElement(
          fetchedElements,
          entityCustomFieldToCreate.elemID,
        ) as InstanceElement
        expect(fetchedEntityCustomField.value.label).toEqual(randomString)
        expect(fetchedEntityCustomField.value.description).toEqual(entityCustomFieldToCreate.value.description)
      })

      it('should fetch the created customRecordType', async () => {
        const fetchedCustomRecordType = findElement(fetchedElements, customRecordTypeToCreate.elemID) as ObjectType
        expect(fetchedCustomRecordType.annotations.recordname).toEqual(randomString)
        const permissions = fetchedCustomRecordType.annotations.permissions?.permission
        expect(_.isPlainObject(permissions)).toBeTruthy()
        const createdRolePermission = Object.values(permissions as Values).find(
          permission =>
            isReferenceExpression(permission.permittedrole) &&
            permission.permittedrole.elemID.isEqual(
              roleToCreateThatDependsOnCustomRecord.elemID.createNestedID(SCRIPT_ID),
            ),
        )
        expect(createdRolePermission).toBeDefined()
      })

      it('should fetch the created role', async () => {
        const fetchedRole = findElement(
          fetchedElements,
          roleToCreateThatDependsOnCustomRecord.elemID,
        ) as InstanceElement
        expect(fetchedRole.value.name).toEqual(randomString)
        const permissions = fetchedRole.value.permissions?.permission
        expect(_.isPlainObject(permissions)).toBeTruthy()
        const customRecordTypePermission = Object.values(permissions as Values).find(
          permission =>
            isReferenceExpression(permission.permkey) &&
            permission.permkey.elemID.isEqual(customRecordTypeToCreate.elemID.createNestedID('attr', SCRIPT_ID)),
        )
        expect(customRecordTypePermission).toBeDefined()
      })

      it('should fetch the created workflow', async () => {
        const fetchedWorkflow = findElement(fetchedElements, workflowToCreate.elemID) as InstanceElement
        expect(fetchedWorkflow.value.name).toEqual(randomString)
        // eslint-disable-next-line max-len
        const toStateReference =
          fetchedWorkflow.value.workflowstates?.workflowstate?.workflowstate_state1?.workflowtransitions
            ?.workflowtransition?.workflowtransition_transition1?.tostate
        expect(toStateReference).toBeDefined()
        expect(
          isReferenceExpression(toStateReference) &&
            toStateReference.elemID.isEqual(
              fetchedWorkflow.elemID.createNestedID(
                'workflowstates',
                'workflowstate',
                'workflowstate_state2',
                SCRIPT_ID,
              ),
            ),
        ).toBe(true)
      })

      it('should fetch the created email template', async () => {
        const fetchedEmailTemplate = findElement(fetchedElements, emailTemplateToCreate.elemID) as InstanceElement
        expect(fetchedEmailTemplate.value.name).toEqual(randomString)
        const { content } = fetchedEmailTemplate.value
        expect(isStaticFile(content)).toBeTruthy()
        const contentStaticFile = content as StaticFile
        expect(await contentStaticFile.getContent()).toBeDefined()
        expect(((await contentStaticFile.getContent()) as Buffer).toString()).toEqual(
          emailTemplateToCreate.value.content,
        )
      })

      it('should fetch the created file', async () => {
        const fetchedFile = findElement(fetchedElements, fileToCreate.elemID) as InstanceElement
        expect(fetchedFile.value.description).toEqual(randomString)
        const { content } = fetchedFile.value
        expect(isStaticFile(content)).toBeTruthy()
        const contentStaticFile = content as StaticFile
        expect(await contentStaticFile.getContent()).toBeDefined()
        expect(((await contentStaticFile.getContent()) as Buffer).toString()).toEqual(fileToCreate.value.content)
      })

      it('should fetch the modified folder', async () => {
        const fetchedFolder = findElement(fetchedElements, folderToModify.elemID) as InstanceElement
        expect(fetchedFolder.value.description).toEqual(randomString)
      })

      it('should fetch the created transactionColumn', async () => {
        const fetchedTransactionColumn = findElement(
          fetchedElements,
          transactionColumnToCreateThatDependsOnField.elemID,
        ) as InstanceElement
        expect(fetchedTransactionColumn.value.label).toEqual(randomString)
        const { sourcefrom } = fetchedTransactionColumn.value
        expect(
          isReferenceExpression(sourcefrom) &&
            sourcefrom.elemID.isEqual(entityCustomFieldToCreate.elemID.createNestedID(SCRIPT_ID)),
        ).toBe(true)
      })

      it('should fetch the created subsidiary', async () => {
        if (withSuiteApp) {
          const fetchSubsidiary = findElement(fetchedElements, subsidiaryInstance.elemID) as InstanceElement
          expect(fetchSubsidiary.value.name).toEqual(randomString)
          expect(fetchSubsidiary.value.internalId).toBeDefined()
        }
      })

      it('should fetch the created account', async () => {
        if (withSuiteApp) {
          const fetchAccount = findElement(fetchedElements, accountInstance.elemID) as InstanceElement
          expect(fetchAccount.value.acctName).toEqual(randomString)
          expect(fetchAccount.value.internalId).toBeDefined()
        }
      })

      it('should fetch the created custom record', async () => {
        if (withSuiteApp) {
          const fetchCustomRecord = findElement(fetchedElements, customRecordInstance.elemID) as InstanceElement
          expect(fetchCustomRecord.value.name).toEqual(randomString)
          expect(fetchCustomRecord.value.internalId).toBeDefined()
          expect(fetchCustomRecord.value.scriptid).toEqual(customRecordScriptId)
          expect(
            isReferenceExpression(fetchCustomRecord.value.parent) &&
              fetchCustomRecord.value.parent.elemID.isEqual(parentCustomRecordInstance.elemID),
          ).toBeTruthy()
          expect(fetchCustomRecord.value.custom_custrecord_field1).toEqual('test')
          expect(fetchCustomRecord.value.custom_custrecord_field2).toEqual(10)
          expect(
            isReferenceExpression(fetchCustomRecord.value.custom_custrecord_account) &&
              fetchCustomRecord.value.custom_custrecord_account.elemID.isEqual(accountInstance.elemID),
          ).toBeTruthy()
        }
      })

      it(`should fetch the modified feature (status=${withSuiteApp})`, async () => {
        const fetchFeatures = findElement(fetchedElements, featuresInstance.elemID) as InstanceElement
        // using 'withSuiteApp' to validate both boolean values
        expect(fetchFeatures.value.DEPARTMENTS).toBe(withSuiteApp)
      })
    })

    describe('load elements from folder', () => {
      if (withSuiteApp) {
        return
      }

      const sdfExecutor = createSdfExecutor()
      let projectInfo: ProjectInfo
      let loadedElements: Element[]

      const objectsToImport = [
        {
          type: ENTITY_CUSTOM_FIELD,
          scriptid: entityCustomFieldToCreate.value[SCRIPT_ID],
          elemID: entityCustomFieldToCreate.elemID,
        },
        {
          type: CUSTOM_RECORD_TYPE,
          scriptid: customRecordTypeToCreate.annotations[SCRIPT_ID],
          elemID: customRecordTypeToCreate.elemID,
        },
        {
          type: WORKFLOW,
          scriptid: workflowToCreate.value[SCRIPT_ID],
          elemID: workflowToCreate.elemID,
        },
        {
          type: EMAIL_TEMPLATE,
          scriptid: emailTemplateToCreate.value[SCRIPT_ID],
          elemID: emailTemplateToCreate.elemID,
        },
        {
          type: ROLE,
          scriptid: roleToCreateThatDependsOnCustomRecord.value[SCRIPT_ID],
          elemID: roleToCreateThatDependsOnCustomRecord.elemID,
        },
        {
          type: TRANSACTION_COLUMN_CUSTOM_FIELD,
          scriptid: transactionColumnToCreateThatDependsOnField.value[SCRIPT_ID],
          elemID: transactionColumnToCreateThatDependsOnField.elemID,
        },
      ]

      const filesToImport = [
        {
          path: folderToModify.value[PATH],
          elemID: folderToModify.elemID,
        },
        {
          path: fileToCreate.value[PATH],
          elemID: fileToCreate.elemID,
        },
      ]

      const NEW_FOLDER_PATH = ['SuiteScripts', 'b', 'c']
      const NEW_FILE_PATH = [...NEW_FOLDER_PATH, 'new.js']
      const ADDITINAL_NEW_FILE = { path: NEW_FILE_PATH, content: 'console.log("Hello World!")' }
      const ADDITINAL_EXISTING_FILE = {
        path: ['SuiteScripts', 'b', 'existing.js'],
        content: 'console.log("Hello Back!")',
      }

      const newFolderElemId = new ElemID(NETSUITE, FOLDER, 'instance', naclCase(NEW_FOLDER_PATH.join('/')))
      const newFileElemId = new ElemID(NETSUITE, FILE, 'instance', naclCase(NEW_FILE_PATH.join('/')))
      const newFileCabinetInstancesElemIds = [{ elemID: newFolderElemId }, { elemID: newFileElemId }]

      const topLevelFolder = createInstanceElement(
        FOLDER,
        {
          description: randomString,
          [PATH]: '/SuiteScripts',
        },
        {
          [CORE_ANNOTATIONS.ALIAS]: 'SuiteScripts',
        },
      )

      const innerFolder = createInstanceElement(
        FOLDER,
        {
          description: randomString,
          [PATH]: '/SuiteScripts/b',
        },
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(topLevelFolder.elemID)],
          [CORE_ANNOTATIONS.ALIAS]: 'b',
        },
      )

      const existingFileInstance = createInstanceElement(
        FILE,
        {
          description: randomString,
          [PATH]: '/SuiteScripts/b/existing.js',
        },
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(innerFolder.elemID)],
          [CORE_ANNOTATIONS.ALIAS]: 'existing.js',
        },
      )

      const existingFileCabinetInstances = [topLevelFolder, innerFolder, existingFileInstance]

      beforeAll(async () => {
        logMessage('creating an SDF project to load')
        projectInfo = await sdfExecutor.createProject(credentialsLease.value)
        const { projectPath } = projectInfo
        await Promise.all([
          sdfExecutor.importObjects(projectPath, objectsToImport),
          sdfExecutor.importFiles(
            projectPath,
            filesToImport.map(f => f.path),
          ),
          sdfExecutor.importFeatures(projectPath),
        ])
        await createAdditionalFiles(projectPath, [ADDITINAL_NEW_FILE, ADDITINAL_EXISTING_FILE])
        logMessage('loading elements from SDF project')
        const res = await adapterCreator.loadElementsFromFolder?.({
          baseDir: projectPath,
          elementsSource: buildElementsSourceFromElements(existingFileCabinetInstances),
          config: new InstanceElement(ElemID.CONFIG_NAME, configType, {
            fetch: {
              include: fullQueryParams(),
              exclude: emptyQueryParams(),
              addAlias: true,
            },
          }),
        })
        loadedElements = res?.elements as Element[]
      })
      afterAll(async () => {
        await sdfExecutor.deleteProject(projectInfo)
      })

      it('should load all elements successfully', () => {
        const analyticsTypes = [
          parsedDatasetType(),
          parsedWorkbookType(),
          savedsearchType(),
          reportdefinitionType(),
          financiallayoutType(),
        ]
        analyticsTypes.forEach(({ type, innerTypes }) => {
          _.remove(metadataTypes, e => _.isEqual(e.path, type.path))
          metadataTypes.push(type)
          metadataTypes.push(...Object.values(innerTypes))
        })

        const allTypes = (metadataTypes as { elemID: ElemID }[])
          .concat(createCustomRecordTypes([], standardTypes.customrecordtype.type))
          .concat([featuresInstance])
          .concat(objectsToImport)
          .concat(filesToImport)
          .concat(existingFileCabinetInstances)
          .concat(newFileCabinetInstancesElemIds)
          .concat({ elemID: UNKNOWN_TYPE_REFERENCES_ELEM_ID })
          .concat({ elemID: UNKNOWN_TYPE_REFERENCES_ELEM_ID.createNestedID('instance', ElemID.CONFIG_NAME) })

        const expectedElements = _.uniq(allTypes.map(type => type.elemID.getFullName())).sort()

        expect(loadedElements.map(e => e.elemID.getFullName()).sort()).toEqual(expectedElements)
      })

      it('should load the created entityCustomField correctly', async () => {
        const fetchedEntityCustomField = findElement(fetchedElements, entityCustomFieldToCreate.elemID)
        const loadedEntityCustomField = findElement(loadedElements, entityCustomFieldToCreate.elemID)
        expect(loadedEntityCustomField).toBeDefined()
        expect(loadedEntityCustomField).toEqual(fetchedEntityCustomField)
      })

      it('should load the created customRecordType correctly', async () => {
        const fetchedCustomRecordType = findElement(fetchedElements, customRecordTypeToCreate.elemID)
        const loadedCustomRecordType = findElement(loadedElements, customRecordTypeToCreate.elemID)
        expect(loadedCustomRecordType).toBeDefined()
        expect(loadedCustomRecordType).toEqual(fetchedCustomRecordType)
      })

      it('should load the created role correctly', async () => {
        const fetchedRole = findElement(fetchedElements, roleToCreateThatDependsOnCustomRecord.elemID)
        const loadedRole = findElement(loadedElements, roleToCreateThatDependsOnCustomRecord.elemID)
        expect(loadedRole).toBeDefined()
        expect(loadedRole).toEqual(fetchedRole)
      })

      it('should load the created workflow correctly', async () => {
        const fetchedWorkflow = findElement(fetchedElements, workflowToCreate.elemID)
        const loadedWorkflow = findElement(loadedElements, workflowToCreate.elemID)
        expect(loadedWorkflow).toBeDefined()
        expect(loadedWorkflow).toEqual(fetchedWorkflow)
      })

      it('should load the created email template correctly', async () => {
        const fetchedEmailTemplate = findElement(fetchedElements, emailTemplateToCreate.elemID)
        const loadedEmailTemplate = findElement(loadedElements, emailTemplateToCreate.elemID)
        expect(loadedEmailTemplate).toBeDefined()
        expect(loadedEmailTemplate).toEqual(fetchedEmailTemplate)
      })

      it('should load the created file correctly', async () => {
        const fetchedFile = findElement(fetchedElements, fileToCreate.elemID)
        const loadedFile = findElement(loadedElements, fileToCreate.elemID)
        expect(loadedFile).toBeDefined()
        expect(loadedFile).toEqual(fetchedFile)
      })

      it('should load the modified folder correctly', async () => {
        const fetchedFolder = findElement(fetchedElements, folderToModify.elemID)
        const loadedFolder = findElement(loadedElements, folderToModify.elemID)
        expect(loadedFolder).toBeDefined()
        expect(loadedFolder).toEqual(fetchedFolder)
      })

      it('should load the created transactionColumn correctly', async () => {
        const fetchedTransactionColumn = findElement(
          fetchedElements,
          transactionColumnToCreateThatDependsOnField.elemID,
        )
        const loadedTransactionColumn = findElement(loadedElements, transactionColumnToCreateThatDependsOnField.elemID)
        expect(loadedTransactionColumn).toBeDefined()
        expect(loadedTransactionColumn).toEqual(fetchedTransactionColumn)
      })

      it('should load the features instance correctly', async () => {
        const fetchedFeaturesInstance = findElement(fetchedElements, featuresInstance.elemID)
        const loadedFeaturesInstance = findElement(loadedElements, featuresInstance.elemID)
        expect(loadedFeaturesInstance).toBeDefined()
        expect(loadedFeaturesInstance).toEqual(fetchedFeaturesInstance)
      })

      it('should load existing folder with default attributes when attributes were not passed', async () => {
        expect(findElement(loadedElements, topLevelFolder.elemID)).toEqual(
          alignInactiveFields(
            new InstanceElement(
              topLevelFolder.elemID.name,
              additionalTypes[FOLDER],
              {
                bundleable: false,
                isinactive: false,
                isprivate: false,
                path: '/SuiteScripts',
              },
              ['netsuite', 'FileCabinet', 'SuiteScripts', 'SuiteScripts'],
              {
                [CORE_ANNOTATIONS.ALIAS]: 'SuiteScripts',
              },
            ),
          ),
        )
      })

      it('should load existing file with default attributes when attributes were not passed, and with its new content', async () => {
        expect(findElement(loadedElements, existingFileInstance.elemID)).toEqual(
          alignInactiveFields(
            new InstanceElement(
              existingFileInstance.elemID.name,
              additionalTypes[FILE],
              {
                availablewithoutlogin: false,
                bundleable: false,
                generateurltimestamp: false,
                hideinbundle: false,
                isinactive: false,
                path: '/SuiteScripts/b/existing.js',
                content: new StaticFile({
                  filepath: 'netsuite/FileCabinet/SuiteScripts/b/existing.js',
                  content: Buffer.from('console.log("Hello Back!")'),
                }),
              },
              ['netsuite', 'FileCabinet', 'SuiteScripts', 'b', 'existing.js'],
              {
                [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(innerFolder.elemID)],
                [CORE_ANNOTATIONS.ALIAS]: 'existing.js',
              },
            ),
          ),
        )
      })

      it('should load new folder with default values', async () => {
        expect(findElement(loadedElements, newFolderElemId)).toEqual(
          alignInactiveFields(
            new InstanceElement(
              newFolderElemId.name,
              additionalTypes[FOLDER],
              {
                bundleable: false,
                isinactive: false,
                isprivate: false,
                path: '/SuiteScripts/b/c',
              },
              ['netsuite', 'FileCabinet', 'SuiteScripts', 'b', 'c', 'c'],
              {
                [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(innerFolder.elemID)],
                [CORE_ANNOTATIONS.ALIAS]: 'c',
              },
            ),
          ),
        )
      })

      it('should load new file with default values', async () => {
        expect(findElement(loadedElements, newFileElemId)).toEqual(
          alignInactiveFields(
            new InstanceElement(
              newFileElemId.name,
              additionalTypes[FILE],
              {
                availablewithoutlogin: false,
                bundleable: false,
                generateurltimestamp: false,
                hideinbundle: false,
                isinactive: false,
                path: '/SuiteScripts/b/c/new.js',
                content: new StaticFile({
                  filepath: 'netsuite/FileCabinet/SuiteScripts/b/c/new.js',
                  content: Buffer.from('console.log("Hello World!")'),
                }),
              },
              ['netsuite', 'FileCabinet', 'SuiteScripts', 'b', 'c', 'new.js'],
              {
                [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(newFolderElemId)],
                [CORE_ANNOTATIONS.ALIAS]: 'new.js',
              },
            ),
          ),
        )
      })
    })

    describe('Delete records', () => {
      // TODO: merge revertChanges & revertChangesWithDependencies when SALTO-3036 is resolved
      const revertChanges: Map<ChangeId, Change<InstanceElement>> = new Map(
        [...(withSuiteApp ? [fileToCreate, subsidiaryInstance, customRecordInstance] : [])].map(
          (instanceToDelete, index) => [index.toString(), toChange({ before: instanceToDelete })],
        ),
      )
      const revertChangesWithDependencies: Map<ChangeId, Change<InstanceElement | ObjectType>> = new Map(
        [...(withSuiteApp ? [parentCustomRecordInstance, accountInstance, customRecordTypeToCreate] : [])].map(
          (instanceToDelete, index) => [index.toString(), toChange({ before: instanceToDelete })],
        ),
      )

      let deployResult: DeployResult
      beforeAll(async () => {
        const adapterAttr = realAdapter({ credentials: credentialsLease.value, withSuiteApp, elements: [] })
        adapter = adapterAttr.adapter

        const results = await deployChanges(adapter, revertChanges)
        results.push(...(await deployChanges(adapter, revertChangesWithDependencies)))

        deployResult = {
          appliedChanges: results.flatMap(result => result.appliedChanges),
          errors: results.flatMap(result => result.errors),
        }
      })

      it('should delete records', async () => {
        expect(deployResult.errors).toHaveLength(0)
        expect(deployResult.appliedChanges).toHaveLength(revertChanges.size + revertChangesWithDependencies.size)
      })
    })
  })
})
