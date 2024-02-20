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
import { Element, InstanceElement } from '@salto-io/adapter-api'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { WorkspaceConfig } from '../../src/workspace/config/workspace_config_types'
import { Errors } from '../../src/errors'
import { AdaptersConfigSource } from '../../src/workspace/adapters_config_source'
import { ConfigSource } from '../../src/workspace/config_source'
import { DirectoryStore } from '../../src/workspace/dir_store'
import { createInMemoryElementSource } from '../../src/workspace/elements_source'
import { naclFilesSource } from '../../src/workspace/nacl_files'
import { Path } from '../../src/workspace/path_index'
import { InMemoryRemoteMap, RemoteMapCreator } from '../../src/workspace/remote_map'
import { State, buildInMemState } from '../../src/workspace/state'
import { StaticFilesSource } from '../../src/workspace/static_files'
import { EnvironmentSource, Workspace, loadWorkspace } from '../../src/workspace/workspace'
import { WorkspaceConfigSource } from '../../src/workspace/workspace_config_source'
import { mockStaticFilesSource, persistentMockCreateRemoteMap } from '../utils'
import { createMockNaclFileSource } from './nacl_file_source'
import { mockDirStore } from './nacl_file_store'

const services = ['salesforce']
export const mockWorkspaceConfigSource = (
  conf?: Partial<WorkspaceConfig>,
  secondaryEnv?: boolean,
): jest.Mocked<WorkspaceConfigSource> => ({
  getWorkspaceConfig: jest.fn().mockImplementation(() => ({
    envs: [
      {
        name: 'default',
        accounts: services,
        accountToServiceName: Object.fromEntries(services.map(service => [service, service])),
      },
      ...(secondaryEnv
        ? [
            {
              name: 'inactive',
              accounts: [...services, 'netsuite'],
              accountToServiceName: {
                netsuite: 'netsuite',
                ...Object.fromEntries(services.map(service => [service, service])),
              },
            },
          ]
        : []),
    ],
    uid: '',
    name: 'test',
    currentEnv: 'default',
    ...conf,
  })),
  setWorkspaceConfig: jest.fn(),
})

export const mockAdaptersConfigSource = (): MockInterface<AdaptersConfigSource> => {
  const adapters: Record<string, InstanceElement> = {}

  const getAdapter = async (adapterName: string): Promise<InstanceElement | undefined> => adapters[adapterName]
  const setAdapter = async (
    accountName: string,
    _adapterName: string,
    config: Readonly<InstanceElement> | Readonly<InstanceElement>[],
  ): Promise<void> => {
    if (!_.isArray(config)) {
      adapters[accountName] = config as InstanceElement
    }
  }

  return {
    getAdapter: mockFunction<AdaptersConfigSource['getAdapter']>().mockImplementation(getAdapter),
    setAdapter: mockFunction<AdaptersConfigSource['setAdapter']>().mockImplementation(setAdapter),
    getElementNaclFiles: mockFunction<AdaptersConfigSource['getElementNaclFiles']>(),
    getErrors: mockFunction<AdaptersConfigSource['getErrors']>().mockResolvedValue(
      new Errors({
        parse: [],
        validation: [],
        merge: [],
      }),
    ),
    getSourceRanges: mockFunction<AdaptersConfigSource['getSourceRanges']>().mockResolvedValue([]),
    getNaclFile: mockFunction<AdaptersConfigSource['getNaclFile']>(),
    setNaclFiles: mockFunction<AdaptersConfigSource['setNaclFiles']>(),
    flush: mockFunction<AdaptersConfigSource['flush']>(),
    getElements: mockFunction<AdaptersConfigSource['getElements']>(),
    getParsedNaclFile: mockFunction<AdaptersConfigSource['getParsedNaclFile']>(),
    getSourceMap: mockFunction<AdaptersConfigSource['getSourceMap']>(),
    listNaclFiles: mockFunction<AdaptersConfigSource['listNaclFiles']>(),
    isConfigFile: mockFunction<AdaptersConfigSource['isConfigFile']>(),
  }
}

export const mockCredentialsSource = (): ConfigSource => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  rename: jest.fn(),
})

export const createState = (elements: Element[], persistent = true): State =>
  buildInMemState(
    async () => ({
      elements: createInMemoryElementSource(elements),
      pathIndex: new InMemoryRemoteMap<Path[]>(),
      topLevelPathIndex: new InMemoryRemoteMap<Path[]>(),
      referenceSources: new InMemoryRemoteMap(),
      accountsUpdateDate: new InMemoryRemoteMap(),
      changedBy: new InMemoryRemoteMap([{ key: 'name@@account', value: ['elemId'] }]),
      saltoMetadata: new InMemoryRemoteMap([{ key: 'version', value: '0.0.1' }]),
      staticFilesSource: mockStaticFilesSource(),
    }),
    persistent,
  )

export const createWorkspace = async (
  dirStore?: DirectoryStore<string>,
  state?: State,
  configSource?: WorkspaceConfigSource,
  adaptersConfigSource?: AdaptersConfigSource,
  credentials?: ConfigSource,
  staticFilesSource?: StaticFilesSource,
  elementSources?: Record<string, EnvironmentSource>,
  remoteMapCreator?: RemoteMapCreator,
  persistent = true,
): Promise<Workspace> => {
  const mapCreator = remoteMapCreator ?? persistentMockCreateRemoteMap()
  const actualStaticFilesSource = staticFilesSource || mockStaticFilesSource()
  return loadWorkspace(
    configSource || mockWorkspaceConfigSource(),
    adaptersConfigSource || mockAdaptersConfigSource(),
    credentials || mockCredentialsSource(),
    {
      commonSourceName: '',
      sources: elementSources || {
        '': {
          naclFiles: await naclFilesSource(
            '',
            dirStore || mockDirStore(),
            actualStaticFilesSource,
            mapCreator,
            persistent,
          ),
        },
        default: {
          naclFiles: createMockNaclFileSource([]),
          state: state ?? createState([], persistent),
        },
      },
    },
    mapCreator,
  )
}
