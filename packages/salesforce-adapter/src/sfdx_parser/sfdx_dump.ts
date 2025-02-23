/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import path from 'path'
import { isSubDirectory, rm } from '@salto-io/file'
import { logger } from '@salto-io/logging'
import { AdapterFormat, Change, getChangeData, isField, isObjectType } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { objects, promises, values } from '@salto-io/lowerdash'
import { allFilters, NESTED_METADATA_TYPES } from '../adapter'
import { CUSTOM_METADATA, SYSTEM_FIELDS, UNSUPPORTED_SYSTEM_FIELDS, API_NAME } from '../constants'
import { getLookUpName, resolveSalesforceChanges } from '../transformers/reference_mapping'
import { buildFetchProfile } from '../fetch_profile/fetch_profile'
import { createDeployPackage, DeployPackage, PACKAGE } from '../transformers/xml_transformer'
import { addChangeToPackage, validateChanges } from '../metadata_deploy'
import {
  isCustomObjectSync,
  isInstanceOfCustomObjectChangeSync,
  isMetadataInstanceElementSync,
  metadataTypeSync,
} from '../filters/utils'
import {
  ComponentSet,
  ZipTreeContainer,
  MetadataConverter,
  TreeContainer,
  ManifestResolver,
  SourceComponent,
  SfProject,
} from './salesforce_imports'
import { SyncZipTreeContainer } from './tree_container'
import { detailedMessageFromSfError } from './errors'
import { loadElementsFromFolder } from './sfdx_parser'

const log = logger(module)
const { withLimitedConcurrency } = promises.array

const FILE_DELETE_CONCURRENCY = 100

export const UNSUPPORTED_TYPES = new Set([
  // For documents with a file extension (e.g. bla.txt) the SF API returns their fullName with the extension (so "bla.txt")
  // but the SFDX convert code loads them as a component with a fullName without the extension (so "bla").
  // This causes us to always think documents with an extension in the project need to be deleted
  'Document',
  'DocumentFolder',
  // Custom labels are separate instances (CustomLabel) that are all in the same xml file
  // Unfortunately, unlike other types like this (e.g - workflow, sharing rules), the SFDX code does not handle deleting
  // instances of labels from the "merged" XML, so until we implement proper deletion support, we exclude this type
  'CustomLabels',
  // Note - we exclude the type name of the internal type here as well even though it cannot be a SFDX component type
  // we do this because we need to exclude changes in dumpElementsToFolder as well and in the workspace we do model each CustomLabel
  // as a separate instance
  'CustomLabel',
])

