/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
type StatusSuccess = {
  _attributes: {
    isSuccess: 'true'
  }
}

type StatusError = {
  _attributes: {
    isSuccess: 'false'
  }
  'platformCore:statusDetail': {
    'platformCore:code': {
      _text: string
    }
    'platformCore:message': {
      _text: string
    }
  }
}

export type GetSuccess = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      getResponse: {
        'platformMsgs:readResponse': {
          'platformCore:status': StatusSuccess
          'platformMsgs:record': {
            'docFileCab:content': {
              _text?: string
            }
          }
        }
      }
    }
  }
}

export type GetError = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      getResponse: {
        'platformMsgs:readResponse': {
          'platformCore:status': StatusError
        }
      }
    }
  }
}

export type GetResult = GetSuccess | GetError

export const isGetSuccess = (result: GetResult): result is GetSuccess =>
  // eslint-disable-next-line no-underscore-dangle
  result['soapenv:Envelope']['soapenv:Body'].getResponse['platformMsgs:readResponse']['platformCore:status']._attributes.isSuccess === 'true'

export type WriteResponseSuccess = {
  'platformCore:status': StatusSuccess
  baseRef: {
    _attributes: {
      internalId: string
    }
  }
}

export type WriteResponseError = {
  'platformCore:status': StatusError
}

export type WriteResponse = WriteResponseSuccess | WriteResponseError

export const isWriteResponseSuccess = (result: WriteResponse): result is WriteResponseSuccess =>
  // eslint-disable-next-line no-underscore-dangle
  result['platformCore:status']._attributes.isSuccess === 'true'


export type UpdateListSuccess = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      updateListResponse: {
        writeResponseList: {
          'platformCore:status': StatusSuccess
          writeResponse: WriteResponse[] | WriteResponse
        }
      }
    }
  }
}

export type UpdateListError = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      updateListResponse: {
        writeResponseList: {
          'platformCore:status': StatusError
        }
      }
    }
  }
}

export type UpdateListResults = UpdateListError | UpdateListSuccess

export const isUpdateListSuccess = (result: UpdateListResults): result is UpdateListSuccess =>
  // eslint-disable-next-line no-underscore-dangle
  result['soapenv:Envelope']['soapenv:Body'].updateListResponse.writeResponseList['platformCore:status']._attributes.isSuccess === 'true'


export type AddListSuccess = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      addListResponse: {
        writeResponseList: {
          'platformCore:status': StatusSuccess
          writeResponse: WriteResponse[] | WriteResponse
        }
      }
    }
  }
}

export type AddListError = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      addListResponse: {
        writeResponseList: {
          'platformCore:status': StatusError
        }
      }
    }
  }
}

export type AddListResults = AddListError | AddListSuccess

export const isAddListSuccess = (result: AddListResults): result is AddListSuccess =>
  // eslint-disable-next-line no-underscore-dangle
  result['soapenv:Envelope']['soapenv:Body'].addListResponse.writeResponseList['platformCore:status']._attributes.isSuccess === 'true'

export type DeleteListSuccess = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      deleteListResponse: {
        writeResponseList: {
          'platformCore:status': StatusSuccess
          writeResponse: WriteResponse[] | WriteResponse
        }
      }
    }
  }
}

export type DeleteListError = {
  'soapenv:Envelope': {
    'soapenv:Body': {
      deleteListResponse: {
        writeResponseList: {
          'platformCore:status': StatusError
        }
      }
    }
  }
}

export type DeleteListResults = DeleteListError | DeleteListSuccess

export const isDeleteListSuccess = (result: DeleteListResults): result is DeleteListSuccess =>
// eslint-disable-next-line no-underscore-dangle
  result['soapenv:Envelope']['soapenv:Body'].deleteListResponse.writeResponseList['platformCore:status']._attributes.isSuccess === 'true'
