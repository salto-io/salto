import { ElemID, Element } from 'adapter-api'
import _ from 'lodash'
import { MergeResult, MergeError } from './common'
import { resolve } from '../../expressions'

class InvalidReferenceError extends MergeError {
  constructor(elemID: ElemID, msg: string) {
    super({ elemID, error: msg })
  }
}

export const resolveElements = (elements: Element[]): MergeResult<Element[]> => (
  _.reduce(elements, (acc: MergeResult<Element[]>, e: Element): MergeResult<Element[]> => {
    try {
      acc.merged = [...acc.merged, resolve(e, elements)]
    } catch (err) {
      acc.merged = [e, ...acc.merged]
      acc.errors = [
        new InvalidReferenceError(err.elemID || e.elemID, err.message),
        ...acc.errors,
      ]
    }
    return acc
  },
  { merged: [], errors: [] })
)