const isSupportedMetadataChange = (change: Change): boolean => {
  const element = getChangeData(change)
  const metadataTypeName = metadataTypeSync(element)
  if (UNSUPPORTED_TYPES.has(metadataTypeName)) {
    return false
  }
  return true
}

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
): Promise<{ fullDelete: SourceComponent[]; partialDelete: SourceComponent[] }> => {
  if (currentComponents.length === 0) {
    return { fullDelete: [], partialDelete: [] }
  }

  const manifestDeletions = await getManifestComponentsToDelete(tree, pkg)
  const isInDeleteManifest = (comp: SourceComponent): boolean =>
    manifestDeletions.has(`${comp.type.id}.${comp.fullName}`)

  const result = currentComponents.map(comp => {
    if (isInDeleteManifest(comp)) {
      // We want to delete the entire component, we also fully delete all child components
      return { fullDelete: [comp].concat(comp.getChildren()), partialDelete: [] }
    }
    const childrenToDelete = comp.getChildren().filter(child => isInDeleteManifest(child))
    // In this case we want to delete child components without deleting the parent
    // We can delete child components that appear in a separate file, but for components that appear in the same file
    // as their parent, we must not delete the entire file.
    // It seems like the MetadataConverter handles such "partial" deletions, but only does so properly for some types
    // - for sharing rules and workflows this seems to work (though it is not fully consistent as it can leave the parent empty)
    // - for custom fields and other children of CustomObject that are in different files, it does not work at all
    // - for custom labels (which are in the parent file), it also doesn't work
    const [partialDelete, fullDelete] = _.partition(childrenToDelete, child => child.xml === comp.xml)
    return { fullDelete, partialDelete }
  })
  return objects.concatObjects(result)
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

type DumpElementsToFolderFunc = NonNullable<AdapterFormat['dumpElementsToFolder']>
export const dumpElementsToFolder: DumpElementsToFolderFunc = async ({ baseDir, changes, elementsSource }) => {
  const [customObjectInstanceChanges, metadataAndTypeChanges] = _.partition(changes, isInstanceOfCustomObjectChangeSync)
  const [metadataChanges, typeChanges] = _.partition(metadataAndTypeChanges, change => {
    const data = getChangeData(change)
    return (
      isMetadataInstanceElementSync(data) ||
      isCustomObjectSync(data) ||
      (isObjectType(data) && metadataTypeSync(data) === CUSTOM_METADATA && data.annotations[API_NAME] !== undefined) ||
      (isField(data) && isCustomObjectSync(data.parent))
    )
  })
  const [supportedMetadataChanges, unsupportedMetadataChanges] = _.partition(metadataChanges, isSupportedMetadataChange)
  const unappliedChanges = typeChanges.concat(customObjectInstanceChanges).concat(unsupportedMetadataChanges)

  const fetchProfile = buildFetchProfile({
    fetchParams: {},
  })

  log.debug('Resolving %d changes for SFDX dump', supportedMetadataChanges.length)
  const resolvedChanges = await resolveSalesforceChanges(supportedMetadataChanges, getLookUpName(fetchProfile))

  log.debug('Running pre-deploy filters on %d changes for SFDX dump', resolvedChanges.length)
  const filterRunner = filter.filtersRunner(
    {
      config: {
        unsupportedSystemFields: UNSUPPORTED_SYSTEM_FIELDS,
        systemFields: SYSTEM_FIELDS,
        fetchProfile,
        elementsSource,
        flsProfiles: [],
      },
    },
    allFilters,
  )
  await filterRunner.preDeploy(resolvedChanges)

  log.debug('Validating %d changes for SFDX dump', resolvedChanges.length)
  const { validChanges, errors } = await validateChanges(resolvedChanges)

  log.debug('Adding %d changes to SFDX dump package', validChanges.length)
  const pkg = createDeployPackage()
  await Promise.all(
    validChanges.map(change =>
      addChangeToPackage(pkg, change, NESTED_METADATA_TYPES, {
        forceAddToManifest: true,
      }),
    ),
  )

  // Load the components we wish to merge with the current project
  log.debug('Creating component set for SFDX dump')
  const zipTree = await ZipTreeContainer.create(await pkg.getZip())
  const tree = new SyncZipTreeContainer(zipTree, pkg.getZipContent())
  const converter = new MetadataConverter()
  const saltoComponentSet = ComponentSet.fromSource({
    fsPaths: [PACKAGE],
    tree,
  })
  const componentsToDump = saltoComponentSet
    .filter(component => !UNSUPPORTED_TYPES.has(component.type.name))
    .getSourceComponents()
    .toArray()

  // SFDX code has some issues when working with relative paths (some custom object files may get the wrong path)
  // normalizing the base dir to be an absolute path to work around those issues
  const absBaseDir = path.resolve(baseDir)
  // Load current SFDX project
  log.debug('Loading current SFDX components from %s', absBaseDir)
  const currentProject = await SfProject.resolve(absBaseDir)
  const currentComponents = ComponentSet.fromSource(absBaseDir)

  // Calling "convert" below will remove components from the component set, but will not actually delete the files.
  // Therefore, we need to get the paths to all the files we intend to delete before calling "convert"
  log.debug('Marking components for SFDX deletion')
  const componentsToDelete = await getComponentsToDelete(tree, pkg, currentComponents.getSourceComponents().toArray())
  const allPathsToDelete = componentsToDelete.fullDelete.flatMap(comp =>
    [comp.xml, comp.content].filter(values.isDefined),
  )
  componentsToDelete.partialDelete.forEach(comp => comp.setMarkedForDelete(true))

  log.debug(
    'Starting SFDX convert of components: %o',
    componentsToDump.map(comp => `${comp.type.id}:${comp.fullName}`),
  )

  try {
    const convertResult = await converter.convert(componentsToDump.concat(componentsToDelete.partialDelete), 'source', {
      type: 'merge',
      defaultDirectory: currentProject.getDefaultPackage().fullPath,
      mergeWith: currentComponents.getSourceComponents(),
    })
    log.debug(
      'Finished merging components with result, converted: %o',
      convertResult.converted?.map(comp => `${comp.type.id}:${comp.fullName}`),
    )
  } catch (error) {
    return {
      unappliedChanges,
      errors: errors.concat({
        severity: 'Error',
        message: 'Failed persisting changes to SFDX project',
        detailedMessage: detailedMessageFromSfError(error),
      }),
    }
  }

  // Remove paths that are nested under other paths to delete so we don't try to double-delete
  const pathsToDelete = compactPathList(allPathsToDelete)
  log.debug('Deleting files for %d removed components: %o', componentsToDelete.fullDelete.length, pathsToDelete)
  await withLimitedConcurrency(
    pathsToDelete.map(pathToDelete => () => rm(pathToDelete)),
    FILE_DELETE_CONCURRENCY,
  )

  log.debug('Loading elements from folder to validate dump.')
  const { errors: loadErrors } = await loadElementsFromFolder({ baseDir, elementsSource })
  loadErrors?.forEach(error => {
    log.error('Got an error validating dumped SFDX: %o', error)
    error.message = 'Error validating dumped SFDX project'
    errors.push(error)
  })

  return { errors, unappliedChanges }
}
