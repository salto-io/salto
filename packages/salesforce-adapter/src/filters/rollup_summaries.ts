import _ from 'lodash'
import { Element, Field } from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS } from '../constants'
import { bpCase, mapKeysRecursive, Types } from '../transformers/transformer'
import { runOnFields } from './utils'
import { CustomField } from '../client/types'

const { makeArray } = collections.array


/**
 * Declare the rollup summary filter, this filter adds annotations to rollup_summary fields
 * */
const filterCreator: FilterCreator = ({ client }) => ({

  /**
   * In order to fetch the rollup_summary data we should use a different API than in the general
   * flow (i.e. readMetadata())
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const addRollupSummaryData = (field: Field, salesforceField: CustomField): void => {
      const isRollupSummaryAnnotation = (annotationTypeKey: string): boolean =>
        Object.keys(Types.primitiveDataTypes.rollupsummary.annotationTypes)
          .includes(annotationTypeKey)

      const summaryFilterItemsInfo = salesforceField.summaryFilterItems
      if (summaryFilterItemsInfo) {
        field.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS] = makeArray(
          mapKeysRecursive(summaryFilterItemsInfo, bpCase)
        )
      }
      _.assign(field.annotations,
        _.pickBy(
          _.mapKeys(salesforceField, (_val, key) => bpCase(key)),
          (_val, key) => isRollupSummaryAnnotation(key)
        ))
    }

    const isRollupSummaryField = (field: Field): boolean =>
      Types.primitiveDataTypes.rollupsummary.elemID.isEqual(field.type.elemID)

    await runOnFields(elements, isRollupSummaryField, addRollupSummaryData, client)
  },
})

export default filterCreator
