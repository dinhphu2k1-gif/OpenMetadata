/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import {
  CDE_RELEASE_VERSION_TYPE,
  getCDEReleaseVersionType,
} from './CDEReleaseVersionTypeUtils';

describe('CDEReleaseVersionTypeUtils', () => {
  it('reads the array representation used by enum custom properties', () => {
    expect(getCDEReleaseVersionType(['Bản chính'], '2.1')).toBe(
      CDE_RELEASE_VERSION_TYPE.MAIN
    );
  });

  it('keeps compatibility with legacy string values', () => {
    expect(getCDEReleaseVersionType('Bản phụ', '2.0')).toBe(
      CDE_RELEASE_VERSION_TYPE.SECONDARY
    );
  });
});
