import {
  filters as filterUtils,
} from '@salto-io/adapter-components'
import { FilterCreator, FilterResult } from '../filter'
import { OktaOptions } from '../definitions/types'
import { getOktaError } from '../deployment'
import { getLookUpName, OktaFieldReferenceResolver } from '../reference_mapping'

const filterCreator: FilterCreator = filterUtils.defaultDeployFilterCreator<FilterResult, OktaOptions>({
  convertError: getOktaError,
  customLookupFunc: getLookUpName,
  fieldReferenceResolverCreator: OktaFieldReferenceResolver.create,
})

export default filterCreator