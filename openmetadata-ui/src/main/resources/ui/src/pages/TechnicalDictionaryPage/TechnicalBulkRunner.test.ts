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
import { TechnicalBulkResult } from '../../rest/technicalDictionaryAPI';
import { EMPTY_TECHNICAL_FILTERS } from './technicalDictionary.interface';
import { buildBulkCriteria, runBulkUntilDone } from './TechnicalBulkRunner';

const result = (
  overrides: Partial<TechnicalBulkResult>
): TechnicalBulkResult => ({
  action: 'SUBMIT',
  dryRun: false,
  matched: 0,
  eligible: 0,
  ineligible: 0,
  attempted: 0,
  succeeded: 0,
  failedCount: 0,
  failures: [],
  remaining: 0,
  ...overrides,
});

describe('buildBulkCriteria', () => {
  it('omits empty filters', () => {
    expect(buildBulkCriteria(EMPTY_TECHNICAL_FILTERS)).toEqual({});
  });

  it('serializes set filters with the parameter names the server expects', () => {
    expect(
      buildBulkCriteria({
        ...EMPTY_TECHNICAL_FILTERS,
        q: 'customer',
        statuses: ['Draft', 'Rejected'],
        elementType: ['DataElementType.AtomicDataElement'],
        cdeMapping: ['UNMAPPED'],
      })
    ).toEqual({
      q: 'customer',
      statuses: 'Draft,Rejected',
      elementTypes: 'DataElementType.AtomicDataElement',
      cdeMapping: 'UNMAPPED',
    });
  });
});

describe('runBulkUntilDone', () => {
  const base = { glossaryId: 'g', parentBusinessVersion: '1' };

  it('repeats until nothing remains, carrying failures as the offset', async () => {
    const api = jest
      .fn()
      .mockResolvedValueOnce(
        result({
          attempted: 500,
          succeeded: 498,
          failedCount: 2,
          eligible: 1200,
          remaining: 700,
          failures: [
            { termId: 'a', code: 'TD_RANK_DUPLICATE', message: 'dup' },
          ],
        })
      )
      .mockResolvedValueOnce(
        result({
          attempted: 500,
          succeeded: 500,
          eligible: 702,
          remaining: 200,
        })
      )
      .mockResolvedValueOnce(
        result({ attempted: 200, succeeded: 200, eligible: 202, remaining: 0 })
      );
    const progress = jest.fn();

    const outcome = await runBulkUntilDone(
      'submit',
      base,
      progress,
      () => false,
      api
    );

    expect(api.mock.calls.map(([, request]) => request.offset)).toEqual([
      0, 2, 2,
    ]);
    expect(outcome.succeeded).toBe(1198);
    expect(outcome.failed).toBe(2);
    expect(outcome.failures).toHaveLength(1);
    expect(progress).toHaveBeenCalledTimes(3);
  });

  it('stops when a call attempts nothing', async () => {
    const api = jest
      .fn()
      .mockResolvedValue(result({ attempted: 0, remaining: 10 }));

    await runBulkUntilDone('approve', base, jest.fn(), () => false, api);

    expect(api).toHaveBeenCalledTimes(1);
  });

  it('stops after the current chunk when cancelled', async () => {
    const api = jest
      .fn()
      .mockResolvedValue(
        result({ attempted: 500, succeeded: 500, remaining: 900 })
      );

    await runBulkUntilDone('reject', base, jest.fn(), () => true, api);

    expect(api).toHaveBeenCalledTimes(1);
  });

  it('propagates a failing request instead of hiding it', async () => {
    const api = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(
      runBulkUntilDone('submit', base, jest.fn(), () => false, api)
    ).rejects.toThrow('boom');
  });
});
