import { Change, Element, ChangeValidator, ChangeError } from 'adapter-api'
import { filterHasMember } from '@salto/lowerdash/dist/src/types'
import _ from 'lodash'
import packageValidator from './change_validators/package'


const changeValidators: Partial<ChangeValidator>[] = [
  packageValidator,
]

const runOnUpdateValidators = (changes: ReadonlyArray<Change>): ReadonlyArray<ChangeError> =>
  _.flatMap(filterHasMember('onUpdate', changeValidators), v => v.onUpdate(changes))

const runOnAddValidators = (after: Element): ReadonlyArray<ChangeError> =>
  _.flatMap(filterHasMember('onAdd', changeValidators), v => v.onAdd(after))

const runOnRemoveValidators = (before: Element): ReadonlyArray<ChangeError> =>
  _.flatMap(filterHasMember('onRemove', changeValidators), v => v.onRemove(before))

export const changeValidator: ChangeValidator = {
  onUpdate: (changes: ReadonlyArray<Change>) => runOnUpdateValidators(changes),
  onAdd: (after: Element) => runOnAddValidators(after),
  onRemove: (before: Element) => runOnRemoveValidators(before),
}
