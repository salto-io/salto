import _ from 'lodash'

export const makeArray = <TIn>(input: TIn | TIn[] | undefined): TIn[] => {
  if (input === undefined) {
    return []
  }
  return Array.isArray(input) ? input : [input]
}

export const concatArrayCustomizer: _.MergeWithCustomizer = <T>(objValue: T[], srcValue: T[]) => (
  objValue ? _.concat(objValue, srcValue) : srcValue
)
