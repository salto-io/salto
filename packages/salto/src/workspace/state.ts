import { Element, ElemID } from 'adapter-api'
import { ElementsDataSource } from './elements_data_source'

export interface State extends ElementsDataSource {
  set(element: Element | Element[]): Promise<void>
  remove(id: ElemID | ElemID[]): Promise<void>
  flush?(): Promise<void>
}
