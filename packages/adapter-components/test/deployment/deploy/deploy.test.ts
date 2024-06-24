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
import _ from 'lodash'
import {
  Change,
  ElemID,
  InstanceElement,
  ObjectType,
  changeId,
  getChangeData,
  isSaltoElementError,
  toChange,
} from '@salto-io/adapter-api'
import { types } from '@salto-io/lowerdash'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { deployChanges } from '../../../src/deployment/deploy/deploy'
import { ApiDefinitions } from '../../../src/definitions'
import * as mockedRequester from '../../../src/deployment/deploy/requester'
import { HTTPReadClientInterface, HTTPWriteClientInterface } from '../../../src/client'
import { noPagination } from '../../../src/fetch/request/pagination'

jest.mock('../../../src/deployment/deploy/requester', () => ({
  ...jest.requireActual<{}>('../../../src/deployment/deploy/requester'),
  getRequester: jest.fn(),
}))

describe('deployChanges', () => {
  let changes: Change<InstanceElement>[]
  let definitions: types.PickyRequired<
    ApiDefinitions<{ additionalAction: 'activate' | 'deactivate' }>,
    'clients' | 'deploy'
  >
  let client: MockInterface<HTTPReadClientInterface & HTTPWriteClientInterface>

  // TODO extend coverage (concurrency, error handling, references)

  beforeEach(() => {
    jest.clearAllMocks()
    const typeA = new ObjectType({ elemID: new ElemID('adapter', 'typeA') })
    const typeB = new ObjectType({ elemID: new ElemID('adapter', 'typeB') })
    const typeC = new ObjectType({ elemID: new ElemID('adapter', 'typeC') })
    changes = [
      toChange({ after: new InstanceElement('add1', typeA) }),
      toChange({ after: new InstanceElement('add2', typeA) }),
      toChange({
        before: new InstanceElement('mod2', typeA, { a: 'before' }),
        after: new InstanceElement('mod2', typeA, { a: 'after' }),
      }),
      toChange({ before: new InstanceElement('remove3', typeA, { a: 'before' }) }),
      toChange({ after: new InstanceElement('add1', typeB) }),
      toChange({
        before: new InstanceElement('mod2', typeB, { a: 'before' }),
        after: new InstanceElement('mod2', typeB, { a: 'after' }),
      }),
      toChange({ before: new InstanceElement('remove3', typeB, { a: 'before' }) }),
      toChange({ before: new InstanceElement('remove3', typeC, { a: 'before' }) }),
      toChange({
        before: new InstanceElement('mod2', typeC, { a: 'before' }),
        after: new InstanceElement('mod2', typeC, { a: 'after' }),
      }),
    ]
    client = {
      get: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['get']>(),
      put: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['put']>(),
      patch: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['patch']>(),
      post: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['post']>(),
      delete: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['delete']>(),
      head: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['head']>(),
      options: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['options']>(),
      getPageSize: mockFunction<(HTTPReadClientInterface & HTTPWriteClientInterface)['getPageSize']>(),
    }
    definitions = {
      deploy: {
        instances: {
          customizations: {
            typeA: {
              requestsByAction: {
                customizations: {},
              },
            },
            typeB: {
              requestsByAction: {
                customizations: {},
              },
              toActionNames: ({ change }) => {
                if (change.action === 'add') {
                  return ['add', 'activate']
                }
                if (change.action === 'remove') {
                  return ['remove', 'deactivate']
                }
                return [change.action]
              },
              actionDependencies: [
                { first: 'add', second: 'activate' },
                { first: 'deactivate', second: 'remove' },
              ],
            },
            someOtherType: {
              requestsByAction: {
                customizations: {},
              },
            },
          },
        },
        dependencies: [
          { first: { type: 'typeA', action: 'add' }, second: { type: 'typeB' } },
          { first: { type: 'typeC' }, second: { type: 'typeB' } },
          { first: { type: 'unavailable1' }, second: { type: 'typeB' } },
        ],
      },
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
      pagination: {
        none: {
          funcCreator: noPagination,
        },
      },
    }
  })

  it('should deploy all changes in order based on the dependencies when there are no errors', async () => {
    ;(mockedRequester.getRequester as jest.Mock).mockReturnValueOnce({
      requestAllForChangeAndAction: async () => undefined,
    })
    const res = await deployChanges({
      definitions,
      changeGroup: { changes, groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
      sharedContext: {},
      changes,
      convertError: (_elemID, err) => err,
      changeResolver: async change => change,
    })
    expect(_.sortBy(res.appliedChanges, changeId)).toEqual(_.sortBy(changes, changeId))
    expect(res.errors).toHaveLength(0)
    expect(mockedRequester.getRequester).toHaveBeenCalledTimes(1)
  })
  it('should return partial success when there are errors', async () => {
    ;(mockedRequester.getRequester as jest.Mock).mockReturnValueOnce({
      requestAllForChangeAndAction: async ({ change }: { change: Change<InstanceElement> }) => {
        if (getChangeData(change).elemID.typeName === 'typeA') {
          throw new Error('failed to deploy typeA')
        }
      },
    })

    const res = await deployChanges({
      definitions,
      changeGroup: { changes, groupID: 'abc' },
      elementSource: buildElementsSourceFromElements([]),
      sharedContext: {},
      changes,
      convertError: (_elemID, err) => err,
      changeResolver: async change => change,
    })
    expect(_.sortBy(res.appliedChanges, changeId)).toEqual(_.sortBy(changes.slice(4), changeId))
    expect(res.errors).toHaveLength(4)
    expect(res.errors.map(e => e.message)).toEqual(_.times(4, () => 'Error: failed to deploy typeA'))
    expect(res.errors.map(e => e.severity)).toEqual(_.times(4, () => 'Error'))
    expect(res.errors.filter(isSaltoElementError)).toHaveLength(4)
    expect(
      res.errors
        .filter(isSaltoElementError)
        .map(e => e.elemID.getFullName())
        .sort(),
    ).toEqual([
      'adapter.typeA.instance.add1',
      'adapter.typeA.instance.add2',
      'adapter.typeA.instance.mod2',
      'adapter.typeA.instance.remove3',
    ])
    expect(mockedRequester.getRequester).toHaveBeenCalledTimes(1)
  })
})
