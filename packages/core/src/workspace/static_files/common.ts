/*
*                      Copyright 2020 Salto Labs Ltd.
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
export class StaticFileNaclValue {
  constructor(
    public readonly filepath: string,
  ) {}

  static get serializedTypeName(): string { return 'StaticFileNaclValue' }
}

export class StaticFileMetaData extends StaticFileNaclValue {
  constructor(
    filepath: string,
    public readonly hash: string,
    public readonly modified?: number,
  ) {
    super(filepath)
  }
}

export class InvalidStaticFile extends StaticFileNaclValue {
  constructor(
    public readonly filepath: string
  ) {
    super(filepath)
  }
}
