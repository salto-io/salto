import _ from 'lodash'
import { Element, Field, ObjectType } from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS } from '../constants'
import {
  bpCase, mapKeysRecursive, Types,
} from '../transformer'
import {
  generateObjectElemID2ApiName, getCustomFieldName, getCustomObjects, readCustomFields,
} from './utils'

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
    const getRollupSummaryFields = (obj: ObjectType): Field[] =>
      Object.values(obj.fields).filter(f => Types.primitiveDataTypes.rollupsummary.isEqual(f.type))

    const customObjects = getCustomObjects(elements)
    const objectElemID2ApiName = generateObjectElemID2ApiName(customObjects)

    const rollupSummaryFields = _(customObjects)
      .map(getRollupSummaryFields)
      .flatten()
      .value()

    const customFieldNames = rollupSummaryFields
      .map(f => getCustomFieldName(f, objectElemID2ApiName))

    const name2Field = await readCustomFields(client, customFieldNames)

    const addRollupSummaryData = (field: Field): void => {
      const salesforceField = name2Field[getCustomFieldName(field, objectElemID2ApiName)]
      const summaryFilterItemsInfo = salesforceField.summaryFilterItems
      if (summaryFilterItemsInfo) {
        field.annotations[FIELD_ANNOTATIONS.SUMMARY_FILTER_ITEMS] = makeArray(
          mapKeysRecursive(summaryFilterItemsInfo, bpCase)
        )
      }
      _.assign(field.annotations,
        _.pickBy(
          _.mapKeys(salesforceField,
            (_val, key) => bpCase(key)),
          (_val, key) => Object.keys(Types.primitiveDataTypes.rollupsummary.annotationTypes)
            .includes(key)
        ))
    }

    rollupSummaryFields.forEach(addRollupSummaryData)
  },
})

export default filterCreator
