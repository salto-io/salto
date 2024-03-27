import { InstanceElement, isInstanceElement, Value } from '@salto-io/adapter-api'
import { filter, isResolvedReferenceExpression, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { UserConfigAdapterFilterCreator } from '../filter_utils'
import { UserFetchConfig, UserFetchConfigOptions } from '../definitions'

type ValuesToSort = { [typeName: string]: { [fieldName: string]: string[] } }

//const getValue = (value: Value): Value => (isResolvedReferenceExpression(value) ? value.elemID.getFullName() : value)

const get = (current: Value, tail: string[]): Value => {
  if (current === undefined) {
    return undefined
  }
  const [head, ...rest] = tail
  const next: Value = _.get(current, head)
  if (isResolvedReferenceExpression(next)) {
    if (rest.length === 0) {
      return next.elemID.getFullName()
    }
    return get(next.value, rest)
  }
  return get(next, rest)
}

const sortLists = async (instance: InstanceElement, valuesToSort: ValuesToSort): Promise<void> => {
  instance.value =
    (await transformValues({
      values: instance.value,
      type: await instance.getType(),
      strict: false,
      allowEmpty: true,
      transformFunc: async ({ value, field }) => {
        if (field === undefined || !Array.isArray(value)) {
          return value
        }
        const sortFields = valuesToSort[field.parent.elemID.typeName]?.[field.name]

        if (sortFields !== undefined) {
          _.assign(
            value,
            _.orderBy(
              value,
              sortFields.map((fieldPath: string) => item => get(item, fieldPath.split('.'))),
            ),
          )
        }

        return value
      },
    })) ?? {}
}

export const sortListsFilterCreator: <
  TOptions extends UserFetchConfigOptions,
  TContext extends { fetch: Pick<UserFetchConfig<TOptions>, 'hideTypes'> },
  TResult extends void | filter.FilterResult = void,
>() => UserConfigAdapterFilterCreator<TContext, TResult> =
  () =>
    ({ config }) => ({
const filter: FilterCreator = (valuesToSort: ValuesToSort) => ({
  name: 'sortListsFilter',
  onFetch: async elements => {
    await awu(elements).filter(isInstanceElement).forEach(sortLists)
  },
})

export default filter
