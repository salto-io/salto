/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isInstanceElement, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { FileProperties } from '@salto-io/jsforce-types'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { isInstanceOfType, listMetadataObjects } from './utils'
import { INSTALLED_PACKAGE_METADATA, INSTANCE_FULL_NAME_FIELD } from '../constants'
import { notInSkipList } from '../fetch'
import { apiName, createInstanceElement, getAuthorAnnotations } from '../transformers/transformer'

const { awu } = collections.asynciterable

const createMissingInstalledPackageInstance = (file: FileProperties, installedPackageType: ObjectType): Element =>
  createInstanceElement(
    { [INSTANCE_FULL_NAME_FIELD]: file.fullName },
    installedPackageType,
    undefined,
    getAuthorAnnotations(file),
  )

const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'createMissingInstalledPackagesInstancesFilter',
  remote: true,
  onFetch: async (elements: Element[]): Promise<FilterResult | undefined> => {
    const installedPackageType = await awu(elements)
      .filter(isObjectType)
      .find(async objectType => (await apiName(objectType)) === INSTALLED_PACKAGE_METADATA)
    if (installedPackageType === undefined) {
      return
    }
    // Errors are not being handled, since they would have been handled before during the fetch
    const { elements: listResult } = await listMetadataObjects(client, INSTALLED_PACKAGE_METADATA)
    if (_.isEmpty(listResult)) {
      return
    }
    const existingInstalledPackageNamespaces = await awu(elements)
      .filter(isInstanceElement)
      .filter(isInstanceOfType(INSTALLED_PACKAGE_METADATA))
      .map(instance => apiName(instance))
      .toArray()
    listResult
      .filter(file => notInSkipList(config.fetchProfile.metadataQuery, file, false))
      .filter(file => !existingInstalledPackageNamespaces.includes(file.fullName))
      .map(file => createMissingInstalledPackageInstance(file, installedPackageType))
      .forEach(missingInstalledPackageInstance => elements.push(missingInstalledPackageInstance))
  },
})

export default filterCreator
