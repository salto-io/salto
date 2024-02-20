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
import {
  Change,
  ChangeError,
  ElemID,
  InstanceElement,
  ObjectType,
  ProgressReporter,
  toChange,
  getChangeData,
  SeverityLevel,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { Filter } from '../src/filter'
import { fileType } from '../src/types/file_cabinet_types'
import getChangeValidator from '../src/change_validator'
import netsuiteClientValidation from '../src/change_validators/client_validation'
import { FetchByQueryFunc, FetchByQueryReturnType, NetsuiteQuery } from '../src/config/query'
import { fullFetchConfig } from '../src/config/config_creator'
import NetsuiteClient from '../src/client/client'
import * as dependencies from '../src/change_validators/dependencies'
import { INTERNAL_ID } from '../src/constants'

const DEFAULT_OPTIONS = {
  withSuiteApp: false,
  warnStaleData: false,
  validate: false,
  additionalDependencies: {
    include: { features: [], objects: [], files: [] },
    exclude: { features: [], objects: [], files: [] },
  },
  deployReferencedElements: false,
  filtersRunner: () =>
    ({
      preDeploy: jest.fn(),
    }) as unknown as Required<Filter>,
  elementsSource: jest.fn() as unknown as ReadOnlyElementsSource,
  fetchByQuery: jest.fn(),
  userConfig: {
    fetch: fullFetchConfig(),
  },
}

jest.mock('../src/change_validators/client_validation')
const netsuiteClientValidationMock = netsuiteClientValidation as jest.Mock

describe('change validator', () => {
  const file = fileType()
  const client = {} as unknown as NetsuiteClient

  describe('SuiteApp', () => {
    let fetchByQuery: FetchByQueryFunc
    beforeEach(() => {
      fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter): Promise<FetchByQueryReturnType> =>
        Promise.resolve({
          failures: {
            failedToFetchAllAtOnce: false,
            failedFilePaths: { lockedError: [], otherError: [], largeFolderError: [] },
            failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
            failedCustomRecords: [],
            largeSuiteQLTables: [],
          },
          elements: [],
          deletedElements: [],
        })
    })
    describe('without SuiteApp', () => {
      it('should have change error when removing an instance with file cabinet type', async () => {
        const changeValidator = getChangeValidator({
          ...DEFAULT_OPTIONS,
          client,
          fetchByQuery,
          elementsSource: buildElementsSourceFromElements([]),
        })
        const instance = new InstanceElement('test', file, { path: 'somePath' })
        const changeErrors = await changeValidator([toChange({ before: instance })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(instance.elemID)
      })
      it('should not have change error when modifying an file cabinet instance without internal id', async () => {
        const changeValidator = getChangeValidator({
          ...DEFAULT_OPTIONS,
          client,
          fetchByQuery,
          elementsSource: buildElementsSourceFromElements([]),
        })
        const instance = new InstanceElement('test', file, { path: 'somePath' })
        const changeErrors = await changeValidator([toChange({ before: instance, after: instance })])
        expect(changeErrors).toHaveLength(0)
      })
    })

    describe('with SuiteApp', () => {
      it('should not have change error when removing an instance with file cabinet type', async () => {
        const changeValidator = getChangeValidator({
          ...DEFAULT_OPTIONS,
          withSuiteApp: true,
          client,
          fetchByQuery,
          elementsSource: buildElementsSourceFromElements([]),
        })
        const instance = new InstanceElement('test', file, { [INTERNAL_ID]: '1', path: 'somePath' })
        const changeErrors = await changeValidator([toChange({ before: instance })])
        expect(changeErrors).toHaveLength(0)
      })
      it('should have change error when modifying an file cabinet instance without internal id', async () => {
        const changeValidator = getChangeValidator({
          ...DEFAULT_OPTIONS,
          withSuiteApp: true,
          client,
          fetchByQuery,
          elementsSource: buildElementsSourceFromElements([]),
        })
        const instance = new InstanceElement('test', file, { path: 'somePath' })
        const changeErrors = await changeValidator([toChange({ before: instance, after: instance })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors[0].severity).toEqual('Error')
        expect(changeErrors[0].elemID).toEqual(instance.elemID)
      })
    })
  })

  describe('warnOnStaleWorkspaceData', () => {
    let change: Change
    let fetchByQuery: FetchByQueryFunc
    beforeEach(() => {
      const origInstance = new InstanceElement('testInstance', new ObjectType({ elemID: new ElemID('testType') }), {
        livingIn: 'lalaland',
      })
      const serviceInstance = origInstance.clone()
      serviceInstance.value.livingIn = 'a movie'
      const modifiedInstance = origInstance.clone()
      modifiedInstance.value.livingIn = 'a garden'
      change = toChange({ before: origInstance, after: modifiedInstance })

      fetchByQuery = (_query: NetsuiteQuery, _progressReporter: ProgressReporter): Promise<FetchByQueryReturnType> =>
        Promise.resolve({
          failures: {
            failedToFetchAllAtOnce: false,
            failedFilePaths: { lockedError: [], otherError: [], largeFolderError: [] },
            failedTypes: { lockedError: {}, unexpectedError: {}, excludedTypes: [] },
            failedCustomRecords: [],
            largeSuiteQLTables: [],
          },
          elements: [serviceInstance],
          deletedElements: [],
        })
    })
    it('should not have change error when warnOnStaleWorkspaceData is false', async () => {
      const changeErrors = await getChangeValidator({
        ...DEFAULT_OPTIONS,
        client,
        fetchByQuery,
        elementsSource: buildElementsSourceFromElements([]),
      })([change])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have change error when warnOnStaleWorkspaceData is true', async () => {
      const changeErrors = await getChangeValidator({
        ...DEFAULT_OPTIONS,
        warnStaleData: true,
        client,
        fetchByQuery,
        elementsSource: buildElementsSourceFromElements([]),
      })([change])
      expect(changeErrors).toHaveLength(1)
    })
  })

  describe('netsuite client validation', () => {
    netsuiteClientValidationMock.mockResolvedValue([])
    it('should not call netsuiteClientValidation when validate=false', async () => {
      await getChangeValidator({
        ...DEFAULT_OPTIONS,
        client,
        elementsSource: buildElementsSourceFromElements([]),
      })([toChange({ after: new InstanceElement('test', file, { path: 'somePath' }) })])
      expect(netsuiteClientValidationMock).not.toHaveBeenCalled()
    })
    it('should call netsuiteClientValidation when validate=true', async () => {
      const changes = [toChange({ after: new InstanceElement('test', file, { path: 'somePath' }) })]
      await getChangeValidator({
        ...DEFAULT_OPTIONS,
        client,
        validate: true,
        elementsSource: buildElementsSourceFromElements([]),
      })(changes)
      expect(netsuiteClientValidationMock).toHaveBeenCalledWith(
        changes,
        client,
        DEFAULT_OPTIONS.additionalDependencies,
        DEFAULT_OPTIONS.filtersRunner,
      )
    })
    it('should call netsuiteClientValidation with only valid changes', async () => {
      const validChange = toChange({ after: new InstanceElement('valid_change', file, { path: 'somePath' }) })
      const invalidChange = toChange({
        after: new InstanceElement('invalid_dependencies_change', file, { path: 'somePath' }),
      })
      const changeErrors: ReadonlyArray<ChangeError> = [
        {
          elemID: getChangeData(invalidChange).elemID,
          severity: 'Error' as SeverityLevel,
          message: 'Depends on an element that has errors',
          detailedMessage: `(${getChangeData(invalidChange).elemID.getFullName()}) depends on an element that has errors`,
        },
      ]
      jest.spyOn(dependencies, 'validateDependsOnInvalidElement').mockReturnValue(Promise.resolve(changeErrors))
      await getChangeValidator({
        ...DEFAULT_OPTIONS,
        client,
        validate: true,
        elementsSource: buildElementsSourceFromElements([]),
      })([validChange, invalidChange])
      expect(netsuiteClientValidationMock).toHaveBeenCalledWith(
        [validChange],
        client,
        DEFAULT_OPTIONS.additionalDependencies,
        DEFAULT_OPTIONS.filtersRunner,
      )
    })
  })
})
