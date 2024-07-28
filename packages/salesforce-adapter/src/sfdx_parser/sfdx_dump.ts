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
  ComponentSet,
  ZipTreeContainer,
  MetadataConverter,
  TreeContainer,
  ManifestResolver,
  SourceComponent,
} from '@salesforce/source-deploy-retrieve'
import { SfProject } from '@salesforce/core'
import { isSubDirectory, rm } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import { Adapter } from '@salto-io/adapter-api'
import { resolveChangeElement } from '@salto-io/adapter-components'
import { filter } from '@salto-io/adapter-utils'
import { collections, promises, values } from '@salto-io/lowerdash'
import { allFilters, NESTED_METADATA_TYPES } from '../adapter'
import { SYSTEM_FIELDS, UNSUPPORTED_SYSTEM_FIELDS } from '../constants'
import { getLookUpName } from '../transformers/reference_mapping'
import { buildFetchProfile } from '../fetch_profile/fetch_profile'
import SalesforceClient from '../client/client'
import { createDeployPackage, DeployPackage, PACKAGE } from '../transformers/xml_transformer'
import { addChangeToPackage, validateChanges } from '../metadata_deploy'
import { isInstanceOfCustomObjectChangeSync } from '../filters/utils'
import { SyncZipTreeContainer } from './tree_container'

const log = logger(module)
const { awu } = collections.asynciterable
const { withLimitedConcurrency } = promises.array

const FILE_DELETE_CONCURRENCY = 100

const getManifestComponentsToDelete = async (tree: TreeContainer, pkg: DeployPackage): Promise<Set<string>> => {
  const deletionsFilename = `${PACKAGE}/${pkg.getDeletionsPackageName()}`
  if (!tree.exists(deletionsFilename)) {
    return new Set()
  }
  const deletionManifest = await new ManifestResolver(tree).resolve(deletionsFilename)

  return new Set(deletionManifest.components.map(comp => `${comp.type.id}.${comp.fullName}`))
}

const getComponentsToDelete = async (
  tree: TreeContainer,
  pkg: DeployPackage,
  currentComponents: SourceComponent[],
): Promise<SourceComponent[]> => {
  const manifestDeletions = await getManifestComponentsToDelete(tree, pkg)
  const toDelete = currentComponents
    // source components only returns top level components, if we want to delete child components (e.g - fields)
    // we have to explicitly iterate over those as well
    .flatMap(comp => [comp].concat(comp.getChildren()))
    .filter(comp => manifestDeletions.has(`${comp.type.id}.${comp.fullName}`))
  // If a component was deleted, we should also delete all of its child components
  const childComponentsToDelete = toDelete.flatMap(comp => comp.getChildren())
  return toDelete.concat(childComponentsToDelete)
}

const compactPathList = (paths: string[]): string[] => {
  // Remove paths that are nested under other paths to delete so we don't try to double-delete
  let lastPath: string | undefined
  return paths
    .sort()
    .map(pathToDelete => {
      if (lastPath !== undefined && isSubDirectory(pathToDelete, lastPath)) {
        return undefined
      }
      lastPath = pathToDelete
      return pathToDelete
    })
    .filter(values.isDefined)
}

type DumpElementsToFolderFunc = NonNullable<Adapter['dumpElementsToFolder']>
export const dumpElementsToFolder: DumpElementsToFolderFunc = async ({ baseDir, changes, elementsSource }) => {
  const [customObjectInstanceChanges, metadataChanges] = _.partition(changes, isInstanceOfCustomObjectChangeSync)

  const resolvedChanges = await awu(metadataChanges)
    .map(change => resolveChangeElement(change, getLookUpName))
    .toArray()

  const fetchProfile = buildFetchProfile({ fetchParams: {} })
  const filterRunner = filter.filtersRunner(
    {
      // TODO: This is a hack that we want to replace with something more type-safe in the near future
      // for now this works because non of the remote filters actually uses the client on preDeploy
      client: {} as unknown as SalesforceClient,
      config: {
        unsupportedSystemFields: UNSUPPORTED_SYSTEM_FIELDS,
        systemFields: SYSTEM_FIELDS,
        fetchProfile,
        elementsSource,
        flsProfiles: [],
      },
    },
    allFilters.map(({ creator }) => creator),
  )
  await filterRunner.preDeploy(resolvedChanges)

  const pkg = createDeployPackage()
  const { validChanges, errors } = await validateChanges(resolvedChanges)
  await Promise.all(
    validChanges.map(change =>
      addChangeToPackage(pkg, change, NESTED_METADATA_TYPES, {
        forceAddToManifest: true,
      }),
    ),
  )

  // Load the components we wish to merge with the current project
  const zipTree = await ZipTreeContainer.create(await pkg.getZip())
  const tree = new SyncZipTreeContainer(zipTree, pkg.getZipContent())
  const converter = new MetadataConverter()
  const saltoComponentSet = ComponentSet.fromSource({
    fsPaths: [PACKAGE],
    tree,
  })
  const componentsToDump = saltoComponentSet.getSourceComponents().toArray()

  // Load current SFDX project
  const currentProject = await SfProject.resolve(baseDir)
  const currentComponents = ComponentSet.fromSource(baseDir).getSourceComponents()

  // Calling "convert" below will remove components from the component set, but will not actually delete the files.
  // Therefore, we need to get the paths to all the files we intend to delete before calling "convert"
  const componentsToDelete = await getComponentsToDelete(tree, pkg, currentComponents.toArray())
  const allPathsToDelete = componentsToDelete.flatMap(comp => [comp.xml, comp.content].filter(values.isDefined))

  log.debug(
    'Starting SFDX convert of components: %o',
    componentsToDump.map(comp => `${comp.type.id}:${comp.fullName}`),
  )
  const convertResult = await converter.convert(componentsToDump, 'source', {
    type: 'merge',
    defaultDirectory: currentProject.getDefaultPackage().fullPath,
    mergeWith: currentComponents,
  })

  log.debug('Finished merging components with result %o', convertResult)

  // Remove paths that are nested under other paths to delete so we don't try to double-delete
  const pathsToDelete = compactPathList(allPathsToDelete)
  log.debug('Deleting files for %d removed components: %o', componentsToDelete.length, pathsToDelete)
  await withLimitedConcurrency(
    pathsToDelete.map(pathToDelete => () => rm(pathToDelete)),
    FILE_DELETE_CONCURRENCY,
  )

  return { errors, unappliedChanges: customObjectInstanceChanges }
}
