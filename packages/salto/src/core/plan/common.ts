import { DiffGraph } from '@salto/dag'
import { ChangeDataType, ElemID, Change } from 'adapter-api'

export type DiffGraphTransformer = (graph: DiffGraph<ChangeDataType>) => DiffGraph<ChangeDataType>

export const changeId = ({ elemID }: { elemID: ElemID }, action: Change['action']): string =>
  `${elemID.getFullName()}/${action}`
