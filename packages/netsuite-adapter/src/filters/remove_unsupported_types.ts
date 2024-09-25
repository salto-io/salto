/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { isObjectType } from '@salto-io/adapter-api'
import { NETSUITE } from '../constants'
import { LocalFilterCreator } from '../filter'
import { getMetadataTypes, isCustomRecordType, isDataObjectType, metadataTypesToList } from '../types'
import { SUPPORTED_TYPES } from '../data_elements/types'

const filterCreator: LocalFilterCreator = ({ typeToInternalId }) => ({
  name: 'removeUnsupportedTypes',
  onFetch: async elements => {
    const sdfTypeNames = new Set(metadataTypesToList(getMetadataTypes()).map(e => e.elemID.getFullName().toLowerCase()))
    const dataTypes = elements.filter(isObjectType).filter(isDataObjectType)
    const supportedFetchedInstancesTypeNames = SUPPORTED_TYPES
    // types we fetch without their instances
    const additionalFetchedTypes = Object.keys(typeToInternalId)
    const customRecordTypeNames = dataTypes.filter(isCustomRecordType).map(({ elemID }) => elemID.name)

    const supportedTypeNames = _.uniq(
      supportedFetchedInstancesTypeNames.concat(additionalFetchedTypes).concat(customRecordTypeNames),
    )

    const supportedDataTypes = (await elementUtils.filterTypes(NETSUITE, dataTypes, supportedTypeNames))
      .filter(e => !sdfTypeNames.has(e.elemID.getFullName().toLowerCase()))
      .filter(e => !isObjectType(e) || !isCustomRecordType(e))

    _.remove(elements, e => isObjectType(e) && isDataObjectType(e) && !isCustomRecordType(e))
    elements.push(...supportedDataTypes)
  },
})

export default filterCreator
