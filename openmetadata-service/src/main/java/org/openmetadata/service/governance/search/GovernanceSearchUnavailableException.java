/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.governance.search;

/** Search engine access failed for a self-managed governance index. */
public class GovernanceSearchUnavailableException extends RuntimeException {
  public GovernanceSearchUnavailableException(final String message) {
    super(message);
  }

  public GovernanceSearchUnavailableException(final String message, final Throwable cause) {
    super(message, cause);
  }
}
