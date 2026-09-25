/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { EntityType } from '../enums/entity.enum';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import { GlossaryTermSearchSource } from '../interface/search.interface';
import { getEntityLinkFromType } from './EntityLinkUtils';

describe('EntityLinkUtils', () => {
  it('uses termId from a versioned CDE search document', () => {
    const source = {
      termId: 'cde-identity-id',
      name: 'CDE1',
      fullyQualifiedName: 'Data Dictionary.CDE1@v2',
      entityType: EntityType.GLOSSARY_TERM,
      businessVersion: '2.1',
      parentBusinessVersion: '2',
      entityStatus: EntityStatus.Draft,
    } as GlossaryTermSearchSource;

    expect(
      getEntityLinkFromType(
        source.fullyQualifiedName,
        EntityType.GLOSSARY_TERM,
        source
      )
    ).toBe(
      '/glossary/Data%20Dictionary.CDE1%40v2?businessVersion=2.1&parentBusinessVersion=2&termId=cde-identity-id&view=working'
    );
  });
});
